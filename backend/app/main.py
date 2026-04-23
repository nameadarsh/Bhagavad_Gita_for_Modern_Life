from __future__ import annotations

from pathlib import Path
import logging
import os

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.logger import setup_app_loggers
from app.services.api_key_manager import ApiKeyManager
from app.services.data_loader import load_all
from app.services.rag_service import RagService
from app.services.llm_service import LlmService
from app.services.query_service import QueryService
from app.services.summarizer_service import SummarizerService
from app.routes.chat import router as chat_router
from app.routes.verses import router as verses_router
from app.routes.chapters import router as chapters_router
from app.routes.daily import router as daily_router

DEBUG = False


def create_app() -> FastAPI:
    load_dotenv()
    if DEBUG:
        print("LLM_PROVIDER:", os.getenv("LLM_PROVIDER"))
        print("SMALL_LLM_PROVIDER:", os.getenv("SMALL_LLM_PROVIDER"))

    missing = []
    for var in ["LLM_PROVIDER", "SMALL_LLM_PROVIDER", "LLM_API_KEYS"]:
        if os.getenv(var) is None:
            missing.append(var)
    if missing:
        raise RuntimeError(f"Missing required environment variable(s): {', '.join(missing)}")

    base_dir = Path(__file__).resolve().parents[1]  # backend/
    setup_app_loggers(base_dir)

    fastapi_app = FastAPI(title="Bhagavad Gita for Modern Life", version="1.0.0")

    FRONTEND_URL = os.getenv("FRONTEND_URL")
    origins = [FRONTEND_URL] if FRONTEND_URL else ["*"]

    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @fastapi_app.get("/")
    def root():
        return {
            "status": "ok",
            "title": "Bhagavad Gita for Modern Life",
            "version": "1.0.0"
        }

    @fastapi_app.get("/health_check")
    def health_check():
        return JSONResponse({"status": "ok", "service": "gita-rag-backend"})

    @fastapi_app.get("/health")
    def health():
        rag_ready = getattr(fastapi_app.state, "rag_available", False)
        return JSONResponse(
            {
                "status": "ok",
                "rag_available": rag_ready,
                "verses": len(getattr(fastapi_app.state, "verses", []) or []) if rag_ready else 0,
                "chapters": len(getattr(fastapi_app.state, "chapters", {}) or {}) if rag_ready else 0,
            }
        )

    @fastapi_app.get("/favicon.ico")
    def favicon():
        return Response(status_code=204)

    # attach loggers
    fastapi_app.state.conversations_logger = logging.getLogger("conversations")
    fastapi_app.state.analytics_logger = logging.getLogger("analytics")
    fastapi_app.state.rag_available = False

    def load_rag_system():
        try:
            # load all cached resources once
            loaded = load_all(base_dir)
            fastapi_app.state.verses = loaded.verses
            fastapi_app.state.verses_by_id = loaded.verses_by_id
            fastapi_app.state.chapters = loaded.chapters
            fastapi_app.state.metadata = loaded.metadata
            fastapi_app.state.faiss_index = loaded.faiss_index
            fastapi_app.state.embedder = loaded.embedder
            fastapi_app.state.prompts = loaded.prompts

            # services
            keys = ApiKeyManager()
            fastapi_app.state.api_keys = keys
            fastapi_app.state.rag_service = RagService(
                verses_by_id=loaded.verses_by_id,
                metadata=loaded.metadata,
                faiss_index=loaded.faiss_index,
                embedder=loaded.embedder,
            )
            fastapi_app.state.query_service = QueryService(prompts=loaded.prompts, keys=keys)
            fastapi_app.state.summarizer_service = SummarizerService(prompts=loaded.prompts, keys=keys)
            fastapi_app.state.llm_service = LlmService(prompts=loaded.prompts, keys=keys)
            fastapi_app.state.rag_available = True
        except Exception as e:
            fastapi_app.state.analytics_logger.error(f"rag_load_error: {e}")
            fastapi_app.state.rag_available = False

    # Perform lazy loading
    load_rag_system()

    # sessions (in-memory)
    fastapi_app.state.sessions = {}

    # routes
    fastapi_app.include_router(chat_router)
    fastapi_app.include_router(verses_router)
    fastapi_app.include_router(chapters_router)
    fastapi_app.include_router(daily_router)

    return fastapi_app


app = create_app()

