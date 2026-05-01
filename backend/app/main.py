from __future__ import annotations

from pathlib import Path
import logging
import os
from threading import Lock

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
# verses, chapters, daily routers removed as they are now handled by frontend static data

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

    app = FastAPI(title="Bhagavad Gita for Modern Life", version="1.0.0")

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
            "version": "1.0.0"
        }

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/favicon.ico")
    def favicon():
        return Response(status_code=204)

    # attach loggers
    app.state.conversations_logger = logging.getLogger("conversations")
    app.state.analytics_logger = logging.getLogger("analytics")
    app.state.rag_available = False
    app.state.rag_loading = False
    app.state.rag_lock = Lock()
    
    # initialize feedback service
    app.state.feedback_service = FeedbackService()

    def load_rag_system():
        if getattr(app.state, "rag_available", False):
            return True

        with app.state.rag_lock:
            if getattr(app.state, "rag_available", False):
                return True

            app.state.rag_loading = True
            try:
                # load all cached resources once
                loaded = load_all(base_dir)
                app.state.verses = loaded.verses
                app.state.verses_by_id = loaded.verses_by_id
                app.state.chapters = loaded.chapters
                app.state.metadata = loaded.metadata
                app.state.faiss_index = loaded.faiss_index
                app.state.prompts = loaded.prompts

                # Preload embedder during warmup so first retrieval is ready.
                embedder = get_embedder()
                if embedder is None:
                    raise RuntimeError("Failed to initialize embedding model")

                # services
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

    @app.middleware("http")
    async def ensure_rag_loaded(request: Request, call_next):
        # List of prefixes or paths that require RAG system to be loaded
        # Only /chat and /tts (via /api/v1 prefix) now need RAG
        rag_dependent_prefixes = ["/api/v1/chat", "/api/v1/tts", "/chat"]
        
        should_load = any(request.url.path.startswith(prefix) for prefix in rag_dependent_prefixes)
        
        if should_load and not getattr(app.state, "rag_available", False):
            # Try to load if not already loaded (first request to heavy endpoint)
            load_rag_system()
        return await call_next(request)

    @app.get("/health_check")
    def health_check():
        rag_ready = getattr(app.state, "rag_available", False)
        if not rag_ready:
            rag_ready = load_rag_system()

        return JSONResponse(
            {
                "status": "ok" if rag_ready else "warming",
                "service": "gita-rag-backend",
                "rag_available": rag_ready,
            }
        )

    # sessions (in-memory)
    app.state.sessions = {}

    @app.post("/api/v1/feedback")
    async def feedback(req: FeedbackRequest, request: Request):
        success, message = request.app.state.feedback_service.submit_feedback(
            rating=req.rating,
            name=req.name,
            feedback=req.feedback
        )
        if not success:
            return JSONResponse(
                status_code=500,
                content={"success": False, "message": message}
            )
        return {"success": True, "message": message}

    # include routers with prefix
    app.include_router(chat_router, prefix="/api/v1")
    # Verses, Chapters, and Daily routes moved to frontend static data

    return app


app = create_app()
