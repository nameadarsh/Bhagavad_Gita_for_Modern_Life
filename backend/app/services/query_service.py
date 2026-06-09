from __future__ import annotations

import os
from typing import Optional, Dict, Any

from app.services.api_key_manager import ApiKeyManager
from app.services.prompt_loader import load_prompt
from app.services.model_manager import model_manager
import logging
import httpx
import re
import json

class QueryService:
    """
    Optional query refinement and analysis using a small LLM.
    If provider is not configured, returns dummy structure.
    """

    def __init__(self, *, prompts: dict, keys: ApiKeyManager) -> None:
        self.prompts = prompts
        self.keys = keys
        self.logger = logging.getLogger("analytics")

    def refine(self, query: str) -> Dict[str, Any]:
        q = (query or "").strip()
        
        if not q:
            return {
                "type": "gita_query",
                "clean_query": "",
                "intent": "knowledge",
                "desired_outcome": "wisdom",
                "themes": []
            }

        provider = (os.getenv("SMALL_LLM_PROVIDER", "dummy") or "dummy").strip().lower()
        override_model = (os.getenv("SMALL_LLM_MODEL", "") or "").strip()

        # Dummy provider: do basic keyword inference
        if provider == "dummy":
            return self._keyword_based_inference(q)

        prompt = (self.prompts.get("query_refine.txt") or load_prompt("query_refine.txt") or "").strip()
        if not prompt:
            return self._keyword_based_inference(q)

        rendered = ""
        try:
            rendered = prompt.format(query=q)
        except Exception:
            return self._keyword_based_inference(q)

        candidates = model_manager.get_candidate_models(provider, "refine", override_model=override_model)
        if not candidates:
            return self._keyword_based_inference(q)

        # Provider-aware discovery for small LLM
        probe_key = ""
        if provider in ("groq", "openai"):
            llm_keys_raw = (os.getenv("SMALL_LLM_API_KEYS", "") or "").strip()
            probe_key = (llm_keys_raw.split(",")[0].strip() if llm_keys_raw else "")
        discovered = model_manager.discover_provider_models(provider, api_key=probe_key)
        if discovered:
            merged = []
            for m in discovered + candidates:
                if m and m not in merged:
                    merged.append(m)
            candidates = merged

        for attempt, model in enumerate(candidates):
            api_key = self.keys.get_small_llm_key() or ""
            key_idx = self.keys.last_small_llm_key_index
            self.logger.info(f"small_llm_attempt task=refine provider={provider} model={model} key_index={key_idx}")
            
            try:
                if provider == "groq":
                    out = self._call_openai_like(
                        base_url="https://api.groq.com/openai/v1/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=rendered
                    )
                elif provider == "openai":
                    out = self._call_openai_like(
                        base_url="https://api.openai.com/v1/chat/completions",
                        api_key=api_key,
                        model=model,
                        prompt=rendered
                    )
                else:
                    continue

                if not out:
                    continue

                # Parse JSON from response
                try:
                    match = re.search(r"\{.*\}", out, re.DOTALL)
                    json_str = match.group(0) if match else out
                    data = json.loads(json_str)
                    
                    query_type = data.get("type")
                    if query_type not in {"greeting", "meta", "gita_query"}:
                        raise ValueError("Missing or invalid type in LLM response")

                    if query_type == "gita_query":
                        if not data.get("intent") or not data.get("desired_outcome"):
                            raise ValueError("Missing fields in LLM response")
                    else:
                        if not data.get("response"):
                            raise ValueError("Missing response for non-gita query")
                    
                    return data
                except (json.JSONDecodeError, ValueError) as e:
                    self.logger.warning(f"small_llm_json_parse_error attempt={attempt} err={e}")
                    continue

            except Exception as e:
                self.logger.error(f"small_llm_failure task=refine provider={provider} model={model} key_index={key_idx} err={e}")
                continue

        # Final fallback
        return self._keyword_based_inference(q)

    def _call_openai_like(self, base_url: str, api_key: str, model: str, prompt: str) -> str:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.0}
        with httpx.Client(timeout=15.0) as client:
            r = client.post(base_url, headers=headers, json=payload)
            if r.status_code >= 400:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
            data = r.json()
            return (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()

    def _keywordize(self, text: str) -> str:
        # For retrieval, we want the original text for semantic search
        # but cleaned of extra noise
        return (text or "").strip()

    def _keyword_based_inference(self, query: str) -> Dict[str, Any]:
        """
        Infer intent, desired_outcome, and themes from keywords when no LLM is available.
        This is NOT just keyword mapping — it infers what the user actually NEEDS.
        """
        q = query.lower()

        if q in {"hi", "hello", "hey", "namaste", "good morning", "good evening"}:
            return {
                "type": "greeting",
                "response": "Hello! I'm here to help you explore wisdom from the Bhagavad Gita.",
                "clean_query": None,
                "intent": None,
                "desired_outcome": None,
                "themes": []
            }

        if any(phrase in q for phrase in ["who are you", "what are you", "tell me about yourself", "what do you do", "about yourself"]):
            return {
                "type": "meta",
                "response": "I'm an AI system that connects your situation with teachings from the Bhagavad Gita and explains them in a practical way.",
                "clean_query": None,
                "intent": None,
                "desired_outcome": None,
                "themes": []
            }

        # Intent mapping — user-centered labels aligned with chat prompt
        if any(w in q for w in ["lonely", "alone", "isolated", "no one", "no friends"]):
            intent, desired_outcome = "emotional_loneliness", "acceptance"
        elif any(w in q for w in ["angry", "anger", "furious", "rage", "mad at", "frustrated"]):
            intent, desired_outcome = "emotional_anger", "stability"
        elif any(w in q for w in ["guilty", "guilt", "regret", "ashamed", "shame"]):
            intent, desired_outcome = "emotional_guilt", "acceptance"
        elif any(w in q for w in ["sad", "depressed", "unhappy", "sorrow", "grief", "pain", "crying", "hopeless"]):
            intent, desired_outcome = "emotional_sadness", "acceptance"
        elif any(w in q for w in ["fear", "afraid", "scared", "anxious", "anxiety", "worry", "stress", "tension", "panic", "nervous"]):
            intent, desired_outcome = "emotional_anxiety", "stability"
        elif any(w in q for w in ["career", "job", "work", "exam", "failed", "study", "college", "university"]):
            intent, desired_outcome = "situational_career", "clarity"
        elif any(w in q for w in ["stage", "present", "audience", "perform", "public speaking", "presentation"]):
            intent, desired_outcome = "situational_performance", "strength"
        elif any(w in q for w in ["procrastinat", "lazy", "discipline", "habit", "consistent", "motivation"]):
            intent, desired_outcome = "situational_habit", "purpose"
        elif any(w in q for w in ["miss", "missing", "breakup", "left me", "relationship"]):
            intent, desired_outcome = "situational_relationship", "acceptance"
        elif any(w in q for w in ["lost", "confused", "unsure", "doubt", "not sure", "uncertain", "dilemma", "which"]):
            intent, desired_outcome = "emotional_confusion", "clarity"
        elif any(w in q for w in ["what is", "who is", "explain", "meaning of", "tell me about", "philosophical", "philosophy"]):
            intent, desired_outcome = "knowledge_query", "wisdom"
        else:
            intent, desired_outcome = "general", "wisdom"

        theme_mapping = {
            "emotional_loneliness": ["connection", "self-worth", "peace", "identity"],
            "emotional_anger": ["equanimity", "self-control", "patience", "clarity"],
            "emotional_guilt": ["forgiveness", "acceptance", "integrity", "peace"],
            "emotional_sadness": ["acceptance", "peace", "hope", "equanimity"],
            "emotional_anxiety": ["equanimity", "focus", "courage", "peace"],
            "situational_career": ["action", "clarity", "purpose", "courage"],
            "situational_performance": ["courage", "focus", "equanimity", "action"],
            "situational_habit": ["discipline", "action", "focus", "consistency"],
            "situational_relationship": ["acceptance", "detachment", "love", "peace"],
            "emotional_confusion": ["clarity", "wisdom", "guidance", "truth"],
            "knowledge_query": ["knowledge", "wisdom", "self", "understanding"],
            "general": ["wisdom", "guidance", "peace", "understanding"],
        }
        themes = theme_mapping.get(intent, theme_mapping["general"])

        # Clean query: remove filler words
        filler = {"how", "to", "the", "a", "an", "i", "me", "my", "what", "why", "when", "where", "can", "could", "should", "would", "do", "does"}
        words = [w for w in q.split() if w not in filler and len(w) > 2]
        clean_query = " ".join(words) if words else query

        return {
            "type": "gita_query",
            "clean_query": clean_query,
            "intent": intent,
            "desired_outcome": desired_outcome,
            "themes": themes
        }

