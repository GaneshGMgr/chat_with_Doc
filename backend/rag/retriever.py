# backend\rag\retriever.py

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.utils import embedding_functions
from rank_bm25 import BM25Okapi

from backend.config import settings


logger = logging.getLogger(__name__)

_chroma_client = None
_embed_fn = None


def get_chroma_client():
    global _chroma_client

    if _chroma_client is None:
        import os
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

        _chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR
        )

    return _chroma_client


def get_embed_fn():
    global _embed_fn

    if _embed_fn is None:
        _embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=settings.EMBEDDING_MODEL,
            device=settings.EMBEDDING_DEVICE
        )

    return _embed_fn


def get_collection():
    return get_chroma_client().get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        embedding_function=get_embed_fn(),
        metadata={"hnsw:space": "cosine"}
    )


def add_chunks(chunks: List[Dict[str, Any]]) -> List[str]:
    coll = get_collection()

    coll.add(
        documents=[c["text"] for c in chunks],
        ids=[c["id"] for c in chunks],
        metadatas=[c.get("metadata", {}) for c in chunks]
    )

    logger.info(f"Added {len(chunks)} chunks")
    return [c["id"] for c in chunks]


def delete_document_chunks(document_id: str):
    coll = get_collection()
    res = coll.get(where={"document_id": document_id})

    if res["ids"]:
        coll.delete(ids=res["ids"])


def semantic_search(
    query: str,
    top_k: int = 10,
    collection_ids: Optional[List[str]] = None
) -> List[Dict]:

    coll = get_collection()
    n = coll.count()

    if n == 0:
        return []

    where = {"collection_id": {"$in": collection_ids}} if collection_ids else None

    res = coll.query(
        query_texts=[query],
        n_results=min(top_k, n),
        where=where,
        include=["documents", "metadatas", "distances"]
    )

    hits = []

    if res["ids"] and res["ids"][0]:
        for i, cid in enumerate(res["ids"][0]):
            hits.append({
                "id": cid,
                "text": res["documents"][0][i],
                "metadata": res["metadatas"][0][i],
                "score": round(1.0 - res["distances"][0][i], 4),
                "source": "semantic"
            })

    return hits


def bm25_search(
    query: str,
    corpus: List[Dict],
    top_k: int = 10
) -> List[Dict]:

    if not corpus:
        return []

    bm25 = BM25Okapi([c["text"].lower().split() for c in corpus])
    scores = bm25.get_scores(query.lower().split())

    ranked = sorted(
        zip(corpus, scores),
        key=lambda x: x[1],
        reverse=True
    )[:top_k]

    return [
        {**c, "score": round(float(s), 4), "source": "bm25"}
        for c, s in ranked
        if s > 0
    ]


def rrf_fuse(lists: List[List[Dict]], k: int = 60) -> List[Dict]:
    scores: Dict[str, float] = {}
    by_id: Dict[str, Dict] = {}

    for lst in lists:
        for rank, chunk in enumerate(lst, 1):
            cid = chunk["id"]

            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)

            if cid not in by_id:
                by_id[cid] = chunk

    return [
        {**by_id[cid], "score": round(s, 6), "source": "hybrid"}
        for cid, s in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]


def hybrid_retrieve(
    query: str,
    top_k: int = None,
    collection_ids: Optional[List[str]] = None,
    use_bm25: bool = True
) -> List[Dict]:

    t0 = time.time()
    top_k = top_k or settings.MAX_CHUNKS_PER_QUERY

    sem = semantic_search(
        query,
        top_k=top_k * 3,
        collection_ids=collection_ids
    )
    logger.debug(
        "hybrid_retrieve: semantic=%d results in %.0fms",
        len(sem), (time.time() - t0) * 1000
    )

    if not use_bm25 or not sem:
        return sem[:top_k]

    return rrf_fuse([
        sem,
        bm25_search(query, corpus=sem, top_k=top_k * 3)
    ])[:top_k]