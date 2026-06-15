# backend/routers/metrics.py
from fastapi import APIRouter, Query

from backend.observability.langfuse_client import get_langfuse
from backend.observability.metrics import compute_all_metrics
from backend.config import settings
import httpx
import logging

logger = logging.getLogger(__name__)


router = APIRouter(tags=["metrics"])


@router.get("/metrics")
def get_metrics(last_n: int = Query(default=100, ge=10, le=1000)):
    lf = get_langfuse()
    if lf is None:
        return {"error": "Langfuse not configured", "metrics": {}}

    records = []
    try:
        if hasattr(lf, "fetch_traces"):
            traces = lf.fetch_traces(limit=last_n)
            items = getattr(traces, "data", [])
        else:
            # fallback to Langfuse HTTP API
            url = f"{settings.LANGFUSE_HOST}/api/traces?limit={last_n}"
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 200:
                body = resp.json()
                items = body.get("data", [])
            else:
                items = []

        for trace in items:
            # trace may be an object (SDK) or dict (HTTP)
            if isinstance(trace, dict):
                meta = trace.get("metadata", {}) or {}
                latency = trace.get("latency", 0) or 0
            else:
                meta = getattr(trace, "metadata", {}) or {}
                latency = getattr(trace, "latency", 0) or 0

            records.append({
                "latency_ms": latency,
                "tokens_used": meta.get("tokens_used", 0),
                "citation_coverage": meta.get("citation_coverage", 0.0),
                "error": meta.get("error", None),
            })

    except Exception as exc:
        logger.exception("Failed to fetch traces from Langfuse: %s", exc)
        return {"error": "Failed to fetch traces", "metrics": {}}

    metrics = compute_all_metrics(records)
    return {"trace_count": len(records), "metrics": metrics}