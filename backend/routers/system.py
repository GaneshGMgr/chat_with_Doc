# rag_backend\backend\routers\system.py

from __future__ import annotations

import os
import time

from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from backend.database import (
    get_db,
    Document,
    Chunk,
    Conversation,
    Message,
    IngestJob,
    Collection
)

from backend.config import settings


router = APIRouter(prefix="", tags=["System"])

START = time.time()


def _chk(fn):
    try:
        fn()
        return "ok"
    except Exception as e:
        return f"error: {e}"


@router.get("/health", summary="Health check")
def health(db: Session = Depends(get_db)):

    def db_ok():
        db.execute(text("SELECT 1"))

    def redis_ok():
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_timeout=2)
        r.ping()
        r.close()

    def chroma_ok():
        from rag.retriever import get_chroma_client
        get_chroma_client().heartbeat()

    comps = {
        "sqlite": _chk(db_ok),
        "redis": _chk(redis_ok),
        "chromadb": _chk(chroma_ok)
    }

    status = (
        "ok"
        if all(v == "ok" for v in comps.values())
        else "degraded"
    )

    return {
        "status": status,
        "components": comps,
        "uptime_s": int(time.time() - START),
        "version": settings.APP_VERSION
    }


@router.get("/stats", summary="Usage statistics")
def stats(db: Session = Depends(get_db)):

    n_docs = db.query(func.count(Document.id)).scalar()
    n_chunks = db.query(func.count(Chunk.id)).scalar()
    n_convs = db.query(func.count(Conversation.id)).scalar()
    n_msgs = db.query(func.count(Message.id)).scalar()
    n_colls = db.query(func.count(Collection.id)).scalar()

    n_q = (
        db.query(func.count(IngestJob.id))
        .filter(IngestJob.status == "queued")
        .scalar()
    )

    n_r = (
        db.query(func.count(IngestJob.id))
        .filter(IngestJob.status == "processing")
        .scalar()
    )

    mb = 0

    if os.path.exists(settings.CHROMA_PERSIST_DIR):
        for root, _, files in os.walk(settings.CHROMA_PERSIST_DIR):
            mb += sum(
                os.path.getsize(os.path.join(root, f))
                for f in files
            )

        mb //= 1024 * 1024

    return {
        "documents": n_docs,
        "total_chunks": n_chunks,
        "conversations": n_convs,
        "messages": n_msgs,
        "collections": n_colls,
        "vector_db_size": f"{mb} MB",
        "jobs_queued": n_q,
        "jobs_running": n_r
    }