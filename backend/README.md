# Backend

FastAPI service: RAG retrieval, query refinement, grounded LLM answers (JSON-in then SSE-out), TTS, and feedback. **RAG loads at application startup** via the app **lifespan** (background thread); it is **not** loaded from middleware or from `GET /health_check`.

## Run

```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Environment

Create `backend/.env` (never commit it). Typical variables:

```env
LLM_PROVIDER=groq
SMALL_LLM_PROVIDER=groq
LLM_API_KEYS=your_llm_keys
SMALL_LLM_API_KEYS=your_small_llm_keys
# Sarvam TTS (comma-separated; falls back to SARVAM_API_KEY if unset)
SARVAM_API_KEYS=your_sarvam_key_1,your_sarvam_key_2
# SARVAM_API_KEY=your_sarvam_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_BUCKET=rag_gita_audio
FRONTEND_URL=http://localhost:5173
```

## Lifecycle and warmup

1. **Lifespan** schedules a single background warmup task.  
2. **`_sync_load_rag`** (runs in `asyncio.to_thread`) loads `data/gita.json`, `metadata.json`, FAISS index, prompts, embedding model, and constructs `RagService`, `QueryService`, `LlmService`, etc.  
3. **`warmup_status`**: `starting` → `warming_up` → `ready` | `failed`.  
4. **`POST /api/v1/warmup/retry`** schedules another attempt after `failed` (deduplicated if a run is already in progress).

## Health (read-only)

- **`GET /health`** — `status: "alive"`, plus `warmup_status`, `rag_available`, `rag_loading`.  
- **`GET /health_check`** — same observed state for the SPA; when ready, `status` is also `"ok"` and `rag_available` is true. On `failed`, `warmup_error` may be present.

Neither endpoint loads RAG or models.

## Request flow (chat)

`POST /api/v1/chat` → query refinement → (if Gita path) retrieval → LLM answer → SSE stream. If `rag_available` is false, returns **503** with a short message.

## TTS and storage

- Dynamic TTS: Sarvam + Supabase bucket `SUPABASE_BUCKET` (default `rag_gita_audio`).  
- Static verse audio: public bucket `rag_gita_static_audio` (paths built in `TtsService`).

### Sarvam API key fallback

- Set **`SARVAM_API_KEYS`** as a comma-separated list (`key1,key2,key3`).  
- If unset, **`SARVAM_API_KEY`** (single key) is used for backward compatibility.  
- On quota/rate-limit/auth exhaustion (e.g. HTTP 429, 402, 5xx, or matching error bodies), TTS automatically tries the next key once per key (no infinite retry).  
- Client/payload errors (e.g. 400, 422) do not rotate keys.  
- Logs record **key index** and failure reason only — never key values.  
- See `app/services/sarvam_key_manager.py` and `backend/.env.example`.

## Logs

Application logs may be written under `backend/logs/` (gitignored). Configure via `app/logger.py` as deployed.
