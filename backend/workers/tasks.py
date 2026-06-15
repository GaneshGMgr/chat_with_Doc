# rag_backend\backend\workers\tasks.py

from __future__ import annotations

import logging

from datetime import datetime
from celery import Celery

from backend.config import settings


logger = logging.getLogger(__name__)


celery_app = Celery(
    "rag_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_track_started=True
)


def _upd(db, obj, **kw):
    for k, v in kw.items():
        setattr(obj, k, v)
    db.commit()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def ingest_document(
    self,
    job_id: str,
    document_id: str,
    source_type: str,
    file_path=None,
    source_url=None,
    collection_id=None,
    chunk_size=600,
    chunk_overlap=100
):

    from backend.database import SessionLocal, Document, Chunk, IngestJob
    from backend.rag.retriever import add_chunks
    from backend.ingestion.processor import process_document

    db = SessionLocal()

    try:
        job = (
            db.query(IngestJob)
            .filter(IngestJob.id == job_id)
            .first()
        )

        doc = (
            db.query(Document)
            .filter(Document.id == document_id)
            .first()
        )

        if not job or not doc:
            return

        _upd(
            db,
            job,
            status="processing",
            started_at=datetime.utcnow(),
            stage="parsing",
            progress=0.05
        )

        chunks = process_document(
            document_id=document_id,
            source_type=source_type,
            file_path=file_path,
            source_url=source_url,
            collection_id=collection_id,
            source_name=doc.name,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        _upd(
            db,
            job,
            stage="embedding",
            progress=0.5,
            chunks_total=len(chunks)
        )

        add_chunks(chunks)

        _upd(db, job, stage="storing", progress=0.8)

        for c in chunks:
            db.add(
                Chunk(
                    id=c["id"],
                    document_id=document_id,
                    chunk_index=c["chunk_index"],
                    text=c["text"],
                    page=c.get("page"),
                    token_count=c.get("token_count", 0),
                    chroma_id=c["id"]
                )
            )

        doc.chunk_count = len(chunks)
        doc.status = "ready"

        _upd(
            db,
            job,
            status="completed",
            stage="done",
            progress=1.0,
            chunks_created=len(chunks),
            completed_at=datetime.utcnow()
        )

        db.commit()

        logger.info(
            f"Ingest complete: {document_id} -> {len(chunks)} chunks"
        )

    except Exception as exc:
        logger.error(
            f"Ingest failed {document_id}: {exc}",
            exc_info=True
        )

        try:
            j = (
                db.query(IngestJob)
                .filter(IngestJob.id == job_id)
                .first()
            )

            d = (
                db.query(Document)
                .filter(Document.id == document_id)
                .first()
            )

            if j:
                _upd(db, j, status="failed", error=str(exc))

            if d:
                d.status = "failed"
                db.commit()

        except:
            pass

        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            pass

    finally:
        db.close()