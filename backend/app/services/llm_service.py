from __future__ import annotations

import os
import logging
from typing import Any, Dict, Optional

import httpx
import re
import json

from app.services.api_key_manager import ApiKeyManager
from app.services.prompt_loader import load_prompt, invalidate_prompt_cache
from app.services.model_manager import model_manager

class LlmService:
    def __init__(self, *, prompts: dict, keys: ApiKeyManager) -> None:
        self.prompts = prompts
        self.keys = keys
        self.logger = logging.getLogger("analytics")

    def _render_prompt(self, *, query: str, verse: Dict[str, Any], chapter_summary: Optional[str] = None, intent: str = "general", desired_outcome: str = "wisdom", language: str = "en") -> str:
        # Production: reload prompt to pick up changes
        invalidate_prompt_cache("chat_prompt.txt")
        template = load_prompt("chat_prompt.txt").strip()
        
        # Phase 11: Expanded Language Mapping
        lang_map = {
            "en": "English",
            "hi": "Hindi",
            "bn": "Bengali",
            "ta": "Tamil",
            "te": "Telugu",
            "gu": "Gujarati",
            "kn": "Kannada",
            "ml": "Malayalam",
            "mr": "Marathi",
            "pa": "Punjabi",
            "or": "Odia"
        }
        language_name = lang_map.get(language.lower(), "English")
        
        intent_descriptions = {
            "emotional_motivation": "a need for inspiration and purpose to overcome inertia.",
            "emotional_sadness": "sorrow or grief, seeking peace and an eternal perspective.",
            "emotional_confusion": "uncertainty about their path or the right course of action.",
            "emotional_anxiety": "stress and worry, needing equanimity and detachment.",
            "situational_decision": "a crossroad where they must choose their duty over personal desire.",
            "situational_moral_conflict": "a struggle between ethical dharma and worldly benefit.",
            "situational_conflict": "external or internal opposition that requires strength and detachment.",
            "knowledge_query": "a sincere desire to understand the deeper philosophy of the Gita.",
            "general": "a search for general wisdom and guidance."
        }
        
        # Required format: prompt_template.format(...)
        return template.format(
            query=query,
            intent=intent,
            intent_desc=intent_descriptions.get(intent, "a search for wisdom."),
            desired_outcome=desired_outcome,
            language_name=language_name,
            sanskrit=str(verse.get("sanskrit", "")),
            english=str(verse.get("english", "")),
            explanation=str(verse.get("brief_explanation", "")),
            speaker=str(verse.get("speaker", "")),
            chapter_summary=chapter_summary or "",
            chapter=verse.get("chapter", 0),
            verse_num=verse.get("verse", 0)
        )

    @staticmethod
    def _fallback_answer(verse: Dict[str, Any], intent: str = "general", desired_outcome: str = "wisdom") -> str:
        english = verse.get('english', '')
        sanskrit = verse.get('sanskrit', '')
        speaker = verse.get('speaker', 'Krishna')
        explanation = verse.get('brief_explanation', '')

        # Interpret based on what the user actually needs, not keyword mapping
        outcome_reflections = {
            "strength": "The weight of loss or grief often makes the world feel fragile and uncertain.",
            "stability": "When anxiety pulls the mind in many directions, it becomes difficult to find a single point of peace.",
            "clarity": "The fog of doubt can make even the simplest choice feel like an impossible burden.",
            "purpose": "Searching for meaning often leads to a feeling of being adrift without a clear anchor.",
            "dharma": "Being torn between what you want and what you know is right creates a deep internal tension.",
            "wisdom": "Seeking understanding is the first step toward moving beyond the noise of the moment."
        }

        outcome_connections = {
            "strength": "In the Gita, Krishna reminds Arjuna that while forms change, the essence within remains untouched by any storm.",
            "stability": "Krishna's guidance to a trembling Arjuna was not to stop the war, but to find the steady center within it.",
            "clarity": "When Arjuna's mind was clouded by confusion, the teaching pointed him back to his own innate wisdom.",
            "purpose": "The path Krishna showed was one where purpose is found in the action itself, not in the shadows of the future.",
            "dharma": "Arjuna's struggle with duty is a mirror to our own moments of choosing righteousness over comfort.",
            "wisdom": "The conversation on the battlefield reminds us that every doubt is an invitation to look deeper."
        }

        # Pick based on desired_outcome, fall back to generic if unknown
        reflection = outcome_reflections.get(desired_outcome, outcome_reflections["wisdom"])
        connection = outcome_connections.get(desired_outcome, outcome_connections["wisdom"])

        # Extract a meaningful phrase from explanation if available
        meaning_hint = ""
        if explanation and len(explanation) > 20:
            # Use explanation to guide but not copy
            explanation_lower = explanation.lower()
            if "action" in explanation_lower or "karma" in explanation_lower:
                meaning_hint = "Act without attachment to results — this is the heart of the teaching."
            elif "soul" in explanation_lower or "eternal" in explanation_lower:
                meaning_hint = "The true self is beyond birth, death, and any suffering it witnesses."
            elif "detachment" in explanation_lower or "equanimity" in explanation_lower:
                meaning_hint = "Hold lightly to outcomes. Equanimity is the art of staying centered."
            elif "devotion" in explanation_lower or "bhakti" in explanation_lower:
                meaning_hint = "Surrender does not mean passivity — it means offering the fruit of action to the Divine."
            elif "dharma" in explanation_lower or "duty" in explanation_lower:
                meaning_hint = "Dharma is not always easy, but it is always worth choosing."
            elif "wisdom" in explanation_lower or "knowledge" in explanation_lower:
                meaning_hint = "True knowledge is not information — it is the recognition of what has always been."
            else:
                # Generic interpretive hint based on the verse's teaching
                meaning_hint = "The verse holds a mirror to our situation. Take from it what resonates."

        return f"""{reflection}

{connection}

{meaning_hint}"""

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
        Also strips <think> tags.
        """
        # Strip <think>...</think> blocks
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
        
        # Remove numbered lists like 1. 2. or 1) 2) only at start of lines
        text = re.sub(r"^\s*\d+[\.\)]\s*", "", text, flags=re.MULTILINE)
        # Remove bullet points like - or * or •
        text = re.sub(r"^\s*[\-\*\u2022]\s*", "", text, flags=re.MULTILINE)
        
        return text.strip()

    def answer(self, *, query: str, verse: Dict[str, Any], chapter_summary: Optional[str] = None, voice_output: bool = False, intent: str = "general", desired_outcome: str = "wisdom", language: str = "en") -> Dict[str, Any]:
        """
        Production behavior:
        - If provider is dummy: return a safe grounded answer from dataset fields
        - Returns: {"answer": str, "fallback": bool}
        """
        provider = (os.getenv("LLM_PROVIDER", "dummy") or "dummy").strip().lower()
        llm_keys = (os.getenv("LLM_API_KEYS", "") or "").strip()
        
        # Production validation
        if provider != "dummy" and not llm_keys:
            raise ValueError(f"Missing required environment variable: LLM_API_KEYS for provider {provider}")

        override_model = (os.getenv("LLM_MODEL", "") or "").strip()
        try:
            prompt = self._render_prompt(
                query=query, 
                verse=verse, 
                chapter_summary=chapter_summary, 
                intent=intent,
                desired_outcome=desired_outcome,
                language=language
            )
        except Exception as e:
            self.logger.error(f"llm_prompt_render_error err={e}")
            return {"answer": self._fallback_answer(verse, intent, desired_outcome), "fallback": True}

        # Trust the pipeline: only fallback if truly dummy (not "dummy_model" etc)
        if not prompt.strip() or provider == "dummy":
            self.logger.info(f"llm_fallback reason={'empty_prompt' if not prompt.strip() else 'dummy_provider'} provider={provider}")
            return {"answer": self._fallback_answer(verse, intent, desired_outcome), "fallback": True}

        candidates = model_manager.get_candidate_models(provider, "chat", override_model=override_model)

        # Provider-aware live discovery
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

        if not candidates:
            return {"answer": self._fallback_answer(verse, intent, desired_outcome), "fallback": True}

        # Retry logic: switch key, switch model
        max_attempts = max(3, len(candidates))
        for attempt in range(max_attempts):
            model = candidates[min(attempt, len(candidates) - 1)]
            api_key = self.keys.get_llm_key() or ""
            key_index = self.keys.last_llm_key_index
            try:
                if provider == "groq":
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
                else:
                    continue

                if not out:
                    continue

                # Parse JSON safely
                try:
                    match = re.search(r"\{.*\}", out, re.DOTALL)
                    json_str = match.group(0) if match else out
                    data = json.loads(json_str)
                    
                    if not isinstance(data, dict):
                        raise ValueError(f"Expected dict, got {type(data).__name__}")
                    
                    # 1. Extract response text
                    response_text = data.get("response", "").strip()
                    
                    # Fallback for old field names if LLM ignores the new prompt initially
                    if not response_text:
                        reflection = data.get("connection", "").strip()
                        insight = data.get("insight", "").strip()
                        meaning = data.get("meaning", "").strip()
                        if reflection or insight or meaning:
                            response_text = f"{reflection}\n\n{insight}\n\n{meaning}".strip()
                    
                    if not response_text:
                        raise ValueError("Empty response field")

                    # Phase 8: Content Quality Refinement (Post-processing)
                    # 1. Normalize spacing and line breaks
                    response_text = re.sub(r'\n{3,}', '\n\n', response_text) # Max 2 newlines
                    response_text = re.sub(r' +', ' ', response_text) # No extra spaces
                    
                    # 2. Simple deduplication of consecutive identical sentences
                    sentences = re.split(r'(?<=[.!?])\s+', response_text)
                    unique_sentences = []
                    for s in sentences:
                        s = s.strip()
                        if not unique_sentences or s != unique_sentences[-1]:
                            unique_sentences.append(s)
                    response_text = " ".join(unique_sentences)
                    
                    # 3. Ensure clean paragraph breaks (the split might have lost them)
                    # Note: The prompt asks for 4-5 paragraphs. Let's re-split into paragraphs if lost.
                    if '\n\n' not in response_text and len(unique_sentences) > 4:
                        # Heuristic: split into 4-5 paragraphs
                        chunk_size = len(unique_sentences) // 4
                        paragraphs = []
                        for i in range(0, len(unique_sentences), chunk_size):
                            paragraphs.append(" ".join(unique_sentences[i:i+chunk_size]))
                        response_text = "\n\n".join(paragraphs[:5])

                    # 2. Final cleaning: remove robotic artifacts and em-dashes
                    response_text = self._clean_robotic_formatting(response_text)
                    response_text = response_text.replace("—", " - ")
                    
                    # Additional strict cleaning: Remove any lines that look like headers (e.g., "1. Problem Framing:")
                    response_text = re.sub(r"^\d+\.\s+.*:", "", response_text, flags=re.MULTILINE)
                    response_text = re.sub(r"^\*\*\d+\.\s+.*:\*\*", "", response_text, flags=re.MULTILINE)
                    response_text = re.sub(r"^Problem Framing:", "", response_text, flags=re.MULTILINE | re.IGNORECASE)
                    response_text = re.sub(r"^Gita Context:", "", response_text, flags=re.MULTILINE | re.IGNORECASE)
                    response_text = re.sub(r"^Krishna’s Teaching:", "", response_text, flags=re.MULTILINE | re.IGNORECASE)
                    response_text = re.sub(r"^Practical Meaning:", "", response_text, flags=re.MULTILINE | re.IGNORECASE)

                    # 3. Security: ensure shlok or translation is NOT inside response text
                    # If LLM hallucinated shlok into response, we strip it
                    sanskrit_in_verse = (data.get("verse", {}) if isinstance(data.get("verse"), dict) else {}).get("sanskrit", "")
                    if sanskrit_in_verse and sanskrit_in_verse in response_text:
                        response_text = response_text.replace(sanskrit_in_verse, "").strip()
                    
                    # Also strip common verse markers if they appear
                    response_text = re.sub(r"Verse\s+\d+\.\d+", "", response_text)
                    response_text = re.sub(r"Chapter\s+\d+", "", response_text)

                    return {"answer": response_text.strip(), "fallback": False}

                except (json.JSONDecodeError, ValueError, AttributeError) as e:
                    self.logger.warning(f"llm_json_parse_error attempt={attempt} err={e}")
                    if attempt == max_attempts - 1:
                        return {"answer": self._fallback_answer(verse, intent, desired_outcome), "fallback": True}
                    continue

            except Exception as e:
                self.logger.error(f"llm_failure attempt={attempt} model={model} err={e}")
                if attempt == max_attempts - 1:
                    # Phase 9: Edge Case Handling - Clean Fallback Message
                    fallback_msg = "I am unable to provide a detailed explanation at this moment. Please reflect on the wisdom of the verse provided above while I resolve this connection issue."
                    return {"answer": fallback_msg, "fallback": True}
                continue

        # All failed
        self.logger.info(f"llm_fallback reason=all_failed provider={provider}")
        fallback_msg = "I am unable to provide a detailed explanation at this moment. Please reflect on the wisdom of the verse provided above while I resolve this connection issue."
        return {"answer": fallback_msg, "fallback": True}

