from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import json
import os
import re
from utils.logger import pipeline_logger, error_logger

# Load model once
pipeline_logger.info("Loading embedding model intfloat/multilingual-e5-base...")
try:
    model = SentenceTransformer("intfloat/multilingual-e5-base")
except Exception as e:
    error_logger.error(f"Failed to load embedding model: {e}")
    model = None

def _clean_block(s: str) -> str:
    s = (s or "").strip()
    # remove excessive whitespace and empty lines
    lines = [ln.strip() for ln in s.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)

_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "into", "your", "you", "are", "was",
    "were", "have", "has", "had", "not", "but", "can", "all", "its", "his", "her", "their",
    "about", "what", "when", "where", "which", "while", "than", "then", "also", "only",
}
_FOCUS = ["duty", "confusion", "action", "morality", "attachment", "fear", "decision"]

def generate_keywords(explanation, themes):
    """
    Extract 5-10 important keywords from explanation + themes.
    Prioritize moral-decision/action-related vocabulary.
    """
    explanation = (explanation or "").lower()
    themes = [t.strip().lower() for t in (themes or []) if isinstance(t, str) and t.strip()]

    tokens = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", explanation)
    candidates = []

    # keep focus words if present
    for w in _FOCUS:
        if w in explanation and w not in candidates:
            candidates.append(w)

    # include theme tokens first
    for t in themes:
        for w in re.findall(r"[a-zA-Z][a-zA-Z\-]{1,}", t):
            w = w.lower()
            if w not in _STOPWORDS and w not in candidates:
                candidates.append(w)

    # noun-ish heuristic: longer informative tokens from explanation
    for tok in tokens:
        t = tok.lower()
        if t in _STOPWORDS:
            continue
        if len(t) < 4:
            continue
        if t not in candidates:
            candidates.append(t)
        if len(candidates) >= 10:
            break

    # ensure at least 5
    for w in _FOCUS:
        if len(candidates) >= 5:
            break
        if w not in candidates:
            candidates.append(w)

    return ", ".join(candidates[:10])

def build_embedding_text(record: dict) -> str:
    themes = [t.strip().lower() for t in (record.get("themes", []) or []) if isinstance(t, str) and t.strip()]
    themes_str = ", ".join(themes)
    expl = _clean_block(record.get("brief_explanation", "")).replace("\n", " ")
    keywords = generate_keywords(expl, themes)
    record["keywords"] = [k.strip() for k in keywords.split(",") if k.strip()]
    embedding_text = (
        f"Meaning: {expl}\n"
        f"Themes: {themes_str}\n"
        f"Context: {expl}\n"
        f"Keywords: {keywords}"
    ).strip()
    return embedding_text

def generate_embeddings_and_index(records, index_output_path, metadata_output_path):
    if not model:
        error_logger.error("Model not loaded, cannot generate embeddings.")
        return False
        
    pipeline_logger.info(f"Generating embeddings for {len(records)} records...")
    
    texts_to_embed = []
    metadata = []
    
    for i, record in enumerate(records):
        embedding_text = build_embedding_text(record)
        record["embedding_text"] = embedding_text
        # e5 models recommend prefixing with 'passage: ' for indexed documents
        texts_to_embed.append(f"passage: {embedding_text}")
        
        # Store metadata
        meta = {
            "id": record.get("id"),
            "chapter": record.get("chapter"),
            "verse": record.get("verse"),
            "themes": record.get("themes", []),
            "keywords": record.get("keywords", []),
        }
        metadata.append(meta)
        
    try:
        embeddings = model.encode(texts_to_embed, show_progress_bar=True, convert_to_numpy=True)
        # Normalize embeddings for cosine similarity
        faiss.normalize_L2(embeddings)
        
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatIP(dimension) # Inner Product (Cosine Similarity since normalized)
        index.add(embeddings)
        
        os.makedirs(os.path.dirname(index_output_path), exist_ok=True)
        faiss.write_index(index, index_output_path)
        pipeline_logger.info(f"Saved FAISS index to {index_output_path}")
        
        with open(metadata_output_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        pipeline_logger.info(f"Saved metadata to {metadata_output_path}")
        
        return True
    except Exception as e:
        error_logger.error(f"Failed to generate embeddings and index: {e}")
        return False


def generate_embeddings_and_index_from_json(gita_json_path: str, index_output_path: str, metadata_output_path: str) -> bool:
    try:
        with open(gita_json_path, "r", encoding="utf-8") as f:
            records = json.load(f)
        if not isinstance(records, list):
            raise ValueError("gita.json must be a list of verse objects")
    except Exception as e:
        error_logger.error(f"Failed to load gita.json from {gita_json_path}: {e}")
        return False

    return generate_embeddings_and_index(records, index_output_path, metadata_output_path)
