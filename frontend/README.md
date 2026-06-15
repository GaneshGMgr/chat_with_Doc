# RAGbase Frontend — Next.js Chat UI

## Quick Start
```bash
cp .env.local.example .env.local
npm install
npm run dev   # http://localhost:3000
```

## Design: Terminal Intelligence
* **Theme:** Dark industrial aesthetic
* **Colors:** Acid-lime (`#c8f020`) accents on near-black (`#07080d`) background
* **Fonts:** Syne (display) + DM Sans (body) + IBM Plex Mono (labels/code)
* **Effects:** Atmospheric scan-line texture overlay

## Features
* **Streaming:** SSE streaming handles real-time token rendering
* **Citations:** Citation chips with hover tooltip previews displayed before the answer
* **Status Tracking:** Real-time state indicators (retrieving → reranking → generating)
* **Model Picker:** Per-conversation selector for OpenAI, Groq, or Ollama providers
* **Sidebar Management:** Contextual history, full-text search, renaming, and deletion
* **Rich Text:** Full markdown rendering supporting tables, code syntax, and styles
* **Controls:** One-click message copying and response regeneration triggers
* **Onboarding:** Clean empty-state dashboard loaded with 4 actionable starter prompts

## Backend Integration
* **Base URL:** Connects to FastAPI backend via `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`)
* **Core Route:** `POST /api/v1/chat` for high-performance server-sent events streaming

## 💻 Frontend Dev Commands
```bash
cd frontend
npm run dev
```
