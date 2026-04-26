# Bhagavad Gita for Modern Life (RAG-based Conversational System)

## Overview
**Bhagavad Gita for Modern Life** is a modern conversational assistant designed to provide spiritual guidance and wisdom based strictly on the teachings of the Bhagavad Gita. By leveraging Retrieval-Augmented Generation (RAG), the system ensures that every response is grounded in authentic shloks, translations, and explanations.

### Key Features
- **Intent-Aware Retrieval**: Understands user emotions (confusion, fear, duty) to provide the most relevant guidance.
- **Conversational Interface**: Reflective and natural human-like responses instead of robotic lists.
- **Complete Explorer**: Browse all 18 chapters and 700 verses with ease.
- **Daily Wisdom**: A hand-picked verse to inspire your spiritual journey every day.

## Tech Stack
### Frontend
- **React (Vite)** with **TypeScript**
- **Tailwind CSS** for responsive styling
- **Zustand** for persistent state management
- **Lucide React** for iconography

### Backend
- **FastAPI** (Python)
- **FAISS** for efficient vector similarity search
- **Sentence Transformers** for high-quality embeddings
- **Groq / OpenAI-compatible APIs** for LLM generation

## Architecture
The system follows a robust RAG pipeline:
1. **User Query**: User asks a question or seeks guidance.
2. **Query Refinement**: Intent classification to understand the emotional context.
3. **FAISS Search**: Semantic retrieval of the top 5 most relevant verses.
4. **Intent-Aware Reranking**: Re-ordering results based on user intent vs. verse type (e.g., prioritizing guidance over condemnation for confused users).
5. **LLM Generation**: Grounded response generation using the selected verse and its explanation.
6. **Response**: Natural, reflective answer delivered to the user.

## Folder Structure
- `backend/`: FastAPI server, RAG logic, data processing, and FAISS index.
- `frontend/`: React application, UI components, and API integration.

## API Endpoints

- `POST /api/v1/chat`: Main endpoint for the conversational assistant.
  - Body: `{ "query": "string", "session_id": "optional_string", "verse_id": "optional_id", "language": "en" }`
- `POST /api/v1/tts`: Generate audio chunks for a given text.
  - Body: `{ "text": "string", "language": "en" }`
- `GET /health`: Detailed health status of the RAG system.

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd rag_gita
```

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
# Installs core dependencies for FastAPI, FAISS, and TTS
pip install -r requirements.txt
# Create .env file with your API keys (see backend/README.md)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
# Create .env file with VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

## How to Stop
To stop either the backend or frontend server, press `Ctrl + C` in the respective terminal window.

## Communication
The frontend and backend communicate via a REST API. The frontend uses the `VITE_API_BASE_URL` environment variable to locate the FastAPI server (default: `http://localhost:8000`).

## Deployment
- **Frontend**: Optimized for deployment on platforms like **Vercel** or **Netlify**.
- **Backend**: Suitable for deployment on **Render**, **Railway**, or any Docker-compatible environment.
