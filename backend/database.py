# backend\database.py

import os
import uuid

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    create_engine
)
from sqlalchemy.orm import (
    DeclarativeBase,
    relationship,
    sessionmaker
)

from backend.config import settings


os.makedirs("./data", exist_ok=True)


engine = create_engine(
    settings.SQLITE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def uid(p=""):
    return f"{p}{uuid.uuid4().hex[:10]}"


class Base(DeclarativeBase):
    pass


class Collection(Base):

    __tablename__ = "collections"

    id = Column(
        String,
        primary_key=True,
        default=lambda: uid("coll_")
    )

    name = Column(String(256), nullable=False)
    description = Column(Text, default="")
    color = Column(String(16), default="#6c47ff")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    documents = relationship(
        "Document",
        back_populates="collection",
        cascade="all,delete-orphan"
    )


class Document(Base):

    __tablename__ = "documents"

    id = Column(
        String,
        primary_key=True,
        default=lambda: uid("doc_")
    )

    collection_id = Column(
        String,
        ForeignKey("collections.id"),
        nullable=True
    )

    name = Column(String(512), nullable=False)
    source_type = Column(String(16), nullable=False)

    source_url = Column(Text, nullable=True)
    file_path = Column(Text, nullable=True)

    size_bytes = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)

    status = Column(String(32), default="pending")
    meta = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    collection = relationship(
        "Collection",
        back_populates="documents"
    )

    chunks = relationship(
        "Chunk",
        back_populates="document",
        cascade="all,delete-orphan"
    )

    ingest_jobs = relationship(
        "IngestJob",
        back_populates="document",
        cascade="all,delete-orphan"
    )


class Chunk(Base):

    __tablename__ = "chunks"

    id = Column(
        String,
        primary_key=True,
        default=lambda: uid("ck_")
    )

    document_id = Column(
        String,
        ForeignKey("documents.id"),
        nullable=False
    )

    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)

    page = Column(Integer, nullable=True)
    section = Column(String(512), nullable=True)

    token_count = Column(Integer, default=0)
    chroma_id = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship(
        "Document",
        back_populates="chunks"
    )


class IngestJob(Base):

    __tablename__ = "ingest_jobs"

    id = Column(
        String,
        primary_key=True,
        default=lambda: uid("job_")
    )

    document_id = Column(
        String,
        ForeignKey("documents.id"),
        nullable=False
    )

    celery_task_id = Column(String, nullable=True)

    status = Column(String(32), default="queued")
    stage = Column(String(32), nullable=True)

    progress = Column(Float, default=0.0)

    chunks_created = Column(Integer, default=0)
    chunks_total = Column(Integer, default=0)

    error = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship(
        "Document",
        back_populates="ingest_jobs"
    )


class Conversation(Base):

    __tablename__ = "conversations"

    id = Column(
        String,
        primary_key=True,
        default=lambda: uid("conv_")
    )

    title = Column(String(512), nullable=True)

    model = Column(
        String(128),
        default="openai:gpt-4o-mini"
    )

    collection_ids = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all,delete-orphan",
        order_by="Message.created_at"
    )


class Message(Base):

    __tablename__ = "messages"

    id = Column(
        String,
        primary_key=True,
        default=lambda: uid("msg_")
    )

    conversation_id = Column(
        String,
        ForeignKey("conversations.id"),
        nullable=False
    )

    role = Column(String(16), nullable=False)
    content = Column(Text, nullable=False)

    model = Column(String(128), nullable=True)

    citations = Column(JSON, default=list)
    tokens_used = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship(
        "Conversation",
        back_populates="messages"
    )


def init_db():
    Base.metadata.create_all(bind=engine)