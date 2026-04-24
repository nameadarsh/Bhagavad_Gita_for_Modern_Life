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

    # refine query and analyze intent/outcome/themes
    analysis = state.query_service.refine(query)
    refined_query = analysis.get("clean_query", query)
    user_intent = analysis.get("intent", "knowledge")
    desired_outcome = analysis.get("desired_outcome", "wisdom")
    query_themes = analysis.get("themes", [])

    # retrieval (support "ask this shlok": skip FAISS when verse_id provided)
    if req.verse_id:
        verse = state.verses_by_id.get(req.verse_id)
        if not verse:
            raise HTTPException(status_code=404, detail="Verse not found")
        retrieval_meta = {
            "mode": "direct", 
            "verse_id": req.verse_id, 
            "user_intent": user_intent,
            "desired_outcome": desired_outcome,
            "query_themes": query_themes
        }
    else:
        try:
            verse, retrieval_meta = state.rag_service.get_relevant_verse(
                query=refined_query,
                intent=user_intent,
                themes=query_themes
            )
            # Ensure analysis info is preserved
            retrieval_meta.update({
                "user_intent": user_intent,
                "desired_outcome": desired_outcome,
                "query_themes": query_themes
            })
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
            intent=user_intent,
            desired_outcome=desired_outcome
        )
        answer = llm_result["answer"]
        is_fallback = llm_result["fallback"]
    except Exception as e:
        analytics.error(f"llm_error session={session_id} err={e}")
        is_fallback = True
        # Use the same interpretive fallback if the service call fails
        answer = state.llm_service._fallback_answer(verse, user_intent, desired_outcome)

    # log interaction
    conversations.info(
        f"session={session_id} query={query!r} refined={refined_query!r} verse_id={retrieval_meta.get('verse_id')} score={retrieval_meta.get('score')} fallback={is_fallback}"
    )
    analytics.info(
        f"event=chat session={session_id} verse_id={retrieval_meta.get('verse_id')} provider={os.getenv('LLM_PROVIDER','')} fallback={is_fallback}"
    )

    session["history"].append({"query": query, "refined": refined_query, "verse_id": retrieval_meta.get("verse_id")})

    if len(session["history"]) % 3 == 0:
        session["summary"] = state.summarizer_service.summarize(
            previous_summary=session["summary"],
            query=query,
            verse=verse
        )

    clean_meta = {
        "verse_id": retrieval_meta.get("verse_id"),
        "chapter_summary": chapter_summary,
        "summary": session.get("summary", ""),
        "fallback": is_fallback
    }

    return ChatResponse(
        session_id=session_id,
        answer=answer,
        verse=Verse(**verse),
        meta=clean_meta,
    )

