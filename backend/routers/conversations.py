# rag_backend\backend\routers\conversations.py

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db, Conversation, Message
from backend.schemas.schemas import (
    ConversationSummary,
    ConversationDetail,
    RenameRequest
)


router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.get("", summary="List conversations")
def list_conversations(
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):

    q = db.query(Conversation)

    if search:
        q = q.filter(Conversation.title.ilike(f"%{search}%"))

    total = q.count()

    convs = (
        q.order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []

    for c in convs:
        cnt = (
            db.query(func.count(Message.id))
            .filter(Message.conversation_id == c.id)
            .scalar()
        )

        d = ConversationSummary.model_validate(c).model_dump()
        d["message_count"] = cnt

        results.append(d)

    return {
        "conversations": results,
        "total": total
    }


@router.get("/{conv_id}", summary="Get conversation with messages")
def get_conversation(conv_id: str, db: Session = Depends(get_db)):

    c = db.query(Conversation).filter(Conversation.id == conv_id).first()

    if not c:
        raise HTTPException(404, "Conversation not found")

    return ConversationDetail.model_validate(c).model_dump()


@router.patch("/{conv_id}", summary="Rename conversation")
def rename(conv_id: str, req: RenameRequest, db: Session = Depends(get_db)):

    c = db.query(Conversation).filter(Conversation.id == conv_id).first()

    if not c:
        raise HTTPException(404, "Conversation not found")

    c.title = req.title
    db.commit()

    return {
        "id": c.id,
        "title": c.title
    }


@router.delete("/{conv_id}", summary="Delete conversation")
def delete(conv_id: str, db: Session = Depends(get_db)):

    c = db.query(Conversation).filter(Conversation.id == conv_id).first()

    if not c:
        raise HTTPException(404, "Conversation not found")

    db.delete(c)
    db.commit()

    return {
        "deleted": True,
        "id": conv_id
    }