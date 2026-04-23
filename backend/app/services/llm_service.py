from __future__ import annotations

import os
import logging
from typing import Any, Dict, Optional

import ollama
import httpx
import re
import json

from app.services.api_key_manager import ApiKeyManager
from app.services.prompt_loader import load_prompt
from app.services.model_manager import model_manager

DEBUG = False


class LlmService:
    def __init__(self, *, prompts: dict, keys: ApiKeyManager) -> None:
        self.prompts = prompts
        self.keys = keys
        self.logger = logging.getLogger("analytics")

    def _render_prompt(self, *, query: str, verse: Dict[str, Any], chapter_summary: Optional[str]) -> str:
        template = (self.prompts.get("chat_prompt.txt") or load_prompt("chat_prompt.txt") or "").strip()
        # Required format: prompt_template.format(...)
        return template.format(
            query=query,
            sanskrit=str(verse.get("sanskrit", "")),
            english=str(verse.get("english", "")),
            explanation=str(verse.get("brief_explanation", "")),
            speaker=str(verse.get("speaker", "")),
            chapter_summary=chapter_summary or "",
        )

    @staticmethod
    def _fallback_answer(verse: Dict[str, Any]) -> str:
        return (
            f"{verse.get('brief_explanation')}\n\n"
            f"Verse ({verse.get('id')}): {verse.get('english')}"
        ).strip()

    def _call_openai_like(self, *, base_url: str, api_key: str, model: str, prompt: str) -> str:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        
        # Retry logic: 2 attempts
        for attempt in range(2):
            try:
                with httpx.Client(timeout=30.0) as client:
                    r = client.post(base_url, headers=headers, json=payload)
                    if r.status_code >= 400:
                        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
                    data = r.json()
                    return (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
            except Exception as e:
                if attempt == 1:
                    raise
                self.logger.warning(f"llm_api_retry attempt={attempt+1} err={e}")
        return ""

    def _clean_robotic_formatting(self, text: str) -> str:
        """
        Safety check: remove numbered lists and bullet points if they appear.
        Converts them into natural paragraph flow.
        Also strips <think> tags.
        """
        # Strip <think>...</think> blocks
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
        
        # Remove numbered lists like 1. 2. or 1) 2)
        text = re.sub(r"^\s*\d+[\.\)]\s*", "", text, flags=re.MULTILINE)
        # Remove bullet points like - or * or •
        text = re.sub(r"^\s*[\-\*\u2022]\s*", "", text, flags=re.MULTILINE)
        # Join lines that were likely part of a list but now should be paragraphs
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        return " ".join(lines)

    def answer(self, *, query: str, verse: Dict[str, Any], chapter_summary: Optional[str] = None, voice_output: bool = False) -> Dict[str, Any]:
        """
        Production behavior:
        - If provider is dummy: return a safe grounded answer from dataset fields
        - If provider is ollama: generate answer using prompt + dataset fields
        - Returns: {"answer": str, "fallback": bool}
        """
        provider = (os.getenv("LLM_PROVIDER", "dummy") or "dummy").strip().lower()
        llm_keys = (os.getenv("LLM_API_KEYS", "") or "").strip()
        
        # Production validation
        if provider != "dummy" and provider != "ollama" and not llm_keys:
            raise ValueError(f"Missing required environment variable: LLM_API_KEYS for provider {provider}")

        override_model = (os.getenv("LLM_MODEL", "") or "").strip()
        prompt = self._render_prompt(query=query, verse=verse, chapter_summary=chapter_summary)

        if voice_output and os.getenv("SARVAM_API_KEY"):
            # Placeholder only; do not implement actual call
            pass

        # No LLM call without prompt file
        if not prompt.strip() or provider.startswith("dummy"):
            self.logger.info(f"llm_fallback reason={'empty_prompt' if not prompt.strip() else 'dummy_provider'} provider={provider}")
            return {"answer": self._fallback_answer(verse), "fallback": True}

        candidates = model_manager.get_candidate_models(provider, "chat", override_model=override_model)

        # Provider-aware live discovery (Groq/Ollama) to avoid stale/deprecated model lists.
        probe_key = ""
        if provider in ("groq", "openai"):
            llm_keys_raw = (os.getenv("LLM_API_KEYS", "") or "").strip()
            probe_key = (llm_keys_raw.split(",")[0].strip() if llm_keys_raw else "")
        discovered = model_manager.discover_provider_models(provider, api_key=probe_key)
        if discovered:
            merged = []
            for m in discovered + candidates:
                if m and m not in merged:
                    merged.append(m)
            candidates = merged
            self.logger.info(f"llm_model_discovery provider={provider} discovered_count={len(discovered)}")

        if not candidates:
            self.logger.info(f"llm_fallback reason=no_models provider={provider}")
            return self._fallback_answer(verse)

        # Retry logic: switch key, switch model
        max_attempts = max(3, len(candidates))
        for attempt in range(max_attempts):
            model = candidates[min(attempt, len(candidates) - 1)]
            api_key = self.keys.get_llm_key() or ""
            key_index = self.keys.last_llm_key_index
            try:
                if DEBUG:
                    print("🔥 LLM CALL ATTEMPT")
                    print("Provider:", provider)
                    print("Model:", model)
                if provider == "groq" and api_key and not api_key.startswith("gsk_"):
                    print("⚠️ Invalid Groq key format")
                    self.logger.warning(f"llm_autofix skip_invalid_key provider=groq key_index={key_index}")
                    continue
                self.logger.info(f"llm_attempt provider={provider} model={model} key_index={key_index}")
                if provider == "ollama":
                    resp = ollama.chat(model=model, messages=[{"role": "user", "content": prompt}])
                    out = (resp.get("message", {}) or {}).get("content", "").strip()
                elif provider == "groq":
                    out = self._call_openai_like(
                        base_url="https://api.groq.com/openai/v1/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=prompt,
                    )
                elif provider == "openai":
                    out = self._call_openai_like(
                        base_url="https://api.openai.com/v1/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=prompt,
                    )
                elif provider == "deepseek":
                    out = self._call_openai_like(
                        base_url="https://api.deepseek.com/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=prompt,
                    )
                elif provider == "openrouter":
                    out = self._call_openai_like(
                        base_url="https://openrouter.ai/api/v1/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=prompt,
                    )
                elif provider == "together":
                    out = self._call_openai_like(
                        base_url="https://api.together.xyz/v1/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=prompt,
                    )
                else:
                    if DEBUG:
                        print(f"⚠️ Unsupported provider: {provider}")
                    raise RuntimeError(f"Unsupported provider: {provider}")

                if out:
                    # Cache success
                    model_manager.get_best_model(provider, "chat")
                    self.logger.info(f"llm_success provider={provider} model={model} key_index={key_index}")
                    
                    # 1. Strip reasoning blocks first
                    clean_text = re.sub(r"<think>.*?</think>", "", out, flags=re.DOTALL).strip()
                    
                    # 2. Try JSON parsing
                    answer_text = None
                    is_fallback = False
                    
                    try:
                        # Extract content between first { and last } if needed
                        json_match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
                        parsed = None
                        if json_match:
                            parsed = json.loads(json_match.group(1))
                        else:
                            parsed = json.loads(clean_text)
                        
                        # HARDEN VALIDATION
                        if isinstance(parsed, dict) and "answer" in parsed and isinstance(parsed["answer"], str) and parsed["answer"].strip():
                            answer_text = parsed["answer"].strip()
                            # Remove potential extra quotes
                            if answer_text.startswith('"') and answer_text.endswith('"'):
                                answer_text = answer_text[1:-1].strip()
                        else:
                            is_fallback = True
                            answer_text = clean_text
                    except (json.JSONDecodeError, AttributeError, Exception):
                        is_fallback = True
                        answer_text = clean_text

                    # 3. Handle weak/empty responses
                    if not answer_text or len(answer_text) < 45:
                        is_fallback = True
                        answer_text = self._fallback_answer(verse)
                    
                    # 4. Final cleaning
                    final_answer = self._clean_robotic_formatting(answer_text)
                    return {"answer": final_answer, "fallback": is_fallback}
                raise RuntimeError("Empty LLM response")
            except Exception as e:
                if DEBUG:
                    print("❌ LLM ERROR:", str(e))
                self.logger.error(f"llm_failure provider={provider} model={model} key_index={key_index} err={e}")
                model_manager.invalidate(provider, "chat", model)
                continue

        # All failed
        self.logger.info(f"llm_fallback reason=all_failed provider={provider}")
        return {"answer": self._fallback_answer(verse), "fallback": True}

