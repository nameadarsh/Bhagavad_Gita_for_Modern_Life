# Backend

The backend is a FastAPI service that powers retrieval, grounded response generation, TTS generation, and the warmup readiness flow.

## Setup
```bash
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Environment
Create `backend/.env` with:

```env
LLM_PROVIDER=groq
SMALL_LLM_PROVIDER=groq
LLM_API_KEYS=your_llm_keys
SMALL_LLM_API_KEYS=your_small_llm_keys
SARVAM_API_KEY=your_sarvam_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_BUCKET=rag_gita_audio
FRONTEND_URL=http://localhost:5173
```

## RAG Flow
1. `/health_check` loads the FAISS index, prompts, metadata, chapters, and embedding model once.
2. `/api/v1/chat` refines the query, retrieves the most relevant verse, reranks candidates, and generates a grounded answer.
3. The answer is returned as an SSE stream with verse metadata and audio metadata.

## TTS Pipeline
- `/api/v1/tts` chunks generated text into speech-friendly segments
- Sarvam produces MP3 audio
- Supabase stores and serves cached audio URLs
- Static verse audio URLs are generated deterministically from Supabase storage paths

## Supabase Storage
- Dynamic TTS bucket: `SUPABASE_BUCKET` (default `rag_gita_audio`)
- Static verse bucket: `rag_gita_static_audio`

## Health Endpoints
- `GET /health_check`: warmup entrypoint used by the frontend; loads RAG plus embeddings and reports `rag_available`
- `GET /health`: detailed readiness and embedder status
- `GET /`: basic service metadata
