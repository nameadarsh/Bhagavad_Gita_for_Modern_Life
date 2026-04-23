import json
import re
from utils.logger import error_logger, pipeline_logger

_CHAPTER_VERSE_MAX = {
    1: 47, 2: 72, 3: 43, 4: 42, 5: 29, 6: 47,
    7: 30, 8: 28, 9: 34, 10: 42, 11: 55, 12: 20,
    13: 35, 14: 27, 15: 20, 16: 24, 17: 28, 18: 78
}

def _is_valid_single_verse(verse: str) -> bool:
    return bool(re.fullmatch(r"\d+", str(verse).strip()))

def validate_dataset(records, *, allow_non700: bool = False) -> bool:
    """
    Strict dataset validation (structured JSON dataset pipeline).
    Enforces:
    - ~700 verses (hard-fail unless allow_non700=True)
    - no duplicate ids
    - no duplicate (chapter, verse)
    - verse numbers valid per chapter
    - no empty Sanskrit/English
    """
    pipeline_logger.info("Starting dataset validation.")
    is_valid = True

    seen_ids = set()
    seen_chv = set()

    for i, r in enumerate(records):
        rid = r.get("id")
        ch = r.get("chapter")
        v = r.get("verse")

        for field in ["id", "chapter", "verse", "speaker", "sanskrit", "english", "brief_explanation", "themes"]:
            val = r.get(field)
            if val is None:
                error_logger.error(f"Record index {i} missing field: {field}")
                is_valid = False
            elif isinstance(val, str) and not val.strip() and field in ["id", "sanskrit", "english"]:
                error_logger.error(f"Record index {i} has empty field: {field}")
                is_valid = False
            elif field == "speaker" and (not isinstance(val, str) or not val.strip()):
                error_logger.error(f"Record index {i} has empty speaker")
                is_valid = False
            elif field == "brief_explanation" and (not isinstance(val, str) or not val.strip()):
                error_logger.error(f"Record index {i} has empty brief_explanation")
                is_valid = False
            elif field == "themes":
                if not isinstance(val, list) or len(val) == 0:
                    error_logger.error(f"Record index {i} has empty themes")
                    is_valid = False
                else:
                    if not (2 <= len(val) <= 4):
                        error_logger.error(f"Record index {i} has invalid theme count (2–4): {val}")
                        is_valid = False
                    for t in val:
                        if not isinstance(t, str) or not t.strip():
                            error_logger.error(f"Record index {i} has malformed theme: {t!r}")
                            is_valid = False

        if isinstance(rid, str):
            if rid in seen_ids:
                error_logger.error(f"Duplicate id: {rid}")
                is_valid = False
            seen_ids.add(rid)

        try:
            ch_i = int(ch)
            v_i = int(v)
        except Exception:
            error_logger.error(f"Invalid chapter/verse types at index {i}: {ch}/{v}")
            is_valid = False
            continue

        if ch_i not in _CHAPTER_VERSE_MAX:
            error_logger.error(f"Invalid chapter number at index {i}: {ch_i}")
            is_valid = False
        else:
            if not (1 <= v_i <= _CHAPTER_VERSE_MAX[ch_i]):
                error_logger.error(f"Invalid verse number at index {i}: chapter {ch_i} verse {v_i}")
                is_valid = False

        chv = (ch_i, v_i)
        if chv in seen_chv:
            error_logger.error(f"Duplicate (chapter, verse): {ch_i}:{v_i}")
            is_valid = False
        seen_chv.add(chv)

    total = len(records)
    if not allow_non700:
        if not (650 <= total <= 750):
            error_logger.error(f"Expected ~700 verses, got {total}. Use --allow-non700 only for testing.")
            is_valid = False
    else:
        pipeline_logger.warning(f"--allow-non700 enabled; verse count is {total}")

    if is_valid:
        pipeline_logger.info("Dataset validation passed.")
    else:
        error_logger.error("Dataset validation failed.")
    return is_valid

def validate_records(records):
    """
    Validates a list of records for structural integrity.
    """
    pipeline_logger.info("Starting validation of records.")
    
    is_valid = True
    seen_ids = set()
    
    for i, record in enumerate(records):
        # 1. Non-empty required fields
        required_fields = ["chapter", "verse", "sanskrit", "english"]
        # Allow empty brief_explanation or themes if LLM fails, but warn.
        # Actually the strict requirements say "All required fields are non-empty"
        # We will check them all.
        all_required = required_fields + ["brief_explanation", "themes", "embedding_text"]
        
        for field in all_required:
            val = record.get(field)
            if val is None or (isinstance(val, str) and not val.strip()) or (isinstance(val, list) and len(val) == 0):
                error_logger.error(f"Record index {i} (Ch {record.get('chapter')} V {record.get('verse')}) missing required field: {field}")
                is_valid = False
                
        # 2. Duplicate chapter/verse check
        ch_v = f"{record.get('chapter')}-{record.get('verse')}"
        if ch_v in seen_ids:
            error_logger.error(f"Duplicate chapter/verse found: {ch_v}")
            is_valid = False
        else:
            if str(record.get('chapter', '')).strip() and str(record.get('verse', '')).strip():
                seen_ids.add(ch_v)
            
    # 3. Total verse count sanity check
    # The Gita has exactly 700 verses in total. 
    total_verses = len(seen_ids)
    if total_verses == 0:
        error_logger.error("No valid verses found.")
        is_valid = False
    elif total_verses < 10:
        pipeline_logger.warning(f"Very low verse count: {total_verses}")
    elif total_verses > 750:
        error_logger.error(f"Unusually high verse count: {total_verses}. The Gita has 700 verses.")
        is_valid = False
        
    if is_valid:
        pipeline_logger.info(f"Validation passed successfully for {total_verses} records.")
    else:
        error_logger.error("Validation failed. Check logs for details.")
        
    return is_valid

def validate_faiss_consistency(json_path, metadata_path, index_size):
    """
    Checks if the FAISS index size matches the JSON and metadata sizes.
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
            
        is_valid = True
        if len(data) != index_size:
            error_logger.error(f"FAISS index size ({index_size}) does not match JSON size ({len(data)})")
            is_valid = False
            
        if len(metadata) != index_size:
            error_logger.error(f"FAISS index size ({index_size}) does not match metadata size ({len(metadata)})")
            is_valid = False
            
        if is_valid:
            pipeline_logger.info("FAISS consistency check passed.")
        return is_valid
        
    except Exception as e:
        error_logger.error(f"Validation failed during consistency check: {e}")
        return False
