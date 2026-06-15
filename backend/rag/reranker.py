# backend\rag\reranker.py

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from backend.config import settings


logger = logging.getLogger(__name__)

_model = None


def _load():
    global _model

    if _model is None:
        from sentence_transformers import CrossEncoder

        _model = CrossEncoder(settings.RERANKER_MODEL)
        logger.info("Reranker loaded")

    return _model


def rerank_chunks(
    query: str,
    chunks: List[Dict[str, Any]],
    top_n: int = None
) -> List[Dict[str, Any]]:

    top_n = top_n or settings.RERANKER_TOP_N

    if not chunks:
        return []

    try:
        t0 = time.time()
        scores = _load().predict(
            [(query, c["text"]) for c in chunks]
        )
        logger.debug(
            "rerank_chunks: scored %d chunks in %.0fms",
            len(chunks), (time.time() - t0) * 1000
        )

        return sorted(
            [
                {**c, "score": round(float(s), 4), "source": "reranked"}
                for c, s in zip(chunks, scores)
            ],
            key=lambda x: x["score"],
            reverse=True
        )[:top_n]

    except Exception as e:
        logger.warning(f"Reranking failed: {e}")
        return chunks[:top_n]