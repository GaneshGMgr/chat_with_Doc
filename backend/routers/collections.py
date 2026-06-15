# rag_backend\backend\routers\collections.py

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db, Collection, Document
from backend.schemas.schemas import CollectionCreate, CollectionOut


router = APIRouter(prefix="/collections", tags=["Collections"])


@router.post("", status_code=201, summary="Create workspace")
def create(req: CollectionCreate, db: Session = Depends(get_db)):

    c = Collection(
        name=req.name,
        description=req.description,
        color=req.color
    )

    db.add(c)
    db.commit()
    db.refresh(c)

    d = CollectionOut.model_validate(c).model_dump()
    d["document_count"] = 0

    return d


@router.get("", summary="List collections")
def list_all(db: Session = Depends(get_db)):

    colls = (
        db.query(Collection)
        .order_by(Collection.created_at.desc())
        .all()
    )

    results = []

    for c in colls:
        cnt = (
            db.query(func.count(Document.id))
            .filter(Document.collection_id == c.id)
            .scalar()
        )

        d = CollectionOut.model_validate(c).model_dump()
        d["document_count"] = cnt
        results.append(d)

    return {"collections": results}


@router.get("/{coll_id}", summary="Get collection")
def get_coll(coll_id: str, db: Session = Depends(get_db)):

    c = db.query(Collection).filter(Collection.id == coll_id).first()

    if not c:
        raise HTTPException(404, "Not found")

    cnt = (
        db.query(func.count(Document.id))
        .filter(Document.collection_id == coll_id)
        .scalar()
    )

    d = CollectionOut.model_validate(c).model_dump()
    d["document_count"] = cnt

    return d


@router.delete("/{coll_id}", summary="Delete collection")
def delete_coll(coll_id: str, db: Session = Depends(get_db)):

    c = db.query(Collection).filter(Collection.id == coll_id).first()

    if not c:
        raise HTTPException(404, "Not found")

    db.delete(c)
    db.commit()

    return {"deleted": True, "id": coll_id}