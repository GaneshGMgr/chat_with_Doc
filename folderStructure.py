from pathlib import Path

list_of_files = [

    # =========================
    # ROOT LEVEL
    # =========================
    ".env",
    ".env.example",
    ".gitignore",
    "DOCUMENT_INTEGRATION.md",
    "docker-compose.yml",
    "requirements.txt",

    # =========================
    # BACKEND CORE
    # =========================
    "backend/__init__.py",
    "backend/main.py",
    "backend/config.py",
    "backend/database.py",
    "backend/Dockerfile",
    "backend/README.md",

    # =========================
    # INGESTION
    # =========================
    "backend/ingestion/__init__.py",
    "backend/ingestion/processor.py",

    # =========================
    # RAG PIPELINE
    # =========================
    "backend/rag/__init__.py",
    "backend/rag/pipeline.py",
    "backend/rag/reranker.py",
    "backend/rag/retriever.py",
    "backend/rag/router.py",

    # =========================
    # ROUTERS (API LAYER)
    # =========================
    "backend/routers/__init__.py",
    "backend/routers/chat.py",
    "backend/routers/collections.py",
    "backend/routers/conversations.py",
    "backend/routers/documents.py",
    "backend/routers/ingest.py",
    "backend/routers/models.py",
    "backend/routers/system.py",
    "backend/routers/voice.py",

    # =========================
    # SCHEMAS
    # =========================
    "backend/schemas/__init__.py",
    "backend/schemas/schemas.py",

    # =========================
    # VOICE MODULE
    # =========================
    "backend/voice/__init__.py",
    "backend/voice/stt.py",
    "backend/voice/tts.py",

    # =========================
    # WORKERS
    # =========================
    "backend/workers/__init__.py",
    "backend/workers/tasks.py",

    # =========================
    # FRONTEND (NEXT.JS)
    # =========================
    "frontend/.env.local",
    "frontend/.env.local.example",
    "frontend/README.md",
    "frontend/next.config.ts",
    "frontend/package.json",
    "frontend/postcss.config.mjs",
    "frontend/tsconfig.json",

    # =========================
    # FRONTEND APP ROUTES
    # =========================
    "frontend/app/globals.css",
    "frontend/app/layout.tsx",
    "frontend/app/page.tsx",
    "frontend/app/documents/page.tsx",

    # =========================
    # FRONTEND COMPONENTS
    # =========================
    "frontend/components/ChatWindow.tsx",
    "frontend/components/CitationChip.tsx",
    "frontend/components/DocumentUploader.tsx",
    "frontend/components/MessageInput.tsx",
    "frontend/components/MessageItem.tsx",
    "frontend/components/ModelSelector.tsx",
    "frontend/components/Sidebar.tsx",
    "frontend/components/StatusBar.tsx",
    "frontend/components/Toast.tsx",

    # =========================
    # FRONTEND HOOKS
    # =========================
    "frontend/hooks/useChat.ts",
    "frontend/hooks/useConversations.ts",

    # =========================
    # FRONTEND LIB
    # =========================
    "frontend/lib/api.ts",
    "frontend/lib/types.ts",
]


# Create directories and files
for filepath in list_of_files:
    filepath = Path(filepath)
    filepath.parent.mkdir(parents=True, exist_ok=True)

    if not filepath.exists():
        filepath.touch()
        print(f"Created: {filepath}")
    else:
        print(f"Already exists: {filepath}")