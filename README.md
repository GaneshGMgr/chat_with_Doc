# RAGbase — Production RAG Knowledge Assistant

RAGbase is a production-ready Retrieval-Augmented Generation (RAG) application that allows users to chat with their private documents using modern AI models.

The system combines document ingestion, semantic search, reranking, and LLM generation to provide accurate answers with source citations. It supports multiple LLM providers including OpenAI, Groq, and local Ollama models.

## ✨ Features

- 📄 **Document Intelligence**
  - Upload and process PDF, DOCX, TXT, and Markdown files
  - Ingest documents from URLs
  - Automatic chunking and embedding generation

- 💬 **AI Chat Assistant**
  - Real-time streaming responses using Server-Sent Events (SSE)
  - Conversation history management
  - Response regeneration
  - Markdown and code rendering

- 🔎 **Advanced Retrieval Pipeline**
  - Vector similarity search
  - Local embedding models
  - Cross-encoder reranking
  - Citation-based answers

- 🤖 **Multi-Model Support**
  - OpenAI models
  - Groq models
  - Ollama local models

- 🎙️ **Voice Support**
  - Speech-to-text using Whisper
  - Text-to-speech generation

- ⚡ **Production Architecture**
  - FastAPI backend
  - Next.js frontend
  - Redis + Celery background workers
  - Docker-based deployment

---

## 🏗️ System Architecture

```
                 User
                  |
                  |
          Next.js Frontend
                  |
                  |
          FastAPI Backend
                  |
        -------------------
        |        |        |
   Document   Retrieval   LLM
   Pipeline   Pipeline   Providers
        |        |        |
     ChromaDB  Reranker  OpenAI
                         Groq
                         Ollama
```

---

## 🛠️ Tech Stack

### Frontend
- Next.js
- React
- Server-Sent Events (SSE)
- Tailwind CSS

### Backend
- FastAPI
- Python
- SQLite
- Redis
- Celery

### AI / RAG
- LangChain
- ChromaDB
- Sentence Transformers
- Cross Encoder Reranking
- OpenAI API
- Groq API
- Ollama

### Deployment
- Docker
- Docker Compose

---

## 📂 Project Structure

```
RAGbase/
│
├── frontend/        # Next.js chat interface
│   └── README.md
│
├── backend/         # FastAPI RAG backend
│   └── README.md
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### 1. Clone Repository

Clone the repository:

:contentReference[oaicite:0]{index=0}

```bash
git clone https://github.com/GaneshGMgr/chat_with_Doc.git
cd chat_with_Doc
```

### 2. Configure Environment Variables

Backend:

```bash
cd backend
cp .env.example .env
```

Frontend:

```bash
cd frontend
cp .env.local.example .env.local
```

### 3. Run with Docker

```bash
docker compose up --build
```

Application:

```
Frontend:
http://localhost:3000

Backend API:
http://localhost:8000

API Documentation:
http://localhost:8000/docs
```

---

## 📚 Detailed Documentation

For detailed setup instructions:

- Frontend documentation → [`frontend/README.md`](./frontend/README.md)
- Backend documentation → [`backend/README.md`](./backend/README.md)

---

## 🎯 Future Improvements

- Advanced RAG evaluation pipeline
- User authentication and permissions
- Cloud deployment support
- More vector database integrations
- Agent-based workflows

---

## 📜 License

This project is licensed under the MIT License.
