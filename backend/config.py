# backend/config.py

from functools import lru_cache
from typing import Optional, List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    APP_NAME: str = "RAG Knowledge Base"
    APP_VERSION: str = "1.0.0"

    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001"
    ]

    SQLITE_URL: str = "sqlite:///./data/rag.db"
    REDIS_URL: str = "redis://redis:6379/0"

    CHROMA_PERSIST_DIR: str = "./data/chroma"
    CHROMA_COLLECTION: str = "rag_documents"

    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"

    DEFAULT_CHUNK_SIZE: int = 600
    DEFAULT_CHUNK_OVERLAP: int = 100
    MAX_CHUNKS_PER_QUERY: int = 8

    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None

    # --- Langfuse Observability ---
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "http://localhost:3001"
    LANGFUSE_ENABLED: bool = True


    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"

    OPENAI_DEFAULT_MODEL: str = "gpt-4o-mini"
    GROQ_DEFAULT_MODEL: str = "llama-3.3-70b-versatile"
    OLLAMA_DEFAULT_MODEL: str = "llama3.2"

    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RERANKER_TOP_N: int = 4

    MAX_FILE_SIZE_MB: int = 50
    UPLOAD_DIR: str = "./data/uploads"

    WHISPER_MODEL: str = "base"
    DEFAULT_TTS_VOICE: str = "en-US-AriaNeural"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore" 


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()