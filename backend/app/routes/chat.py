from __future__ import annotations

import uuid
import os
from typing import Dict, Any

import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from app.models.schemas import ChatRequest, ChatResponse, Verse, TTSRequest


router = APIRouter()


@router.post("/chat")
async def chat(req: ChatRequest, request: Request):
    state = request.app.state
    conversations = state.conversations_logger
    analytics = state.analytics_logger

    session_id = req.session_id or str(uuid.uuid4())
    query = req.query.strip()

    # check if RAG is available
    if not getattr(state, "rag_available", False):
        raise HTTPException(
            status_code=503, 
            detail="The sacred texts are currently being prepared. Please try again in a moment."
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
        chapter_summary = f"Chapter {ch} contains {state.chapters[ch].get('verse_count')} verses."

    # generate full answer internally
    try:
        llm_result = state.llm_service.answer(
            query=query,
            verse=verse,
            chapter_summary=chapter_summary,
            voice_output=bool(req.voice_output),
            intent=user_intent,
            desired_outcome=desired_outcome,
            language=req.language
        )
        full_answer = llm_result["answer"]
        is_fallback = llm_result["fallback"]
    except Exception as e:
        analytics.error(f"llm_error session={session_id} err={e}")
        is_fallback = True
        full_answer = state.llm_service._fallback_answer(verse, user_intent, desired_outcome)

    # session management
    session["history"].append({"query": query, "refined": refined_query, "verse_id": retrieval_meta.get("verse_id")})
    if len(session["history"]) % 3 == 0:
        session["summary"] = state.summarizer_service.summarize(
            previous_summary=session["summary"],
            query=query,
            verse=verse
        )

    # 2. Get static audio URLs
    static_audio = {
        "shlok": None,
        "translation": None,
        "explanation": None
    }
    if hasattr(state, "tts_service"):
        static_audio = state.tts_service.get_static_audio_urls(
            chapter=int(verse.get("chapter", 0)),
            verse=int(verse.get("verse", 0)),
            language=req.language
        )

    clean_meta = {
        "verse_id": retrieval_meta.get("verse_id"),
        "chapter_summary": chapter_summary,
        "summary": session.get("summary", ""),
        "fallback": is_fallback,
        "audio": static_audio
    }

    # Log interaction
    conversations.info(f"session={session_id} query={query!r} verse_id={retrieval_meta.get('verse_id')} fallback={is_fallback}")

    async def event_generator():
        analytics.info(f"stream_start session={session_id}")
        try:
            # 1. Send metadata first
            yield f"data: {json.dumps({'type': 'start', 'session_id': session_id, 'verse': verse, 'meta': clean_meta}, ensure_ascii=False)}\n\n"

            # 2. Send the full answer in small, consistent chunks
            # We avoid splitting by words/sentences to ensure no duplication or missing spaces
            chunk_size = 40  # Small enough for a "typing" effect
            for i in range(0, len(full_answer), chunk_size):
                chunk = full_answer[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'text', 'content': chunk}, ensure_ascii=False)}\n\n"
            
            # 3. Send end event
            yield f"data: {json.dumps({'type': 'end'}, ensure_ascii=False)}\n\n"
            analytics.info(f"stream_end session={session_id}")
        except Exception as e:
            analytics.error(f"stream_error session={session_id} err={e}")
            yield f"data: {json.dumps({'type': 'error', 'message': 'Stream interrupted'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/tts")
async def text_to_speech(req: TTSRequest, request: Request):
    state = request.app.state
    analytics = state.analytics_logger
    
    if not hasattr(state, "tts_service"):
        raise HTTPException(status_code=503, detail="TTS_SERVICE_UNAVAILABLE")
        
    try:
        audio_urls, chunks = await state.tts_service.get_audio_chunks(req.text, req.language)
        
        if not audio_urls:
            analytics.warning(f"tts_missing_urls text={req.text[:50]}...")
            # Phase 9: Return empty urls instead of 500 to prevent crash
            return JSONResponse(
                content={"audio_urls": [], "chunks": []},
                media_type="application/json; charset=utf-8"
            )
            
        return JSONResponse(
            content={"audio_urls": audio_urls, "chunks": chunks},
            media_type="application/json; charset=utf-8"
        )
    except Exception as e:
        analytics.error(f"tts_exception err={e}")
        # Phase 9: Return empty urls on failure
        return JSONResponse(
            content={"audio_urls": [], "chunks": []},
            media_type="application/json; charset=utf-8"
        )


