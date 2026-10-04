# backend\evals\03_rag_pipeline_evaluation.py
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# RATE LIMIT HANDLING (Layer 1: DeepEval Internal Retry & Backoff Config)

# Retries failed API calls up to 8 times when hitting rate limits (HTTP 429)
os.environ.setdefault("DEEPEVAL_RETRY_MAX_ATTEMPTS", "8")
# Caps exponential backoff sleep time to 90 seconds max between retries
os.environ.setdefault("DEEPEVAL_RETRY_CAP_SECONDS", "90")
# Extends per-request timeout to 60s so slow/throttled API responses don't abort
os.environ["DEEPEVAL_PER_ATTEMPT_TIMEOUT_SECONDS_OVERRIDE"] = "60"

from deepeval import evaluate
from deepeval.evaluate import AsyncConfig, CacheConfig, DisplayConfig
from deepeval.metrics import (
    AnswerRelevancyMetric,
    ContextualRelevancyMetric,
    FaithfulnessMetric,
)
from deepeval.models import GeminiModel
from deepeval.test_case import LLMTestCase

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.rag_pipeline import RagPipeline

GOLDEN_PATH = "goldens/faithfulness_dataset.json"
THRESHOLD = 0.7

judge_model = GeminiModel(
    model="gemini-3.5-flash",
    api_key=os.getenv("GOOGLE_API_KEY"),
)

# 1. LOAD DATASET
def run(rag):
    # 1. LOAD queries (we only need the queries --- context comes from the pipeline now)
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED PIPELINE per query, build a test case from LIVE output
    test_cases = []
    for g in goldens:
        result = rag.invoke(g["query"])          # retrieve -> rerank -> generate

        test_cases.append(
            LLMTestCase(
                input=g["query"],
                actual_output=result["answer"],       # what the generator produced
                retrieval_context=result["context"],  # what the RETRIEVER returned
            )
        )

    # 3. THE THREE TRIAD METRICS
    metrics = [
        ContextualRelevancyMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
        FaithfulnessMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
        AnswerRelevancyMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
    ]

    # 4. EVALUATE
    result = evaluate(test_cases=test_cases, metrics=metrics)
    return summarize_by_metric(result)


def run_local():
    """Standalone convenience: build the pipeline, then run."""
    return run(RagPipeline())


if __name__ == "__main__":
    print_summary("rag_pipeline", run_local())