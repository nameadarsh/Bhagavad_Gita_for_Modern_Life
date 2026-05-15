from __future__ import annotations

import logging
import os
import re
from typing import List, Optional, Tuple

import httpx

logger = logging.getLogger("analytics")

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

_RETRY_BODY_PATTERNS = re.compile(
    r"quota|rate\s*limit|too\s+many\s+requests|exhausted|"
    r"credit|throttl|limit\s+exceeded|insufficient|"
    r"subscription|billing|capacity",
    re.IGNORECASE,
)

_NON_RETRYABLE_STATUSES = frozenset({400, 404, 413, 415, 422})


def load_sarvam_api_keys() -> List[str]:
    """Parse SARVAM_API_KEYS (CSV) or fall back to SARVAM_API_KEY."""
    raw = os.getenv("SARVAM_API_KEYS", "") or ""
    parts = [p.strip() for p in raw.split(",")]
    keys = [p for p in parts if p]

    if not keys:
        single = (os.getenv("SARVAM_API_KEY", "") or "").strip()
        if single:
            keys = [single]

    dedup: List[str] = []
    seen: set[str] = set()
    for k in keys:
        if k not in seen:
            seen.add(k)
            dedup.append(k)
    return dedup


def is_sarvam_retryable(status_code: int, response_body: str = "") -> bool:
    """
    True when another API key may succeed (quota, rate limit, transient provider).
    False for client/payload errors that keys cannot fix.
    """
    if status_code in _NON_RETRYABLE_STATUSES:
        return False

    if status_code in (429, 402, 408, 500, 502, 503, 504):
        return True

    body = response_body or ""
    if status_code in (401, 403):
        return True

    if status_code >= 400 and _RETRY_BODY_PATTERNS.search(body):
        return True

    return False


class SarvamKeyManager:
    """Sequential fallback across Sarvam API keys (no infinite retry)."""

    def __init__(self, keys: Optional[List[str]] = None) -> None:
        self._keys = keys if keys is not None else load_sarvam_api_keys()
        self.last_key_index: Optional[int] = None

    @property
    def key_count(self) -> int:
        return len(self._keys)

    def has_keys(self) -> bool:
        return bool(self._keys)

    async def post_tts(
        self,
        *,
        payload: dict,
        timeout: float = 30.0,
    ) -> Tuple[Optional[httpx.Response], Optional[str]]:
        """
        POST to Sarvam TTS with per-key fallback.
        Returns (response, None) on HTTP 200, else (None, error_code).
        """
        if not self._keys:
            logger.error("[TTS] No Sarvam API keys configured (SARVAM_API_KEYS / SARVAM_API_KEY)")
            return None, "CONFIG_ERROR"

        last_status: Optional[int] = None
        last_body_snippet = ""

        async with httpx.AsyncClient() as client:
            for index, api_key in enumerate(self._keys):
                try:
                    response = await client.post(
                        SARVAM_TTS_URL,
                        headers={
                            "api-subscription-key": api_key,
                            "Content-Type": "application/json",
                        },
                        json=payload,
                        timeout=timeout,
                    )
                except httpx.TimeoutException:
                    logger.warning(
                        "[TTS] sarvam_key_fallback key_index=%s reason=timeout keys_remaining=%s",
                        index,
                        len(self._keys) - index - 1,
                    )
                    if index < len(self._keys) - 1:
                        continue
                    return None, "PIPELINE_ERROR"
                except httpx.RequestError as exc:
                    logger.warning(
                        "[TTS] sarvam_key_fallback key_index=%s reason=request_error detail=%s keys_remaining=%s",
                        index,
                        type(exc).__name__,
                        len(self._keys) - index - 1,
                    )
                    if index < len(self._keys) - 1:
                        continue
                    return None, "PIPELINE_ERROR"

                last_status = response.status_code
                last_body_snippet = (response.text or "")[:300]

                if response.status_code == 200:
                    self.last_key_index = index
                    if index > 0:
                        logger.info(
                            "[TTS] sarvam_key_success key_index=%s after_fallback=true",
                            index,
                        )
                    else:
                        logger.info("[TTS] sarvam_key_success key_index=0 after_fallback=false")
                    return response, None

                retryable = is_sarvam_retryable(response.status_code, response.text or "")
                if retryable and index < len(self._keys) - 1:
                    logger.warning(
                        "[TTS] sarvam_key_fallback key_index=%s http_status=%s reason=retryable "
                        "keys_remaining=%s body_snippet=%r",
                        index,
                        response.status_code,
                        len(self._keys) - index - 1,
                        last_body_snippet[:120],
                    )
                    continue

                if not retryable:
                    logger.error(
                        "[TTS] sarvam_key_non_retryable key_index=%s http_status=%s body_snippet=%r",
                        index,
                        response.status_code,
                        last_body_snippet[:120],
                    )
                    return None, "TTS_FAILED"

                # Last key, retryable failure
                logger.error(
                    "[TTS] sarvam_all_keys_exhausted last_key_index=%s http_status=%s body_snippet=%r",
                    index,
                    response.status_code,
                    last_body_snippet[:120],
                )
                return None, "TTS_FAILED"

        logger.error("[TTS] sarvam_all_keys_exhausted keys_tried=%s", len(self._keys))
        return None, "TTS_FAILED"
