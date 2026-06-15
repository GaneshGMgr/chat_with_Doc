# rag_backend\backend\routers\models.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.rag.router import (
    CATALOGUE,
    validate_provider,
    get_ollama_models
)


router = APIRouter(prefix="/models", tags=["Models"])


@router.get("", summary="List available models")
async def list_models():

    ollama = await get_ollama_models()

    return {
        "providers": [
            {
                "id": pid,
                "name": info["name"],
                "available": True,
                "endpoint": info.get("endpoint"),
                "models": (
                    ollama
                    if pid == "ollama"
                    else info["models"]
                )
            }
            for pid, info in CATALOGUE.items()
        ]
    }


@router.post("/{provider}/validate", summary="Test provider connectivity")
async def validate(provider: str):

    if provider not in CATALOGUE:
        raise HTTPException(400, f"Unknown: {provider}")

    return await validate_provider(provider)