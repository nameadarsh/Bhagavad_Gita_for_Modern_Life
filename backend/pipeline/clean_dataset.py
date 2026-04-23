import re
from typing import Any, Dict, List, Optional, Tuple

from utils.logger import pipeline_logger, error_logger


_CHAPTER_VERSE_MAX = {
    1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47,
    7: 30, 8: 28, 9: 34, 10: 42, 11: 55, 12: 20,
    13: 35, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78
}

_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")


def _first_nonempty(*candidates: Optional[str]) -> str:
    for c in candidates:
        if isinstance(c, str) and c.strip():
            return c.strip()
    return ""


def _extract_english(src: Dict[str, Any]) -> str:
    """
    Mandatory author selection:
    - Use ONLY Sivananda translation: src["siva"]["et"]
    - Fallback ONLY if Sivananda is completely missing.
    """
    siva = src.get("siva")
    if isinstance(siva, dict):
        et = _first_nonempty(siva.get("et"))
        if et:
            return et

    # Allowed fallback: only when siva is missing
    return _first_nonempty(src.get("english"), src.get("translation"), src.get("et"))


def _extract_sanskrit(src: Dict[str, Any]) -> str:
    # Mandatory mapping: Sanskrit from `slok` (dataset field)
    return _first_nonempty(src.get("slok"))


def _extract_commentary(src: Dict[str, Any]) -> str:
    """
    Mandatory author selection:
    - Use ONLY Sivananda commentary: src["siva"]["ec"]
    """
    siva = src.get("siva")
    if isinstance(siva, dict):
        return _first_nonempty(siva.get("ec"))
    return ""

def _normalize_speaker(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return "Unknown"

    # common Sanskrit forms in this dataset
    mappings = {
        "श्रीभगवान्": "Krishna",
        "श्री भगवान्": "Krishna",
        "अर्जुन उवाच": "Arjuna",
        "अर्जुनः उवाच": "Arjuna",
        "संजय उवाच": "Sanjaya",
        "सञ्जय उवाच": "Sanjaya",
        "धृतराष्ट्र उवाच": "Dhritarashtra",
        "धृतराष्ट्रः उवाच": "Dhritarashtra",
    }
    if s in mappings:
        return mappings[s]

    # If already English-ish, keep as-is (trim noise)
    if re.search(r"[A-Za-z]", s):
        s2 = re.sub(r"\s+", " ", s).strip()
        return s2 if s2 else "Unknown"

    # Infer from patterns only if clearly present
    if "उवाच" in s:
        if "अर्जुन" in s:
            return "Arjuna"
        if "संजय" in s or "सञ्जय" in s:
            return "Sanjaya"
        if "धृतराष्ट्र" in s:
            return "Dhritarashtra"
        if "भगवान" in s:
            return "Krishna"

    return "Unknown"


def _extract_speaker(src: Dict[str, Any]) -> str:
    raw = _first_nonempty(src.get("speaker"))
    if raw:
        norm = _normalize_speaker(raw)
        # If raw is present but not recognized, try slok-based inference before giving up.
        if norm != "Unknown":
            return norm

    # Fallback inference (no LLM): look for clear "उवाच" pattern in Sanskrit slok text.
    slok = _first_nonempty(src.get("slok"))
    if slok and "उवाच" in slok:
        # e.g. "धृतराष्ट्र उवाच | ..." or "धृतराष्ट्र उवाच । ..."
        if "|" in slok:
            head = slok.split("|", 1)[0].strip()
        elif "।" in slok:
            head = slok.split("।", 1)[0].strip()
        else:
            head = slok.strip()
        head = re.sub(r"\s+", " ", head).strip(" ।|")
        return _normalize_speaker(head)

    return "Unknown"


def _normalize_sanskrit(s: str) -> str:
    s = (s or "").strip()
    # remove common verse number markers like ||9-1|| or ॥9-1॥
    s = re.sub(r"\|\|?\s*\d+\s*[-–]\s*\d+\s*\|\|?", "", s)
    s = re.sub(r"[०-९0-9]+\s*[-–]\s*[०-९0-9]+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _normalize_english(s: str) -> str:
    s = (s or "").strip()
    # remove leading verse numbering like "9.1 " or "1.1 "
    s = re.sub(r"^\s*\d+\s*\.\s*\d+\s*", "", s)
    s = re.sub(r"^\s*\d+\s*\.\s*", "", s)
    # collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _valid_chapter_verse(ch: int, v: int) -> bool:
    if ch not in _CHAPTER_VERSE_MAX:
        return False
    return 1 <= v <= _CHAPTER_VERSE_MAX[ch]


def clean_verses(raw_verses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize dataset verse objects into the strict structure:
    {
      "id": "1_1",
      "chapter": 1,
      "verse": 1,
      "sanskrit": "...",
      "english": "...",
      "brief_explanation": "",
      "themes": []
    }

    Removes transliteration/word-meaning/noise by only carrying through these fields.
    """
    cleaned: List[Dict[str, Any]] = []
    seen: set[Tuple[int, int]] = set()
    seen_ids: set[str] = set()

    for i, src in enumerate(raw_verses):
        if not isinstance(src, dict):
            error_logger.error(f"Skipping non-dict verse at index {i}")
            continue

        try:
            chapter = int(src.get("chapter"))
            verse = int(src.get("verse"))
        except Exception:
            error_logger.error(f"Skipping verse with invalid chapter/verse at index {i}: {src.get('chapter')}/{src.get('verse')}")
            continue

        if not _valid_chapter_verse(chapter, verse):
            error_logger.error(f"Skipping invalid chapter/verse: {chapter}:{verse}")
            continue

        if (chapter, verse) in seen:
            error_logger.error(f"Duplicate (chapter, verse) encountered: {chapter}:{verse}")
            continue
        seen.add((chapter, verse))

        vid = f"{chapter}_{verse}"
        if vid in seen_ids:
            error_logger.error(f"Duplicate id encountered: {vid}")
            continue
        seen_ids.add(vid)

        sanskrit = _normalize_sanskrit(_extract_sanskrit(src))
        english = _normalize_english(_extract_english(src))
        commentary = _first_nonempty(_extract_commentary(src))
        speaker = _extract_speaker(src)

        # Reject corrupted/missing entries
        if not sanskrit or not _DEVANAGARI_RE.search(sanskrit):
            error_logger.error(f"Skipping verse {vid} due to missing/invalid Devanagari Sanskrit")
            continue
        if not english:
            error_logger.error(f"Skipping verse {vid} due to missing English translation")
            continue
        if not commentary:
            error_logger.error(f"Skipping verse {vid} due to missing Sivananda commentary (siva.ec)")
            continue
        if not isinstance(speaker, str) or not speaker.strip():
            speaker = "Unknown"

        cleaned.append(
            {
                "id": vid,
                "chapter": chapter,
                "verse": verse,
                "speaker": speaker,
                "sanskrit": sanskrit,
                "english": english,
                "_commentary": commentary,  # internal only; removed before final JSON output
                "brief_explanation": "",
                "themes": [],
            }
        )

    cleaned.sort(key=lambda r: (r["chapter"], r["verse"]))
    pipeline_logger.info(f"Cleaned dataset: {len(cleaned)} valid verses")
    return cleaned

