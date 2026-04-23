from __future__ import annotations

import os
import re
from typing import Dict, List, Optional, Tuple

import httpx


class ModelManager:
    """
    Provider-aware model discovery + intelligent fallback.
    Caches model selection per (provider, task) until a failure occurs.
    """

    def __init__(self) -> None:
        self._cache: Dict[Tuple[str, str], str] = {}

    def get_best_model(self, provider: str, task: str) -> str:
        provider = (provider or "").strip().lower()
        task = (task or "").strip().lower()
        key = (provider, task)
        if key in self._cache:
            return self._cache[key]

        model = self._auto_detect(provider, task)
        self._cache[key] = model
        return model

    def invalidate(self, provider: str, task: str, model: str) -> None:
        key = ((provider or "").strip().lower(), (task or "").strip().lower())
        if self._cache.get(key) == model:
            self._cache.pop(key, None)

    def get_candidate_models(self, provider: str, task: str, override_model: Optional[str] = None) -> List[str]:
        provider = (provider or "").strip().lower()
        task = (task or "").strip().lower()

        # 1) If user specified override, try it first
        candidates: List[str] = []
        if override_model and override_model.strip():
            candidates.append(override_model.strip())

        # 2) Cached best
        cached = self._cache.get((provider, task))
        if cached and cached not in candidates:
            candidates.append(cached)

        # 3) Auto-detected list (priority ordered)
        auto_list = self._priority_list(provider, task)
        for m in auto_list:
            if m not in candidates:
                candidates.append(m)

        return [c for c in candidates if c]

    def discover_provider_models(self, provider: str, api_key: Optional[str] = None) -> List[str]:
        provider = (provider or "").strip().lower()
        if provider == "groq":
            return self._discover_groq_models(api_key or "")
        return []

    def _auto_detect(self, provider: str, task: str) -> str:
        override = os.getenv("LLM_MODEL" if task == "chat" else "SMALL_LLM_MODEL", "") or ""
        if override.strip():
            return override.strip()

        priority = self._priority_list(provider, task)
        return priority[0] if priority else ""

    @staticmethod
    def _priority_list(provider: str, task: str) -> List[str]:
        if provider == "groq":
            return (
                ["llama3-70b-8192", "mixtral-8x7b-32768", "llama3-8b-8192"]
                if task == "chat"
                else ["llama3-8b-8192", "mixtral-8x7b-32768"]
            )
        if provider == "openai":
            return ["gpt-4.1", "gpt-4o"] if task == "chat" else ["gpt-4o-mini", "gpt-3.5-turbo"]
        return []

    @staticmethod
    def _discover_groq_models(api_key: str) -> List[str]:
        if not api_key:
            return []
        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            with httpx.Client(timeout=10.0) as client:
                r = client.get("https://api.groq.com/openai/v1/models", headers=headers)
                if r.status_code >= 400:
                    return []
                data = r.json()
                models = data.get("data", []) or []
                out = []
                for m in models:
                    mid = m.get("id")
                    if mid:
                        out.append(str(mid))
                return out
        except Exception:
            return []

model_manager = ModelManager()


def get_best_model(provider: str, task: str) -> str:
    return model_manager.get_best_model(provider, task)

