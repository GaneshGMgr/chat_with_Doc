# backend\rag\pipeline.py

from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path

from typing import Any, AsyncGenerator, Dict, List, Optional

from backend.rag.retriever import hybrid_retrieve
from backend.rag.reranker import rerank_chunks
from backend.rag.router import stream_llm
from backend.observability.trace_rag import RagTrace
from backend.config import settings


logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "system_prompt_v1.txt"
SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8").strip()


def build_context(chunks: List[Dict]) -> str:
    parts = []

    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        src = meta.get("source_name", meta.get("source_url", "unknown"))
        page = meta.get("page", "")
        label = f"[{i}] {src}" + (f", p.{page}" if page else "")

        parts.append(f"{label}\n{chunk['text']}")

    return "\n\n---\n\n".join(parts)


def build_citations(chunks: List[Dict]) -> List[Dict]:
    out = []

    for chunk in chunks:
        meta = chunk.get("metadata", {})
        src = meta.get("source_name", meta.get("source_url", "unknown"))
        preview = chunk["text"][:200] + ("..." if len(chunk["text"]) > 200 else "")

        out.append({
            "chunk_id": chunk["id"],
            "source": src,
            "page": meta.get("page"),
            "section": meta.get("section"),
            "score": chunk.get("score", 0.0),
            "preview": preview
        })

    return out


def evt(name: str, payload: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(payload)}\n\n"


async def run_rag_pipeline(
    query: str,
    model: str,
    conversation_history: List[Dict],
    collection_ids: Optional[List[str]] = None,
    options: Optional[Dict] = None,
    message_id: str = "",
) -> AsyncGenerator[str, None]:

    opts = options or {}

    top_k = opts.get("top_k_chunks", settings.MAX_CHUNKS_PER_QUERY)
    use_rerank = opts.get("rerank", True)
    use_hybrid = opts.get("hybrid_search", True)
    temperature = opts.get("temperature", 0.7)
    max_tokens = opts.get("max_tokens", 2048)

    t_start = time.time()
    message_id = message_id or f"msg_{uuid.uuid4().hex[:10]}"
    rag_trace = RagTrace(
        query=query,
        model=model,
        message_id=message_id,
        collection_ids=collection_ids,
    )
    rag_trace.__enter__()

    try:
        yield evt("status", {
            "type": "status",
            "step": "retrieving",
            "message": "Searching knowledge base..."
        })

        try:
            chunks = hybrid_retrieve(
                query=query,
                top_k=top_k,
                collection_ids=collection_ids or None,
                use_bm25=use_hybrid
            )
            rag_trace.metadata["chunks_retrieved"] = len(chunks)

        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            yield evt("error", {
                "type": "error",
                "code": "retrieval_error",
                "message": str(e)
            })
            return

        if not chunks:
            yield evt("error", {
                "type": "error",
                "code": "no_context",
                "message": "No relevant documents found in your knowledge base."
            })
            return

        if use_rerank and len(chunks) > 1:
            yield evt("status", {
                "type": "status",
                "step": "reranking",
                "message": f"Re-ranking {len(chunks)} candidates..."
            })

            try:
                chunks = rerank_chunks(query=query, chunks=chunks)
                rag_trace.metadata["chunks_after_rerank"] = len(chunks)
            except Exception as e:
                logger.warning(f"Rerank skipped: {e}")

        context = build_context(chunks)
        citations = build_citations(chunks)
        cited = sum(1 for c in citations if c.get("score", 0) > 0.3)
        rag_trace.metadata["citation_coverage"] = round(cited / len(citations), 2) if citations else 0.0

        yield evt("citations", {
            "type": "citations",
            "chunks": citations
        })

        yield evt("status", {
            "type": "status",
            "step": "generating",
            "message": f"Generating answer with {model}..."
        })

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        for m in conversation_history[-6:]:
            messages.append({"role": m["role"], "content": m["content"]})

        messages.append({
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion: {query}"
        })

        full = []

        try:
            async for token in stream_llm(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            ):
                full.append(token)
                yield evt("token", {
                    "type": "token",
                    "content": token
                })

        except Exception as e:
            logger.error(f"LLM error: {e}")
            yield evt("error", {
                "type": "error",
                "code": "llm_error",
                "message": str(e)
            })
            return

        answer_text = "".join(full)
        rag_trace.metadata["tokens_used"] = len(answer_text.split())
        rag_trace.metadata["answer_preview"] = answer_text[:500]

        ms = int((time.time() - t_start) * 1000)

        yield evt("done", {
            "type": "done",
            "message_id": message_id,
            "model_used": model,
            "tokens_used": len(" ".join(full).split()),
            "latency_ms": ms
        })
    finally:
        rag_trace.__exit__(None, None, None)