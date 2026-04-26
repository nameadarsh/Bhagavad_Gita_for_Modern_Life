# Bhagavad Gita for Modern Life - Backend

The backend is a FastAPI-powered service that handles the RAG (Retrieval-Augmented Generation) pipeline, intent classification, and vector search.

## Setup

1. **Create Virtual Environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install Dependencies**
   ```bash
   # Installs optimized CPU-only torch to minimize RAM and disk usage
   pip install -r requirements.txt
   ```

3. **Run the Server**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

## Stopping the Server
Press `Ctrl + C` in the terminal where the server is running.

## Environment Variables
Create a `.env` file in the `backend/` directory with the following variables:

```env
LLM_PROVIDER=groq  # or openai
LLM_API_KEYS=your_key_1,your_key_2
SMALL_LLM_PROVIDER=groq
SMALL_LLM_API_KEYS=your_key_small
SARVAM_API_KEY=your_sarvam_key_for_tts
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_BUCKET=rag_gita_audio
```

## API Endpoints (Prefix: /api/v1)

- `POST /chat`: Main streaming endpoint for the AI Guide.
  - Body: `{ "query": "string", "session_id": "optional_string", "verse_id": "optional_id", "language": "en" }`
- `POST /tts`: Generate deterministic audio chunks for dynamic LLM content.
  - Body: `{ "text": "string", "language": "en" }`
- `GET /health`: Returns RAG readiness and model status.

## RAG Pipeline

1. **Query Refinement**: Intent analysis (e.g., `confusion`, `duty`) to prioritize appropriate guidance.
2. **FAISS Retrieval**: Semantic search for the top relevant verses from the Bhagavad Gita.
3. **LLM Synthesis**: Grounded response generation using provider-aware model discovery and API key cycling.
4. **TTS Generation**: Audio chunking via Sarvam AI with caching in Supabase for high-quality guidance.
