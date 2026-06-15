# backend\main.py

from __future__ import annotations

import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.config import settings
from backend.database import init_db

from backend.routers.chat import router as chat_router
from backend.routers.conversations import router as conv_router
from backend.routers.ingest import router as ingest_router
from backend.routers.documents import router as docs_router
from backend.routers.collections import router as colls_router
from backend.routers.models import router as models_router
from backend.routers.voice import router as voice_router
from backend.routers.system import router as system_router
from backend.routers.metrics import router as metrics_router


logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):

    import os

    for d in [
        settings.UPLOAD_DIR,
        settings.CHROMA_PERSIST_DIR,
        "./data"
    ]:
        os.makedirs(d, exist_ok=True)

    init_db()

    logger.info(
        f"{settings.APP_NAME} v{settings.APP_VERSION} started"
    )

    yield

    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production RAG: OpenAI+Groq+Ollama, hybrid search, reranking, citations, voice"
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.add_middleware(
    GZipMiddleware,
    minimum_size=1000
)


PREFIX = "/api/v1"


for r in [
    chat_router,
    conv_router,
    ingest_router,
    docs_router,
    colls_router,
    models_router,
    voice_router,
    system_router,
    metrics_router
]:
    app.include_router(r, prefix=PREFIX)


@app.get("/", include_in_schema=False)
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )