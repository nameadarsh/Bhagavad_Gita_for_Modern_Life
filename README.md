# Bhagavad Gita for Modern Life

## Overview
Bhagavad Gita for Modern Life is a RAG-powered assistant that answers questions using Bhagavad Gita verses, streams grounded responses, and supports audio playback for both generated guidance and static verse recordings.

## Features
- RAG-based verse retrieval with FAISS-backed search and intent-aware reranking
- Streaming chat responses grounded in retrieved verses
- Dynamic TTS for generated guidance plus static verse audio
- Warmup UX that wakes the backend through `/health_check` before chat is enabled
- Multilingual text and audio support
- Home, Chat, Info, Daily, Chapters, Chapter Detail, and All Shloks pages

## Tech Stack
- Frontend: React, Vite, TypeScript, Zustand, Tailwind CSS
- Backend: FastAPI, FAISS, FastEmbed, Supabase Storage, Sarvam TTS

## Setup
### Backend
```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Create `backend/.env` with the required LLM, TTS, and Supabase credentials described in `backend/README.md`.

### Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Run the frontend:

```bash
npm run dev
```

## API Surface
- `GET /health_check`: warms the backend and reports readiness
- `GET /health`: detailed readiness metadata
- `POST /api/v1/chat`: streaming chat endpoint
- `POST /api/v1/tts`: dynamic TTS endpoint

## Project Layout
- `frontend/`: React app, pages, Zustand stores, chat/audio UI
- `backend/`: FastAPI app, RAG services, TTS pipeline, data loaders
