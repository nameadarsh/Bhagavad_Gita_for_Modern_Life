from __future__ import annotations

import uuid
import os
from typing import Dict, Any

from fastapi import APIRouter, Request, HTTPException

from app.models.schemas import ChatRequest, ChatResponse, Verse


router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, request: Request):
    state = request.app.state
    conversations = state.conversations_logger
    analytics = state.analytics_logger

    session_id = req.session_id or str(uuid.uuid4())
    query = req.query.strip()

    # check if RAG is available
    if not getattr(state, "rag_available", False):
        return ChatResponse(
            session_id=session_id,
            answer="I apologize, but my spiritual archives are currently being reorganized. Please try again in a moment.",
            verse=Verse(
                id="N/A",
                chapter=0,
                verse=0,
                speaker="System",
                sanskrit="",
                english="Retrieval Unavailable",
                brief_explanation="The backend system was unable to load the sacred texts.",
                themes=[]
            ),
            meta={"fallback": True, "error": "RAG_UNAVAILABLE"}
        )

    # session store
    session = state.sessions.setdefault(session_id, {"history": [], "summary": ""})

    # refine query (optional)
    refined = state.query_service.refine(query)

    # retrieval (support "ask this shlok": skip FAISS when verse_id provided)
    if req.verse_id:
        verse = state.verses_by_id.get(req.verse_id)
        if not verse:
            raise HTTPException(status_code=404, detail="Verse not found")
        retrieval_meta = {"mode": "direct", "verse_id": req.verse_id}
    else:
        try:
            verse, retrieval_meta = state.rag_service.get_relevant_verse(refined)
        except Exception as e:
            analytics.error(f"faiss_error session={session_id} err={e}")
            raise HTTPException(status_code=503, detail="Retrieval unavailable. Please try again.") from e

    chapter_summary = None
    ch = int(verse.get("chapter"))
    if ch in state.chapters:
        # optional summary placeholder (no heavy logic)
        chapter_summary = f"Chapter {ch} contains {state.chapters[ch].get('verse_count')} verses."

    # generate answer
    try:
        llm_result = state.llm_service.answer(
            query=query,
            verse=verse,
            chapter_summary=chapter_summary,
            voice_output=bool(req.voice_output),
        )
        answer = llm_result["answer"]
        is_fallback = llm_result["fallback"]
    except Exception as e:
        analytics.error(f"llm_error session={session_id} err={e}")
        is_fallback = True
        answer = (
            f"{verse.get('brief_explanation')}\n\n"
            f"Verse ({verse.get('id')}): {verse.get('english')}"
        ).strip()

    # log interaction
    conversations.info(
        f"session={session_id} query={query!r} refined={refined!r} verse_id={retrieval_meta.get('verse_id')} score={retrieval_meta.get('score')} fallback={is_fallback}"
    )
    analytics.info(
        f"event=chat session={session_id} verse_id={retrieval_meta.get('verse_id')} provider={os.getenv('LLM_PROVIDER','')} fallback={is_fallback}"
    )

    session["history"].append({"query": query, "refined": refined, "verse_id": retrieval_meta.get("verse_id")})
    if len(session["history"]) > 8 and not session.get("summary"):
        session["summary"] = state.summarizer_service.summarize(
            previous_summary=session.get("summary", ""),
            query=query,
            verse=verse,
        )

    return ChatResponse(
        session_id=session_id,
        answer=answer,
        verse=Verse(**verse),
        meta={
            "retrieval": retrieval_meta, 
            "chapter_summary": chapter_summary, 
            "summary": session.get("summary", ""),
            "fallback": is_fallback
        },
    )

