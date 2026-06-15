# RAG Knowledge Base — Production FastAPI Backend

## Quick Start
```bash
cp .env.example .env   # Add OPENAI_API_KEY and/or GROQ_API_KEY
docker-compose up --build
```
* **API:** http://localhost:8000
* **Docs:** http://localhost:8000/docs

## Stack
* **Core:** FastAPI + SQLite + ChromaDB + Redis + Celery
* **Embeddings:** all-MiniLM-L6-v2 (local, free)
* **Reranker:** cross-encoder/ms-marco-MiniLM-L-6-v2 (local, free)
* **LLMs:** OpenAI / Groq / Ollama (per-chat selection)
* **STT:** faster-whisper (local, free)
* **TTS:** edge-tts (free, Azure voices)

## Endpoints (24 total)

### 💬 Chat & Conversations
* **POST** `/api/v1/chat` - SSE streaming + citations
* **POST** `/api/v1/chat/{id}/regenerate` - Regenerate response
* **GET** `/api/v1/conversations` - List conversations
* **GET** `/api/v1/conversations/{id}` - Get conversation + messages
* **PATCH** `/api/v1/conversations/{id}` - Rename conversation
* **DELETE** `/api/v1/conversations/{id}` - Delete conversation

### 📂 Ingestion & Document Management
* **POST** `/api/v1/ingest/file` - Upload PDF/DOCX/TXT/MD
* **POST** `/api/v1/ingest/url` - Ingest URL
* **GET** `/api/v1/ingest/status/{job_id}` - Check ingestion job progress
* **GET** `/api/v1/documents` - List all documents
* **GET** `/api/v1/documents/{id}` - Get document details
* **GET** `/api/v1/documents/{id}/chunks` - View specific document chunks
* **DELETE** `/api/v1/documents/{id}` - Delete document + purge from ChromaDB

### 🗂️ Collections & Workspaces
* **POST** `/api/v1/collections` - Create workspace
* **GET** `/api/v1/collections` - List workspaces
* **GET** `/api/v1/collections/{id}` - Get workspace details
* **DELETE** `/api/v1/collections/{id}` - Delete workspace

### 🤖 LLM Models
* **GET** `/api/v1/models` - List available models + health status
* **POST** `/api/v1/models/{p}/validate` - Test provider connectivity

### 🎙️ Audio & Voice
* **POST** `/api/v1/voice/transcribe` - Whisper STT
* **POST** `/api/v1/voice/synthesize` - Edge TTS
* **GET** `/api/v1/voice/voices` - List available voices

### ⚙️ System
* **GET** `/api/v1/health` - System health check
* **GET** `/api/v1/stats` - System usage statistics

## 🐳 Docker Commands
```bash  
## 🐳 Start
docker compose up -d # terminal 1 http://localhost:3000
docker compose up --build

docker compose logs -f langfuse # terminal 2  http://localhost:3001
## 📊 Check
docker ps

## ⛔ Stop
docker compose down
docker compose down -v          # wipe volumes so migrations run fresh
docker compose up -d clickhouse langfuse-db   # start deps first
docker compose logs -f clickhouse             # watch until you see "Ready for connections"
docker compose up -d langfuse                 # then start langfuse


## 🧹 Cleanup (occasional)
docker system prune -a
docker builder prune -a

 wsl --shutdown

 ## SAFE (Compact WSL disk, keeps Docker intact)
Get-ChildItem "C:\Users\<<username>>\AppData\Local\Docker\wsl" -Recurse | Measure-Object Length -Sum
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
Optimize-VHD -Path "C:\Users\<<username>>\AppData\Local\Docker\wsl\disk\docker_data" -Mode Full
Optimize-VHD -Path "C:\Users\<<username>>\AppData\Local\Docker\wsl\main\ext4" -Mode Full

## FULL RESET (Delete Docker WSL completely)
wsl --unregister docker-desktop
wsl --unregister docker-desktop-data
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Docker\wsl"
```
