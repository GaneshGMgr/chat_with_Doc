# rag_backend\backend\rag\router.py

from __future__ import annotations

import logging
import time

from typing import Any, Dict, List, Optional

from backend.config import settings


logger = logging.getLogger(__name__)


CATALOGUE = {
    "openai": {
        "name": "OpenAI",
        "models": [
            {"id": "openai:gpt-4o", "label": "GPT-4o", "ctx": 128000},
            {"id": "openai:gpt-4o-mini", "label": "GPT-4o Mini", "ctx": 128000},
            {"id": "openai:gpt-3.5-turbo", "label": "GPT-3.5 Turbo", "ctx": 16385},
        ]
    },

    "groq": {
        "name": "Groq (Fast Inference)",
        "models": [
            {"id": "groq:llama-3.3-70b-versatile", "label": "LLaMA 3.3 70B", "ctx": 32768},
            {"id": "groq:llama-3.1-8b-instant", "label": "LLaMA 3.1 8B  (Fast)", "ctx": 131072},
            {"id": "groq:deepseek-r1-distill-llama-70b", "label": "DeepSeek R1 70B (Reasoning)", "ctx": 131072},
            {"id": "groq:meta-llama/llama-4-scout-17b-16e-instruct", "label": "LLaMA 4 Scout 17B (Vision + Text)", "ctx": 131072, "vision": True}
        ]
    },

    "ollama": {
        "name": "Ollama (Local)",
        "endpoint": settings.OLLAMA_BASE_URL,
        "models": [
            {"id": "ollama:gemma4", "label": "Gemma 4", "size_gb": 9.6},
            {"id": "ollama:llama3.2", "label": "LLaMA 3.2 (3B)", "size_gb": 2.0},
            {"id": "ollama:mistral", "label": "Mistral 7B", "size_gb": 4.1},
        ]
    },
}


def _parse(m: str):
    if ":" not in m:
        return "openai", settings.OPENAI_DEFAULT_MODEL

    p, mid = m.split(":", 1)
    return p.lower(), mid


async def _stream_openai(msgs, model, temp, max_tok):
    from openai import AsyncOpenAI

    s = await AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY
    ).chat.completions.create(
        model=model,
        messages=msgs,
        temperature=temp,
        max_tokens=max_tok,
        stream=True
    )

    async for chunk in s:
        d = chunk.choices[0].delta
        if d.content:
            yield d.content


async def _stream_groq(msgs, model, temp, max_tok):
    from groq import AsyncGroq

    s = await AsyncGroq(
        api_key=settings.GROQ_API_KEY
    ).chat.completions.create(
        model=model,
        messages=msgs,
        temperature=temp,
        max_tokens=max_tok,
        stream=True
    )

    async for chunk in s:
        d = chunk.choices[0].delta
        if d.content:
            yield d.content


async def _stream_ollama(msgs, model, temp, max_tok):
    import httpx
    import json

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={
                "model": model,
                "messages": msgs,
                "stream": True,
                "options": {
                    "temperature": temp,
                    "num_predict": max_tok
                }
            }
        ) as r:

            r.raise_for_status()

            async for line in r.aiter_lines():
                if line.strip():
                    try:
                        c = json.loads(line).get("message", {}).get("content", "")
                        if c:
                            yield c
                    except:
                        continue


async def stream_llm(
    model: str,
    messages: List[Dict],
    temperature: float = 0.7,
    max_tokens: int = 2048
):
    provider, model_id = _parse(model)

    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set")

        async for t in _stream_openai(
            messages,
            model_id,
            temperature,
            max_tokens
        ):
            yield t

    elif provider == "groq":
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY not set")

        async for t in _stream_groq(
            messages,
            model_id,
            temperature,
            max_tokens
        ):
            yield t

    elif provider == "ollama":
        async for t in _stream_ollama(
            messages,
            model_id,
            temperature,
            max_tokens
        ):
            yield t

    else:
        raise ValueError(f"Unknown provider: {provider}")


async def validate_provider(provider: str) -> Dict[str, Any]:
    t0 = time.time()

    try:
        if provider == "openai":
            if not settings.OPENAI_API_KEY:
                return {
                    "provider": "openai",
                    "available": False,
                    "latency_ms": None,
                    "error": "OPENAI_API_KEY not set"
                }

            from openai import AsyncOpenAI
            await AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY
            ).models.list()

        elif provider == "groq":
            if not settings.GROQ_API_KEY:
                return {
                    "provider": "groq",
                    "available": False,
                    "latency_ms": None,
                    "error": "GROQ_API_KEY not set"
                }

            from groq import AsyncGroq
            await AsyncGroq(
                api_key=settings.GROQ_API_KEY
            ).models.list()

        elif provider == "ollama":
            import httpx

            async with httpx.AsyncClient(timeout=5.0) as c:
                (
                    await c.get(
                        f"{settings.OLLAMA_BASE_URL}/api/tags"
                    )
                ).raise_for_status()

        ms = int((time.time() - t0) * 1000)

        return {
            "provider": provider,
            "available": True,
            "latency_ms": ms,
            "error": None
        }

    except Exception as e:
        return {
            "provider": provider,
            "available": False,
            "latency_ms": int((time.time() - t0) * 1000),
            "error": str(e)
        }


async def get_ollama_models() -> List[Dict]:
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.get(
                f"{settings.OLLAMA_BASE_URL}/api/tags"
            )

            return [
                {
                    "id": f"ollama:{m['name']}",
                    "label": m["name"],
                    "size_gb": round(m.get("size", 0) / 1e9, 1)
                }
                for m in r.json().get("models", [])
            ]

    except:
        return CATALOGUE["ollama"]["models"]