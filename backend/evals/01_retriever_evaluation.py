# backend\evals\01_retriever_evaluation.py
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from deepeval import evaluate
from deepeval.evaluate import DisplayConfig, CacheConfig
from deepeval.test_case import LLMTestCase
from deepeval.metrics import ContextualRecallMetric, ContextualPrecisionMetric
from deepeval.models import GeminiModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.retriever import build_retriever

THRESHOLD = 0.7
GOLDEN_PATH = "goldens/retriever_deepeval_goldens.json"
THRESHOLD = 0.7

judge_model = GeminiModel(
    model="gemini-2.5-flash",
    api_key=os.getenv("GOOGLE_API_KEY"),
)

def run(retriever):
    # 1. LOAD the golden set --- the fixed, human-authored truth
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE INJECTED RETRIEVER on each question to fill retrieval_context,
    #    then build one test case per golden.
    test_cases = []
    for g in goldens:
        retrieved = retriever.invoke(g["query"])
        retrieval_context = [doc.page_content for doc in retrieved]

        test_cases.append(
            LLMTestCase(
                input=g["query"],
                expected_output=g["ideal_answer"],
                retrieval_context=retrieval_context,
                actual_output="(generator not evaluated in this run)",
            )
        )

    # 3. THE METRICS --- recall (did we miss?) and precision (ranked well?)
    metrics = [
        ContextualRecallMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
        ContextualPrecisionMetric(threshold=THRESHOLD, model=JUDGE_MODEL, include_reason=True),
    ]

    # 4. EVALUATE --- every metric on every case, batched + parallel, printed report.
    #    hyperparameters travel with the run so the report is tagged with the config.
    result = evaluate(
        test_cases=test_cases,
        metrics=metrics,
        hyperparameters={
            "retriever": "reranker",          # vs "reranked" when you swap it in
            "embedding_model": "text-embedding-3-large",
            "chunk_size": 1000,
            "chunk_overlap": 150,
            "top_k": 3,
            "judge_model": JUDGE_MODEL,
            "golden_set": GOLDEN_PATH,
        },
    )
    return summarize_by_metric(result)


def run_local():
    """Standalone convenience: build the retriever, then run."""
    return run(RerankingRetriever())


if __name__ == "__main__":
    print_summary("retriever", run_local())


#### Improve the RAG retriever with reranker for better retrieval quality
# 1. Chunking
# Change chunk size and chunk overlap to see how they affect retrieval quality.

# 2. Embedding model
# Change the embedding model to see how it affects semantic retrieval quality.

# 3. Top-k
# Change the number of retrieved chunks (k) to see how it affects retrieval quality.

# 4. Reranking
# Add or change a reranker model to see whether reranking improves the relevance
# of the retrieved chunks.

# 5. Retrieval strategy
# Compare different retrieval strategies, such as:
# - similarity search
# - MMR (Maximum Marginal Relevance)
# - hybrid search (keyword + vector search)

# 6. Search parameters
# Tune retrieval parameters such as similarity thresholds or MMR parameters
# to control which chunks are returned.

# 7. Evaluate consistently
# Run the same evaluation dataset for every configuration and compare
# retrieval metrics to determine which configuration performs better.