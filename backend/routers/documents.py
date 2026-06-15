# rag_backend\backend\routers\documents.py

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db, Document, Chunk
from backend.schemas.schemas import DocumentOut, ChunkOut
from backend.rag.retriever import delete_document_chunks


router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", summary="List documents")
def list_documents(
    collection_id: Optional[str] = None,
    source_type: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):

    q = db.query(Document)

    if collection_id:
        q = q.filter(Document.collection_id == collection_id)

    if source_type:
        q = q.filter(Document.source_type == source_type)

    total = q.count()

    docs = (
        q.order_by(Document.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "documents": [
            DocumentOut.model_validate(d).model_dump()
            for d in docs
        ],
        "total": total
    }


@router.get("/{doc_id}", summary="Get document")
def get_doc(doc_id: str, db: Session = Depends(get_db)):

    d = db.query(Document).filter(Document.id == doc_id).first()

    if not d:
        raise HTTPException(404, "Not found")

    return DocumentOut.model_validate(d).model_dump()


@router.get("/{doc_id}/chunks", summary="View chunks")
def get_chunks(
    doc_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):

    d = db.query(Document).filter(Document.id == doc_id).first()

    if not d:
        raise HTTPException(404, "Not found")

    chunks = (
        db.query(Chunk)
        .filter(Chunk.document_id == doc_id)
        .order_by(Chunk.chunk_index)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "document_id": doc_id,
        "chunks": [
            ChunkOut.model_validate(c).model_dump()
            for c in chunks
        ]
    }


@router.delete("/{doc_id}", summary="Delete document + ChromaDB chunks")
def delete_doc(doc_id: str, db: Session = Depends(get_db)):

    d = db.query(Document).filter(Document.id == doc_id).first()

    if not d:
        raise HTTPException(404, "Not found")

    cnt = d.chunk_count

    delete_document_chunks(doc_id)

    db.delete(d)
    db.commit()

    return {
        "deleted": True,
        "chunks_removed": cnt
    }