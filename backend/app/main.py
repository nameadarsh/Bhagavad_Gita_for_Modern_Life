from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import AsyncIterator, Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.logger import setup_app_loggers
from app.services.api_key_manager import ApiKeyManager
from app.services.data_loader import load_all
from app.services.rag_service import RagService
from app.services.rag_service import get_embedder
from app.services.llm_service import LlmService
from app.services.query_service import QueryService
from app.services.summarizer_service import SummarizerService
from app.services.tts_service import TtsService
from app.services.feedback_service import FeedbackService
from app.routes.chat import router as chat_router
from app.models.schemas import FeedbackRequest


def _sync_load_rag(app: FastAPI, base_dir: Path) -> bool:
    """
    CPU / blocking I/O: FAISS, JSON, embedder, service wiring.
    Must run in a worker thread (asyncio.to_thread), never on the event loop.
    """
    if getattr(app.state, "rag_available", False):
        return True

    with app.state.rag_lock:
        if getattr(app.state, "rag_available", False):
            return True

        app.state.rag_loading = True
        try:
            loaded = load_all(base_dir)
            app.state.verses = loaded.verses
            app.state.verses_by_id = loaded.verses_by_id
            app.state.chapters = loaded.chapters
            app.state.metadata = loaded.metadata
            app.state.faiss_index = loaded.faiss_index
            app.state.prompts = loaded.prompts

            embedder = get_embedder()
            if embedder is None:
                raise RuntimeError("Failed to initialize embedding model")

            keys = ApiKeyManager()
            app.state.api_keys = keys
            app.state.rag_service = RagService(
                verses_by_id=loaded.verses_by_id,
                metadata=loaded.metadata,
                faiss_index=loaded.faiss_index,
            )
            app.state.query_service = QueryService(prompts=loaded.prompts, keys=keys)
            app.state.summarizer_service = SummarizerService(prompts=loaded.prompts, keys=keys)
            app.state.llm_service = LlmService(prompts=loaded.prompts, keys=keys)
            app.state.tts_service = TtsService()
            app.state.rag_available = True
            return True
        except Exception as e:
            app.state.analytics_logger.error(f"rag_load_error: {e}")
            app.state.rag_available = False
            return False
        finally:
            app.state.rag_loading = False


def create_app() -> FastAPI:
    load_dotenv()

    missing = []
    for var in ["LLM_PROVIDER", "SMALL_LLM_PROVIDER", "LLM_API_KEYS"]:
        if os.getenv(var) is None:
            missing.append(var)
    if missing:
        raise RuntimeError(f"Missing required environment variable(s): {', '.join(missing)}")

    base_dir = Path(__file__).resolve().parents[1]  # backend/
    setup_app_loggers(base_dir)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.warmup_schedule_lock = asyncio.Lock()
        app.state.warmup_status = "starting"
        app.state.warmup_error = None

        async def warmup_worker() -> None:
            try:
                ok = await asyncio.to_thread(_sync_load_rag, app, base_dir)
                async with app.state.warmup_schedule_lock:
                    if ok:
                        app.state.warmup_status = "ready"
                        app.state.warmup_error = None
                    else:
                        app.state.warmup_status = "failed"
                        app.state.warmup_error = "RAG or embedding initialization returned false"
            except asyncio.CancelledError:
                async with app.state.warmup_schedule_lock:
                    if getattr(app.state, "warmup_status", "") != "ready":
                        app.state.warmup_status = "starting"
                raise
            except Exception as e:
                log = getattr(app.state, "analytics_logger", None) or logging.getLogger("analytics")
                log.error(f"warmup_worker_error: {e}")
                async with app.state.warmup_schedule_lock:
                    app.state.warmup_status = "failed"
                    app.state.warmup_error = str(e)[:500]

        async def kick_warmup() -> None:
            async with app.state.warmup_schedule_lock:
                if getattr(app.state, "warmup_status", "") == "ready":
                    return
                t = getattr(app.state, "_warmup_task", None)
                if t is not None and not t.done():
                    return
                app.state.warmup_status = "warming_up"
                app.state.warmup_error = None
                app.state._warmup_task = asyncio.create_task(warmup_worker())

        app.state.warmup_kick = kick_warmup
        await kick_warmup()

        yield

        t = getattr(app.state, "_warmup_task", None)
        if t is not None and not t.done():
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass

    app = FastAPI(title="Bhagavad Gita for Modern Life", version="1.0.0", lifespan=lifespan)

    FRONTEND_URL = os.getenv("FRONTEND_URL")
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    if FRONTEND_URL:
        origins.append(FRONTEND_URL)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root():
        return {
            "status": "ok",
            "title": "Bhagavad Gita for Modern Life",
            "version": "1.0.0",
        }

    @app.get("/favicon.ico")
    def favicon():
        return Response(status_code=204)

    app.state.conversations_logger = logging.getLogger("conversations")
    app.state.analytics_logger = logging.getLogger("analytics")
    app.state.rag_available = False
    app.state.rag_loading = False
    app.state.rag_lock = Lock()
    app.state.feedback_service = FeedbackService()

    @app.get("/health")
    def health():
        """Liveness + observed readiness. Does not load models or RAG."""
        ws = getattr(app.state, "warmup_status", "starting")
        rag_ready = bool(getattr(app.state, "rag_available", False))
        rag_loading = bool(getattr(app.state, "rag_loading", False))
        return {
            "status": "alive",
            "warmup_status": ws,
            "rag_available": rag_ready,
            "rag_loading": rag_loading,
        }

    @app.get("/health_check")
    def health_check():
        """Readiness for clients; same fields as before plus explicit warmup_status."""
        ws = getattr(app.state, "warmup_status", "starting")
        rag_ready = bool(getattr(app.state, "rag_available", False))
        rag_loading = bool(getattr(app.state, "rag_loading", False))
        err = getattr(app.state, "warmup_error", None)

        compat_status = "ok" if rag_ready else ws

        body: dict[str, Any] = {
            "status": compat_status,
            "warmup_status": ws,
            "service": "gita-rag-backend",
            "rag_available": rag_ready,
            "rag_loading": rag_loading,
        }
        if err and ws == "failed":
            body["warmup_error"] = err
        return JSONResponse(body)

    app.state.sessions = {}

    @app.post("/api/v1/warmup/retry")
    async def warmup_retry(request: Request):
        """Re-run background warmup after a failure (explicit recovery, not middleware)."""
        kick = getattr(request.app.state, "warmup_kick", None)
        if kick is None or not callable(kick):
            return JSONResponse(status_code=503, content={"detail": "Warmup scheduler not available"})
        await kick()
        return {"ok": True, "warmup_status": getattr(request.app.state, "warmup_status", "unknown")}

    @app.post("/api/v1/feedback")
    async def feedback(req: FeedbackRequest, request: Request):
        success, message = request.app.state.feedback_service.submit_feedback(
            rating=req.rating,
            name=req.name,
            feedback=req.feedback,
        )
        if not success:
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": message},
            )
        return {"success": True, "message": message}

    app.include_router(chat_router, prefix="/api/v1")

    return app


app = create_app()
