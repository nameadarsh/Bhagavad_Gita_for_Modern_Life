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
        
        # Display names for supported chat languages
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
            "emotional_anxiety": "carrying worry about what may happen next, mind racing ahead of the present.",
            "emotional_sadness": "a heaviness or grief that makes it hard to feel present and engaged.",
            "emotional_loneliness": "feeling disconnected, unseen, or without meaningful company.",
            "emotional_anger": "strong frustration or resentment that is hard to settle.",
            "emotional_guilt": "regret or self-blame weighing on them after something they did or failed to do.",
            "emotional_confusion": "uncertainty about the right path or a conflict between what they want and what they believe.",
            "situational_career": "questions about work, studies, exams, or where their life direction should go.",
            "situational_performance": "fear of being judged, speaking in public, or performing under scrutiny.",
            "situational_habit": "struggling with procrastination, consistency, or building discipline.",
            "situational_relationship": "missing someone, navigating connection, or relational tension.",
            "knowledge_query": "wanting to understand Gita philosophy or a specific teaching.",
            "general": "seeking practical wisdom for a life situation.",
            # Legacy intent keys from keyword fallback
            "sad": "a heaviness or grief that makes it hard to feel present and engaged.",
            "fear": "carrying worry or dread about what may happen next.",
            "confused": "uncertainty about the right path or what to choose.",
            "philosophical": "wanting to understand deeper philosophical ideas.",
        }

        situation_focus = self._situation_focus(query=query, intent=intent, desired_outcome=desired_outcome)

        return template.format(
            query=query,
            intent=intent,
            intent_desc=intent_descriptions.get(intent, "seeking practical wisdom for a life situation."),
            desired_outcome=desired_outcome,
            situation_focus=situation_focus,
            language_name=language_name,
            sanskrit=str(verse.get("sanskrit", "")),
            english=str(verse.get("english", "")),
            explanation=str(verse.get("brief_explanation", "")),
            speaker=str(verse.get("speaker", "")),
            chapter_summary=chapter_summary or "",
            chapter=verse.get("chapter", 0),
            verse_num=verse.get("verse", 0),
        )

    @staticmethod
    def _situation_focus(*, query: str, intent: str, desired_outcome: str) -> str:
        """Guide the LLM toward distinct angles per situation type."""
        by_intent = {
            "emotional_anxiety": "uncertainty, future-thinking, and how to steady the mind when outcomes feel unknown.",
            "emotional_sadness": "loss, acceptance, and allowing grief without losing oneself in it.",
            "emotional_loneliness": "connection, self-worth, and being whole even when others are absent.",
            "emotional_anger": "reaction, self-control, and separating the feeling from the action taken.",
            "emotional_guilt": "accountability without self-punishment, and how to move forward responsibly.",
            "emotional_confusion": "decision-making under uncertainty and trusting one's considered judgment.",
            "situational_career": "choosing a direction, handling setbacks, and acting without needing perfect certainty.",
            "situational_performance": "performance anxiety, fear of judgment, and showing up despite nerves.",
            "situational_habit": "habits, consistency, and starting small rather than waiting for motivation.",
            "situational_relationship": "longing, attachment to people, and healthy ways to hold connection.",
            "knowledge_query": "clear explanation of the idea — keep it practical, not academic.",
        }
        if intent in by_intent:
            return by_intent[intent]

        q = (query or "").lower()
        if any(w in q for w in ["lonely", "alone", "isolated", "no friends"]):
            return by_intent["emotional_loneliness"]
        if any(w in q for w in ["angry", "anger", "furious", "rage", "mad at"]):
            return by_intent["emotional_anger"]
        if any(w in q for w in ["guilty", "guilt", "regret", "ashamed"]):
            return by_intent["emotional_guilt"]
        if any(w in q for w in ["career", "job", "exam", "failed", "study", "college"]):
            return by_intent["situational_career"]
        if any(w in q for w in ["stage", "present", "audience", "perform", "public speaking"]):
            return by_intent["situational_performance"]
        if any(w in q for w in ["procrastinat", "lazy", "discipline", "habit", "consistent"]):
            return by_intent["situational_habit"]
        if any(w in q for w in ["miss", "misses", "missing someone", "breakup", "left me"]):
            return by_intent["situational_relationship"]
        if any(w in q for w in ["anxious", "anxiety", "worried", "worry", "stress", "nervous"]):
            return by_intent["emotional_anxiety"]
        if any(w in q for w in ["sad", "depressed", "grief", "lost", "hopeless"]):
            return by_intent["emotional_sadness"]

        outcome_focus = {
            "stability": "finding an inner steadiness when circumstances feel unstable.",
            "clarity": "cutting through noise to see the next reasonable step.",
            "strength": "drawing on inner resilience without forcing positivity.",
            "purpose": "meaning and direction in everyday action.",
            "acceptance": "working with what cannot be changed while still acting wisely.",
            "dharma": "doing what is right when it is difficult, without moralizing.",
        }
        return outcome_focus.get(desired_outcome, "the user's specific situation — keep guidance concrete and distinct.")

    @staticmethod
    def _fallback_answer(verse: Dict[str, Any], intent: str = "general", desired_outcome: str = "wisdom") -> str:
        explanation = verse.get("brief_explanation", "")

        outcome_reflections = {
            "strength": "What you are facing likely feels heavier than you expected, and that weight is real.",
            "stability": "When the mind keeps jumping ahead, it is hard to feel settled in the present moment.",
            "clarity": "Not knowing the right move can make even small decisions feel overwhelming.",
            "purpose": "Searching for direction often comes with a sense of being stuck between options.",
            "acceptance": "Some of what hurts cannot be undone quickly, and that slow process is part of being human.",
            "dharma": "You may feel pulled between what you want and what you believe is right.",
            "wisdom": "You are looking for something steady to hold onto while things feel uncertain.",
            "uplifting guidance": "There seems to be a heaviness that is making it difficult to feel engaged with daily life.",
            "deeper explanation": "You want to understand an idea clearly, not just hear something comforting.",
        }

        outcome_principles = {
            "strength": "Resilience grows when you act from your values even when the outcome is unclear.",
            "stability": "Steadiness comes from noticing the mind's restlessness without letting it dictate every choice.",
            "clarity": "Clarity often arrives after you take one honest step, not before you start.",
            "purpose": "Meaning tends to show up in how you show up today, not only in a distant goal.",
            "acceptance": "Acceptance is not giving up — it is seeing what is true so you can respond wisely.",
            "dharma": "Integrity means choosing the harder right over the easier wrong, one decision at a time.",
            "wisdom": "Understanding deepens when you reflect on your situation without rushing to fix it.",
            "uplifting guidance": "Healing often moves in layers; allow yourself time without demanding instant relief.",
            "deeper explanation": "A teaching becomes useful when you connect it to something you already live with.",
        }

        reflection = outcome_reflections.get(desired_outcome, outcome_reflections["wisdom"])
        principle = outcome_principles.get(desired_outcome, outcome_principles["wisdom"])

        takeaway = "Pick one small action you can take today that aligns with what matters to you, without needing perfect certainty."
        if explanation and len(explanation) > 20:
            explanation_lower = explanation.lower()
            if "action" in explanation_lower or "karma" in explanation_lower:
                takeaway = "Focus on the quality of your effort today rather than controlling every result."
            elif "detachment" in explanation_lower or "equanimity" in explanation_lower:
                takeaway = "Notice when you are gripping an outcome too tightly, and practice loosening that grip once."
            elif "knowledge" in explanation_lower or "wisdom" in explanation_lower:
                takeaway = "Write down what you already know is true about your situation — clarity often starts there."

        return f"{reflection}\n\n{principle}\n\n{takeaway}"

    def _call_openai_like(self, *, base_url: str, api_key: str, model: str, prompt: str) -> str:
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.55,
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

                    # Post-process: spacing, light dedup, paragraph heuristics
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
                    # User-facing fallback when the model fails on the last attempt
                    fallback_msg = "I am unable to provide a detailed explanation at this moment. Please reflect on the wisdom of the verse provided above while I resolve this connection issue."
                    return {"answer": fallback_msg, "fallback": True}
                continue

        # All failed
        self.logger.info(f"llm_fallback reason=all_failed provider={provider}")
        fallback_msg = "I am unable to provide a detailed explanation at this moment. Please reflect on the wisdom of the verse provided above while I resolve this connection issue."
        return {"answer": fallback_msg, "fallback": True}

