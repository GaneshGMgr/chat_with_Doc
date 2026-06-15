# rag_backend\backend\routers\ingest.py

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.database import get_db, Document, IngestJob
from backend.schemas.schemas import IngestURLRequest
from backend.workers.tasks import ingest_document
from backend.config import settings


router = APIRouter(prefix="/ingest", tags=["Ingestion"])


MIME = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "md"
}


@router.post("/file", status_code=202, summary="Upload file for ingestion")
async def ingest_file(
    file: UploadFile = File(...),
    collection_id: str = Form(None),
    chunk_size: int = Form(600),
    chunk_overlap: int = Form(100),
    db: Session = Depends(get_db)
):

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()

    st = MIME.get(
        file.content_type or ""
    ) or (
        ext if ext in ["pdf", "docx", "txt", "md"] else None
    )

    if not st:
        raise HTTPException(400, f"Unsupported: {file.content_type}")

    data = await file.read()

    if len(data) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            413,
            f"Too large (max {settings.MAX_FILE_SIZE_MB}MB)"
        )

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    doc = Document(
        name=file.filename,
        source_type=st,
        collection_id=collection_id,
        size_bytes=len(data)
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    dest = os.path.join(
        settings.UPLOAD_DIR,
        f"{doc.id}_{file.filename}"
    )

    with open(dest, "wb") as f:
        f.write(data)

    doc.file_path = dest
    db.commit()

    job = IngestJob(document_id=doc.id)

    db.add(job)
    db.commit()
    db.refresh(job)

    task = ingest_document.delay(
        job_id=job.id,
        document_id=doc.id,
        source_type=st,
        file_path=dest,
        collection_id=collection_id,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    job.celery_task_id = task.id
    db.commit()

    return {
        "job_id": job.id,
        "document_id": doc.id,
        "filename": file.filename,
        "status": "queued",
        "estimated_chunks": max(1, len(data) // (chunk_size * 4))
    }


@router.post("/url", status_code=202, summary="Ingest a web URL")
def ingest_url(req: IngestURLRequest, db: Session = Depends(get_db)):

    name = req.url.split("//", 1)[-1][:80]

    doc = Document(
        name=name,
        source_type="url",
        source_url=req.url,
        collection_id=req.collection_id,
        meta=req.metadata
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    job = IngestJob(document_id=doc.id)

    db.add(job)
    db.commit()
    db.refresh(job)

    task = ingest_document.delay(
        job_id=job.id,
        document_id=doc.id,
        source_type="url",
        source_url=req.url,
        collection_id=req.collection_id,
        chunk_size=req.chunk_size,
        chunk_overlap=req.chunk_overlap
    )

    job.celery_task_id = task.id
    db.commit()

    return {
        "job_id": job.id,
        "document_id": doc.id,
        "url": req.url,
        "status": "queued"
    }


@router.get("/status/{job_id}", summary="Check ingestion job status")
def job_status(job_id: str, db: Session = Depends(get_db)):

    job = db.query(IngestJob).filter(IngestJob.id == job_id).first()

    if not job:
        raise HTTPException(404, "Job not found")

    return {
        "job_id": job.id,
        "document_id": job.document_id,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "chunks_created": job.chunks_created,
        "chunks_total": job.chunks_total,
        "error": job.error,
        "started_at": job.started_at
    }