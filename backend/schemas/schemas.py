# rag_backend\backend\schemas\schemas.py

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: str = ""
    color: str = "#6c47ff"


class CollectionOut(BaseModel):
    id: str
    name: str
    description: str
    color: str
    document_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: str
    name: str
    source_type: str
    source_url: Optional[str]
    size_bytes: int
    chunk_count: int
    status: str
    collection_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChunkOut(BaseModel):
    id: str
    chunk_index: int
    page: Optional[int]
    section: Optional[str]
    text: str
    token_count: int

    class Config:
        from_attributes = True


class IngestURLRequest(BaseModel):
    url: str = Field(..., min_length=5)
    collection_id: Optional[str] = None
    chunk_size: int = Field(600, ge=100, le=2000)
    chunk_overlap: int = Field(100, ge=0, le=500)
    metadata: dict = Field(default_factory=dict)


class ChatOptions(BaseModel):
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(2048, ge=64, le=8192)
    top_k_chunks: int = Field(6, ge=1, le=20)
    rerank: bool = True
    hybrid_search: bool = True


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[str] = None
    model: str = "openai:gpt-4o-mini"
    collection_ids: List[str] = Field(default_factory=list)
    stream: bool = True
    options: ChatOptions = Field(default_factory=ChatOptions)


class RegenerateRequest(BaseModel):
    model: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    model: Optional[str]
    citations: List[dict]
    tokens_used: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    id: str
    title: Optional[str]
    model: str
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: str
    title: Optional[str]
    model: str
    messages: List[MessageOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)


class ModelInfo(BaseModel):
    id: str
    label: str
    ctx: Optional[int] = None
    size_gb: Optional[float] = None


class ProviderInfo(BaseModel):
    id: str
    name: str
    available: bool
    latency_ms: Optional[int] = None
    endpoint: Optional[str] = None
    models: List[ModelInfo]


class ModelsResponse(BaseModel):
    providers: List[ProviderInfo]


class ValidateResponse(BaseModel):
    provider: str
    available: bool
    latency_ms: Optional[int]
    error: Optional[str]


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    voice: str = "en-US-AriaNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"


class VoiceInfo(BaseModel):
    id: str
    language: str
    gender: str


class HealthResponse(BaseModel):
    status: str
    components: dict
    uptime_s: int
    version: str


class StatsResponse(BaseModel):
    documents: int
    total_chunks: int
    conversations: int
    messages: int
    collections: int
    vector_db_size: str
    jobs_queued: int
    jobs_running: int