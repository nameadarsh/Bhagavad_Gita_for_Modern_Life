from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import faiss
import re
from sentence_transformers import SentenceTransformer

DEBUG = False
_EMBEDDER = None


def get_embedder():
    global _EMBEDDER
    if _EMBEDDER is None:
        try:
            # Lazy load the small model only when first needed
            _EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        except Exception as e:
            # Log but don't crash; retrieval will fail gracefully
            import logging
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
        vec = embedder.encode([f"query: {query}"], convert_to_numpy=True)
        vec = vec.astype("float32")
        faiss.normalize_L2(vec)
        return vec[0]

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
        if any(w in q for w in ["confused", "torn", "unsure", "doubt"]):
            return "confusion"
        if any(w in q for w in ["right vs benefit", "justify actions", "morally right", "personally benefit"]):
            return "moral_conflict"
        if any(w in q for w in ["fear", "afraid", "scared", "anxious"]):
            return "fear"
        if any(w in q for w in ["duty", "obligation", "responsibility"]):
            return "duty_confusion"
        if any(w in q for w in ["guide", "help", "how to", "advice"]):
            return "guidance_needed"
        if any(w in q for w in ["bad", "evil", "wrong", "sin"]):
            return "negative_behavior"
        return "general"

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

    def get_relevant_verse(self, query: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Returns: (verse, retrieval_meta)
        """
        user_intent = self._classify_intent(query)
        vector = self.embed_query(query)
        if vector is None:
            # Fallback to a random verse if embedding fails (e.g. model failed to load)
            import random
            verse_id = list(self.verses_by_id.keys())[random.randint(0, len(self.verses_by_id) - 1)]
            return self.verses_by_id[verse_id], {"mode": "fallback", "verse_id": verse_id, "error": "EMBEDDING_FAILED"}

        hits = self.search_index(vector, top_k=5)
        if not hits:
            raise RuntimeError("No FAISS hits")

        query_keywords = self._query_keywords(query)
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
            overlap = self._overlap_score(query_keywords, v_keywords)
            
            # Intent-aware reranking
            verse_type = self._classify_verse_type(verse)
            final_score = float(overlap)
            
            # INTENT BONUS
            if user_intent in ["confusion", "moral_conflict", "guidance_needed"]:
                if verse_type in ["guidance", "instruction"]:
                    final_score += 2.0
            
            # PENALTY
            if user_intent in ["confusion", "moral_conflict"]:
                if verse_type == "condemnation":
                    final_score -= 2.0

            candidates.append(
                {
                    "idx": idx,
                    "faiss_score": score,
                    "overlap": overlap,
                    "final_score": final_score,
                    "verse_id": verse_id,
                    "verse": verse,
                    "verse_type": verse_type,
                    "themes": meta.get("themes", []),
                    "keywords": v_keywords,
                }
            )

        if not candidates:
            raise RuntimeError("No valid candidates after retrieval")

        # rerank by final_score, then faiss score
        candidates.sort(key=lambda c: (c["final_score"], c["faiss_score"]), reverse=True)
        best = candidates[0]

        if DEBUG:
            print(f"🎯 User Intent: {user_intent}")
            print("🔎 FAISS top 5 candidates with reranking:")
            for c in candidates[:5]:
                print(
                    f" - verse={c['verse_id']} type={c['verse_type']} overlap={c['overlap']} "
                    f"final={c['final_score']:.1f} faiss={c['faiss_score']:.4f} themes={c['themes']}"
                )
            print(f"✅ Final selected verse: {best['verse_id']}")

        return best["verse"], {
            "score": best["faiss_score"],
            "rerank_overlap": best["overlap"],
            "final_score": best["final_score"],
            "user_intent": user_intent,
            "verse_type": best["verse_type"],
            "faiss_idx": best["idx"],
            "verse_id": best["verse_id"],
            "query_keywords": query_keywords,
        }

