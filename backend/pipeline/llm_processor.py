import ollama
import time
import re
from utils.logger import pipeline_logger, error_logger

def check_ollama_status():
    try:
        models = ollama.list()
        # Verify mistral is available
        if not any('mistral' in m.model.lower() for m in models.get('models', [])):
            pipeline_logger.warning("Mistral model not found in Ollama. Please pull it.")
            return False
        return True
    except Exception as e:
        error_logger.error(f"Ollama server does not appear to be running: {e}")
        return False

def call_ollama(prompt, system_prompt, retries=3):
    """Helper function to call ollama mistral model with retries."""
    for attempt in range(retries):
        try:
            response = ollama.chat(model='mistral', messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': prompt}
            ])
            return response['message']['content']
        except Exception as e:
            error_logger.warning(f"Ollama call failed (attempt {attempt+1}/{retries}): {str(e)}")
            time.sleep(2)
            
    error_logger.error("Ollama call failed completely after all retries.")
    return None

def _clamp_sentences(text: str, max_sentences: int = 4) -> str:
    cleaned = " ".join((text or "").strip().split())
    if not cleaned:
        return ""
    # naive sentence split; good enough to enforce hard cap
    parts = re.split(r'(?<=[.!?])\s+', cleaned)
    parts = [p.strip() for p in parts if p.strip()]
    return " ".join(parts[:max_sentences])

def _clean_theme(theme: str) -> str:
    t = re.sub(r'[^a-zA-Z\s\-]', '', (theme or '').strip().lower())
    t = re.sub(r'\s+', ' ', t).strip()
    return t

_EXPLANATION_SYSTEM_PROMPT = """You are an assistant enriching a Bhagavad Gita dataset.

STRICT RULES:
- Use ONLY the provided Sivananda commentary text as the source.
- Do NOT use external knowledge about the Gita.
- Do NOT add facts, names, places, events, or interpretations not present in the commentary.
- Remove repetition and long digressions.
- Output MUST be 2–3 sentences maximum.

Return ONLY the explanation text (no quotes, no markdown).
"""

_THEMES_SYSTEM_PROMPT = """You are extracting themes from a short explanation text.

STRICT RULES:
- Return EXACTLY 2 to 4 themes.
- Each theme must be 1–2 words, lowercase.
- Use ONLY what's supported by the provided explanation (no external knowledge).

Return ONLY a comma-separated list (example: duty, action, detachment).
"""


def generate_brief_explanation(commentary_text: str) -> str:
    """
    Generate a brief explanation derived ONLY from Sivananda commentary (siva.ec).
    """
    if not (commentary_text or "").strip():
        return ""
    response = call_ollama(commentary_text.strip(), _EXPLANATION_SYSTEM_PROMPT)
    if not response:
        return ""
    return _clamp_sentences(response.strip(), max_sentences=3)


def generate_themes(explanation: str):
    """
    Extract 2–5 clean themes from the explanation.
    """
    if not (explanation or "").strip():
        return []
    response = call_ollama(explanation.strip(), _THEMES_SYSTEM_PROMPT)
    if not response:
        return []
    raw = [t for t in response.split(",")]
    cleaned = []
    for t in raw:
        ct = _clean_theme(t)
        # Enforce 1–2 words max
        if ct and len(ct.split()) <= 2 and ct not in cleaned:
            cleaned.append(ct)
    if len(cleaned) < 2:
        # minimal deterministic fallback to satisfy schema
        fallback_pool = ["duty", "action", "attachment", "self-control", "knowledge", "devotion", "detachment", "discipline"]
        for cand in fallback_pool:
            if cand not in cleaned:
                cleaned.append(cand)
            if len(cleaned) >= 2:
                break
    return cleaned[:4]
