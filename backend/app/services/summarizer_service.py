from __future__ import annotations

import os
from typing import List, Dict, Any, Optional

from app.services.api_key_manager import ApiKeyManager
from app.services.prompt_loader import load_prompt
from app.services.model_manager import model_manager
import logging
import httpx
import ollama

DEBUG = False


class SummarizerService:
    """
    Lightweight conversation summarizer.
    For now, uses a simple heuristic unless a real provider is configured.
    """

    def __init__(self, *, prompts: dict, keys: ApiKeyManager) -> None:
        self.prompts = prompts
        self.keys = keys
        self.logger = logging.getLogger("analytics")

    def summarize(self, *, previous_summary: str, query: str, verse: Dict[str, Any]) -> str:
        prompt = (self.prompts.get("summarization.txt") or load_prompt("summarization.txt") or "").strip()
        if not prompt:
            return (previous_summary or "").strip()

        provider = (os.getenv("SMALL_LLM_PROVIDER", "dummy") or "dummy").strip().lower()
        override_model = (os.getenv("SMALL_LLM_MODEL", "") or "").strip()

        # Dummy provider: no LLM call; keep minimal deterministic summary
        if provider.startswith("dummy"):
            vid = (verse.get("id") or "").strip()
            base = (previous_summary or "").strip()
            cur = f"User: {query[:120]} | Verse: {vid}".strip()
            return (base + " " + cur).strip()[:240]

        try:
            rendered = prompt.format(
                previous_summary=(previous_summary or ""),
                query=query,
                verse_id=str(verse.get("id", "")),
                speaker=str(verse.get("speaker", "")),
                english=str(verse.get("english", "")),
            )
        except Exception:
            return (previous_summary or "").strip()

        candidates = model_manager.get_candidate_models(provider, "small", override_model=override_model)
        probe_key = ""
        if provider in ("groq", "openai"):
            raw = (os.getenv("SMALL_LLM_API_KEYS", "") or "").strip()
            probe_key = (raw.split(",")[0].strip() if raw else "")
        discovered = model_manager.discover_provider_models(provider, api_key=probe_key)
        if discovered:
            merged = []
            for m in discovered + candidates:
                if m and m not in merged:
                    merged.append(m)
            candidates = merged
            self.logger.info(f"small_llm_model_discovery task=summarize provider={provider} discovered_count={len(discovered)}")
        if not candidates:
            return (previous_summary or "").strip()

        def call_openai_like(base_url: str, api_key: str, model: str, text: str) -> str:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {"model": model, "messages": [{"role": "user", "content": text}], "temperature": 0.0}
            with httpx.Client(timeout=15.0) as client:
                r = client.post(base_url, headers=headers, json=payload)
                if r.status_code >= 400:
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
                data = r.json()
                return (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()

        for model in candidates[:5]:
            api_key = self.keys.get_small_llm_key() or ""
            key_index = self.keys.last_small_llm_key_index
            try:
                if DEBUG:
                    print("🔥 SMALL LLM CALL ATTEMPT (summarize)")
                    print("Provider:", provider)
                    print("Model:", model)
                    print("Using API Key index:", key_index)
                if provider == "groq" and api_key and not api_key.startswith("gsk_"):
                    print("⚠️ Invalid Groq key format")
                    self.logger.warning(f"small_llm_autofix skip_invalid_key task=summarize provider=groq key_index={key_index}")
                    continue
                self.logger.info(f"small_llm_attempt task=summarize provider={provider} model={model} key_index={key_index}")
                if provider == "ollama":
                    resp = ollama.chat(model=model, messages=[{"role": "user", "content": rendered}])
                    out = (resp.get("message", {}) or {}).get("content", "").strip()
                elif provider == "groq":
                    out = call_openai_like("https://api.groq.com/openai/v1/chat/completions", api_key, model, rendered)
                elif provider == "openai":
                    out = call_openai_like("https://api.openai.com/v1/chat/completions", api_key, model, rendered)
                else:
                    raise RuntimeError(f"Unsupported provider: {provider}")
                return out if out else (previous_summary or "").strip()
            except Exception as e:
                print("❌ SMALL LLM ERROR (summarize):", str(e))
                self.logger.error(f"small_llm_failure task=summarize provider={provider} model={model} key_index={key_index} err={e}")
                model_manager.invalidate(provider, "small", model)
                continue

        return (previous_summary or "").strip()

