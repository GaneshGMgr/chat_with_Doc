# backend\evals\01_retriever_with_reranker_evaluation.py
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Turn off LangSmith tracing explicitly
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from deepeval import evaluate
from deepeval.evaluate import DisplayConfig, CacheConfig
from deepeval.metrics import ContextualPrecisionMetric, ContextualRecallMetric
from deepeval.models import GeminiModel
from deepeval.test_case import LLMTestCase

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.reranker import RerankingRetriever

GOLDEN_PATH = "goldens/retriever_deepeval_goldens.json"
THRESHOLD = 0.7

# Updated judge model identifier
judge_model = GeminiModel(
    model="gemini-2.5-flash",
    api_key=os.getenv("GOOGLE_API_KEY"),
)

with open(GOLDEN_PATH) as f:
    goldens = json.load(f)

retriever = RerankingRetriever()
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

metrics = [
    ContextualRecallMetric(threshold=THRESHOLD, model=judge_model, include_reason=True),
    ContextualPrecisionMetric(threshold=THRESHOLD, model=judge_model, include_reason=True),
]

evaluate(
    test_cases=test_cases,
    metrics=metrics,
    display_config=DisplayConfig(
        verbose_mode=False,
    ),
    cache_config=CacheConfig(
        use_cache=False,
        write_cache=False,
    ),
    hyperparameters={
        "retriever": "reranked",
        "embedding_model": "gemini-embedding-001",
        "chunk_size": 1000,
        "chunk_overlap": 150,
        "top_k": 5,
        "judge_model": "gemini-2.5-flash",
        "golden_set": GOLDEN_PATH,
    },
)

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