# rag_backend\backend\routers\chat.py

from __future__ import annotations

import json
import logging
import uuid

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from sqlalchemy.orm import Session

from backend.database import get_db, Conversation, Message
from backend.schemas.schemas import ChatRequest, RegenerateRequest
from backend.rag.pipeline import run_rag_pipeline


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


def _auto_title(t: str):
    w = t.split()[:8]
    s = " ".join(w)
    return s[:80] + ("..." if len(s) > 80 else "")


def _get_or_create(db: Session, req: ChatRequest):
    if req.conversation_id:
        c = (
            db.query(Conversation)
            .filter(Conversation.id == req.conversation_id)
            .first()
        )

        if not c:
            raise HTTPException(404, "Conversation not found")

        return c

    c = Conversation(
        model=req.model,
        collection_ids=req.collection_ids
    )

    db.add(c)
    db.commit()
    db.refresh(c)

    return c


@router.post("", summary="Chat with SSE streaming + citations")
async def chat(req: ChatRequest, db: Session = Depends(get_db)):

    conv = _get_or_create(db, req)

    db.add(
        Message(
            conversation_id=conv.id,
            role="user",
            content=req.message
        )
    )

    if not conv.title:
        conv.title = _auto_title(req.message)

    db.commit()

    history = [
        {"role": m.role, "content": m.content}
        for m in conv.messages[:-1]
    ]

    mid = f"msg_{uuid.uuid4().hex[:10]}"
    full = []
    cites = []

    async def gen():
        async for chunk in run_rag_pipeline(
            query=req.message,
            model=req.model,
            conversation_history=history,
            collection_ids=req.collection_ids or None,
            options=req.options.model_dump(),
            message_id=mid
        ):

            if chunk.startswith("event: citations"):
                try:
                    e = json.loads(chunk.split("data: ", 1)[-1].strip())
                    cites.extend(e.get("chunks", []))
                except:
                    pass

            elif chunk.startswith("event: token"):
                try:
                    e = json.loads(chunk.split("data: ", 1)[-1].strip())
                    full.append(e.get("content", ""))
                except:
                    pass

            elif chunk.startswith("event: done"):
                db.add(
                    Message(
                        id=mid,
                        conversation_id=conv.id,
                        role="assistant",
                        content="".join(full),
                        model=req.model,
                        citations=cites
                    )
                )

                conv.updated_at = datetime.utcnow()
                db.commit()

            yield chunk

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*"
        }
    )


@router.post("/{message_id}/regenerate", summary="Regenerate a response")
async def regenerate(message_id: str, req: RegenerateRequest, db: Session = Depends(get_db)):

    msg = db.query(Message).filter(Message.id == message_id).first()

    if not msg:
        raise HTTPException(404, "Message not found")

    conv = db.query(Conversation).filter(
        Conversation.id == msg.conversation_id
    ).first()

    prev = [
        m for m in conv.messages
        if m.created_at < msg.created_at and m.role == "user"
    ]

    if not prev:
        raise HTTPException(400, "No user message found")

    umsg = prev[-1]
    model = req.model or conv.model

    history = [
        {"role": m.role, "content": m.content}
        for m in conv.messages
        if m.created_at < umsg.created_at
    ]

    nid = f"msg_{uuid.uuid4().hex[:10]}"
    full = []
    cites = []

    async def gen():
        async for chunk in run_rag_pipeline(
            query=umsg.content,
            model=model,
            conversation_history=history,
            collection_ids=conv.collection_ids,
            message_id=nid
        ):

            if chunk.startswith("event: citations"):
                try:
                    e = json.loads(chunk.split("data: ", 1)[-1].strip())
                    cites.extend(e.get("chunks", []))
                except:
                    pass

            elif chunk.startswith("event: token"):
                try:
                    e = json.loads(chunk.split("data: ", 1)[-1].strip())
                    full.append(e.get("content", ""))
                except:
                    pass

            elif chunk.startswith("event: done"):
                db.add(
                    Message(
                        id=nid,
                        conversation_id=conv.id,
                        role="assistant",
                        content="".join(full),
                        model=model,
                        citations=cites
                    )
                )
                db.commit()

            yield chunk

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )