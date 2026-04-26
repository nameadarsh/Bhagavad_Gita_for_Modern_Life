from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import faiss
import re
import logging
from fastembed import TextEmbedding

_EMBEDDER = None


def get_embedder():
    global _EMBEDDER
    if _EMBEDDER is None:
        try:
            # Lazy load the small model only when first needed
            # Using all-MiniLM-L6-v2 which matches the current index dimension (384)
            _EMBEDDER = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
        except Exception as e:
            # Log but don't crash; retrieval will fail gracefully
            logging.getLogger("analytics").error(f"failed_to_load_embedder: {e}")
            return None
    return _EMBEDDER


_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "into", "your", "you", "are", "was",
    "were", "have", "has", "had", "not", "but", "can", "all", "its", "his", "her", "their",
    "about", "what", "when", "where", "which", "while", "than", "then", "also", "only",
}


class RagService:
    def __init__(
        self,
        *,
        verses_by_id: Dict[str, Dict[str, Any]],
        metadata: List[Dict[str, Any]],
        faiss_index: faiss.Index,
    ) -> None:
        self.verses_by_id = verses_by_id
        self.metadata = metadata
        self.index = faiss_index

    def embed_query(self, query: str) -> Optional[np.ndarray]:
        embedder = get_embedder()
        if embedder is None:
            return None

        # e5 models: prefix query with "query: "
        # fastembed.embed returns a generator
        embeddings = list(embedder.embed([f"query: {query}"]))
        if not embeddings:
            return None
        
        vec = embeddings[0].astype("float32")
        faiss.normalize_L2(np.expand_dims(vec, axis=0))
        return vec

    def search_index(self, vector: np.ndarray, top_k: int = 1) -> List[Tuple[int, float]]:
        xq = np.expand_dims(vector.astype("float32"), axis=0)
        faiss.normalize_L2(xq)
        distances, indices = self.index.search(xq, top_k)
        hits: List[Tuple[int, float]] = []
        for idx, score in zip(indices[0].tolist(), distances[0].tolist()):
            if idx == -1:
                continue
            hits.append((idx, float(score)))
        return hits

    def _tokenize_keywords(self, text: str) -> List[str]:
        toks = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", (text or "").lower())
        out = []
        for t in toks:
            if t in _STOPWORDS:
                continue
            if t not in out:
                out.append(t)
        return out

    def _query_keywords(self, query: str) -> List[str]:
        return self._tokenize_keywords(query)

    def _verse_keywords(self, meta: Dict[str, Any], verse: Dict[str, Any]) -> List[str]:
        kws = []
        for src in (meta.get("keywords", []) or []):
            if isinstance(src, str):
                for t in self._tokenize_keywords(src):
                    if t not in kws:
                        kws.append(t)
        for src in (meta.get("themes", []) or []):
            if isinstance(src, str):
                for t in self._tokenize_keywords(src):
                    if t not in kws:
                        kws.append(t)
        # fallback from verse content if metadata is old
        if not kws:
            txt = f"{verse.get('brief_explanation','')} {' '.join(verse.get('themes',[]) or [])}"
            kws = self._tokenize_keywords(txt)
        return kws

    def _overlap_score(self, query_keywords: List[str], verse_keywords: List[str]) -> int:
        if not query_keywords or not verse_keywords:
            return 0
        qset = set(query_keywords)
        vset = set(verse_keywords)
        return len(qset.intersection(vset))

    def _classify_intent(self, query: str) -> str:
        q = query.lower()
        
        # Emotional Intents
        if any(w in q for w in ["motivation", "inspire", "energy", "tired", "give up", "unmotivated"]):
            return "emotional_motivation"
        if any(w in q for w in ["sad", "depressed", "unhappy", "sorrow", "grief", "pain", "crying"]):
            return "emotional_sadness"
        if any(w in q for w in ["confused", "unsure", "doubt", "not sure", "lost", "uncertain"]):
            return "emotional_confusion"
        if any(w in q for w in ["fear", "afraid", "scared", "anxious", "worry", "stress", "tension"]):
            return "emotional_anxiety"
            
        # Situational Intents
        if any(w in q for w in ["decision", "choice", "choose", "what to do"]):
            return "situational_decision"
        if any(w in q for w in ["right vs benefit", "justify", "moral", "ethics", "wrong"]):
            return "situational_moral_conflict"
        if any(w in q for w in ["conflict", "fight", "argument", "enemy", "rival"]):
            return "situational_conflict"
            
        # Knowledge Intents
        if any(w in q for w in ["what is", "who is", "explain", "meaning of", "tell me about"]):
            return "knowledge_query"
            
        return "general"

    def _get_theme_mapping(self, intent: str) -> List[str]:
        mapping = {
            "emotional_motivation": ["duty", "action", "discipline", "purpose", "yoga", "strength"],
            "emotional_sadness": ["soul", "eternal", "detachment", "peace", "devotion"],
            "emotional_confusion": ["dharma", "karma", "guidance", "wisdom", "knowledge"],
            "emotional_anxiety": ["detachment", "self", "faith", "equanimity", "peace"],
            "situational_decision": ["duty", "dharma", "action", "wisdom", "results"],
            "situational_moral_conflict": ["dharma", "truth", "righteousness", "detachment"],
            "situational_conflict": ["duty", "battle", "strength", "non-attachment", "enemies"],
            "knowledge_query": ["philosophy", "bhakti", "karma", "jnana", "yoga"],
        }
        return mapping.get(intent, [])

    def _classify_verse_type(self, verse: Dict[str, Any]) -> str:
        themes = [t.lower() for t in (verse.get("themes", []) or [])]
        explanation = (verse.get("brief_explanation", "") or "").lower()
        
        # Priority: Condemnation/Warning
        if any(w in explanation for w in ["ruined", "destroy", "evil", "hell", "demon", "darkness"]):
            return "condemnation"
        if any(w in explanation for w in ["beware", "caution", "avoid", "leads to misery"]):
            return "warning"
        
        # Guidance/Instruction
        if any(w in explanation for w in ["should", "must", "act", "do your", "perform"]):
            if any(w in explanation for w in ["duty", "action", "work", "karma"]):
                return "guidance"
            return "instruction"
        
        if any(w in themes for w in ["duty", "action", "karma", "yoga"]):
            return "guidance"
            
        return "philosophical"

    def get_verse_by_id(self, verse_id: str) -> Optional[Dict[str, Any]]:
        return self.verses_by_id.get(verse_id)

    def get_relevant_verse(self, query: str, intent: str = "general", themes: List[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Returns: (verse, retrieval_meta)
        """
        user_intent = intent
        query_themes = themes or []
        
        # If intent is general, try to re-classify if keyword triggers exist
        if user_intent == "general":
            user_intent = self._classify_intent(query)

        vector = self.embed_query(query)
        if vector is None:
            # Fallback to curated verse 2.47 if embedding fails
            fallback_id = "2.47"
            verse = self.get_verse_by_id(fallback_id)
            return verse, {"mode": "fallback", "verse_id": fallback_id, "error": "EMBEDDING_FAILED"}

        hits = self.search_index(vector, top_k=10)
        if not hits:
            raise RuntimeError("No FAISS hits")

        query_keywords = self._query_keywords(query)
        # Use mapped themes if query themes are empty
        intent_themes = query_themes if query_themes else self._get_theme_mapping(user_intent)
        
        analytics = logging.getLogger("analytics")
        
        candidates = []
        for idx, score in hits:
            meta = self.metadata[idx] if idx < len(self.metadata) else {}
            verse_id = meta.get("id")
            if not verse_id:
                continue
            verse = self.get_verse_by_id(verse_id)
            if not verse:
                continue
            
            v_keywords = self._verse_keywords(meta, verse)
            v_themes = [t.lower() for t in (verse.get("themes", []) or [])]
            
            overlap = self._overlap_score(query_keywords, v_keywords)
            
            # Theme overlap score
            theme_overlap = 0
            if intent_themes:
                theme_overlap = len(set(intent_themes).intersection(set(v_themes)))
            
            # Intent-aware reranking
            verse_type = self._classify_verse_type(verse)
            
            # Final score: combine keyword/theme overlap with semantic similarity
            # Since the index uses IndexFlatIP (Inner Product) and vectors are normalized,
            # the FAISS score is already the Cosine Similarity (range -1 to 1, usually 0 to 1).
            semantic_similarity = max(0.0, float(score))
            
            semantic_weight = 4.0  # Increase weight of semantic match
            final_score = (float(overlap) * 1.5) + (float(theme_overlap) * 2.0) + (semantic_similarity * semantic_weight)
            
            # INTENT BONUS
            intent_bonus = 0
            if user_intent.startswith("situational") or user_intent.startswith("emotional"):
                if verse_type in ["guidance", "instruction"]:
                    intent_bonus = 3.0
                    final_score += intent_bonus
            
            # PENALTY for negative verses in sensitive intents
            penalty = 0
            if user_intent.startswith("emotional") or "conflict" in user_intent:
                if verse_type == "condemnation":
                    penalty = 5.0
                    final_score -= penalty

            candidates.append(
                {
                    "idx": idx,
                    "faiss_score": score,
                    "semantic_similarity": semantic_similarity,
                    "overlap": overlap,
                    "theme_overlap": theme_overlap,
                    "intent_bonus": intent_bonus,
                    "penalty": penalty,
                    "final_score": final_score,
                    "verse_id": verse_id,
                    "verse": verse,
                    "verse_type": verse_type,
                    "themes": v_themes,
                    "keywords": v_keywords,
                }
            )

        if not candidates:
            analytics.warning(f"retrieval_fail query={query!r} reason=no_candidates_after_filtering")
            raise RuntimeError("No valid candidates after retrieval")

        # Rerank by final_score (desc)
        candidates.sort(key=lambda c: c["final_score"], reverse=True)
        
        # Log top 5 candidates for debugging (increased from 3)
        for i, c in enumerate(candidates[:5]):
            analytics.info(
                f"retrieval_candidate rank={i} verse={c['verse_id']} final={c['final_score']:.2f} "
                f"sim={c['semantic_similarity']:.4f} faiss_dist={c['faiss_score']:.4f} "
                f"overlap={c['overlap']} theme_overlap={c['theme_overlap']} "
                f"bonus={c['intent_bonus']} penalty={c['penalty']}"
            )

        # Threshold Check - The user wants to avoid unnecessary fallback.
        # We only trigger fallback if candidates are empty (already handled)
        # or if some critical system error occurs.
        best = candidates[0]
        
        analytics.info(f"retrieval_success best_verse={best['verse_id']} score={best['final_score']:.2f} intent={user_intent}")

        return best["verse"], {
            "score": best["faiss_score"],
            "rerank_overlap": best["overlap"],
            "theme_overlap": best["theme_overlap"],
            "final_score": best["final_score"],
            "user_intent": user_intent,
            "verse_type": best["verse_type"],
            "faiss_idx": best["idx"],
            "verse_id": best["verse_id"],
            "query_keywords": query_keywords,
        }

