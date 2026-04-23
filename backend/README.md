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
   pip install -r requirements.txt
   ```

3. **Run the Server**
   ```bash
   uvicorn app.main:app --reload
   ```

## Environment Variables
Create a `.env` file in the `backend/` directory with the following variables:

```env
LLM_PROVIDER=groq  # or openai
LLM_API_KEYS=your_key_1,your_key_2
SMALL_LLM_PROVIDER=groq
SMALL_LLM_API_KEYS=your_key_small
SARVAM_API_KEY=your_sarvam_key_for_tts (optional)
```

## API Endpoints

- `POST /chat`: Main endpoint for the conversational assistant.
  - Body: `{ "query": "string", "session_id": "optional_string", "verse_id": "optional_id" }`
- `GET /verses`: Retrieve all 700 verses with metadata.
- `GET /chapter/{id}`: Get all verses for a specific chapter (1-18).
- `GET /daily`: Get a randomly selected "Verse of the Day".
- `GET /verse/{id}`: Get details for a specific verse (e.g., `BG1.1`).

## RAG Pipeline Explanation

1. **Embedding**: The user's query is converted into a vector using `SentenceTransformer`.
2. **FAISS Retrieval**: The system searches the vector index for the top 5 semantically similar verses.
3. **Intent-Aware Reranking**: 
   - Classifies user intent (e.g., `moral_conflict`, `confusion`).
   - Classifies verse type (e.g., `guidance`, `warning`).
   - Applies bonuses or penalties to the retrieval score to ensure contextually appropriate results.
4. **LLM Response**: The best-ranked verse is sent to the LLM (e.g., Llama-3 via Groq) with a custom prompt to generate a reflective, grounded answer.
