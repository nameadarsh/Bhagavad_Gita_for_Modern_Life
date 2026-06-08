from __future__ import annotations

import os
import itertools
from typing import List, Optional, Tuple

from dotenv import load_dotenv

class ApiKeyManager:
    def __init__(self) -> None:
        load_dotenv()
        self._llm_keys = self._load_keys_env(
            var_name="LLM_API_KEYS", legacy_prefix="LLM_API_KEY_", legacy_single="LLM_API_KEY"
        )
        self._small_llm_keys = self._load_keys_env(
            var_name="SMALL_LLM_API_KEYS",
            legacy_prefix="SMALL_LLM_API_KEY_",
            legacy_single="SMALL_LLM_API_KEY",
        )

        self._llm_cycle = itertools.cycle(list(enumerate(self._llm_keys))) if self._llm_keys else None
        self._small_cycle = itertools.cycle(list(enumerate(self._small_llm_keys))) if self._small_llm_keys else None

        # for logging/analytics
        self.last_llm_key_index: Optional[int] = None
        self.last_small_llm_key_index: Optional[int] = None

    @staticmethod
    def _parse_csv_keys(raw: str) -> List[str]:
        parts = [p.strip() for p in (raw or "").split(",")]
        return [p for p in parts if p]

    @classmethod
    def _load_keys_env(cls, *, var_name: str, legacy_prefix: str, legacy_single: str = "") -> List[str]:
        raw = os.getenv(var_name, "") or ""
        keys = cls._parse_csv_keys(raw)

        if not keys and legacy_single:
            single = (os.getenv(legacy_single, "") or "").strip()
            if single:
                keys = [single]

        if not keys:
            for k, v in os.environ.items():
                if k.startswith(legacy_prefix) and (v or "").strip():
                    keys.append(v.strip())

        # Deduplicate while preserving order
        dedup: List[str] = []
        seen = set()
        for k in keys:
            if k in seen:
                continue
            seen.add(k)
            dedup.append(k)
        return dedup

    def get_llm_key(self) -> Optional[str]:
        if not self._llm_cycle:
            return None
        idx, key = next(self._llm_cycle)
        self.last_llm_key_index = idx
        return key

    def get_small_llm_key(self) -> Optional[str]:
        if not self._small_cycle:
            return None
        idx, key = next(self._small_cycle)
        self.last_small_llm_key_index = idx
        return key

