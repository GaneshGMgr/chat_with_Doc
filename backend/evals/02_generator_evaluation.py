# backend\evals\02_generator_evaluation.py
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

os.environ["LANGCHAIN_TRACING_V2"] = "false"

from deepeval import evaluate
from deepeval.evaluate import DisplayConfig, CacheConfig
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric
from deepeval.models import GeminiModel
from deepeval.test_case import LLMTestCase

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.generator import generate

GOLDEN_PATH = "goldens/faithfulness_dataset.json"
THRESHOLD = 0.7

judge_model = GeminiModel(
    model="gemini-3.5-flash",
    api_key=os.getenv("GOOGLE_API_KEY"),
)

def run():
    # 1. LOAD the faithfulness golden set (query + ideal_context)
    goldens = load_goldens(GOLDEN_PATH)

    # 2. RUN THE GENERATOR on the GOLDEN context (isolation), build one test case each
    test_cases = []
    for g in goldens:
        context = g["ideal_context"]              # known-good context (list of chunk strings)
        answer = generate(g["query"], context)    # RUN the generator -> actual_output

        test_cases.append(
            LLMTestCase(
                input=g["query"],
                actual_output=answer,             # the generated answer we're judging
                retrieval_context=context,        # faithfulness checks the answer against THIS
                # no expected_output --- faithfulness never reads it
            )
        )

    # 3. THE METRICS --- decompose actual_output into claims, attribute each to context
    metrics = [
        FaithfulnessMetric(
            threshold=THRESHOLD,
            model=JUDGE_MODEL,
            include_reason=True,   # prints WHY each score --- shows which claims were unsupported
        ),
        AnswerRelevancyMetric(
            threshold=THRESHOLD,
            model=JUDGE_MODEL,
            include_reason=True,
        ),
    ]

    # 4. EVALUATE --- runs the metrics on every case, prints a report
    result = evaluate(test_cases=test_cases, metrics=metrics)
    return summarize_by_metric(result)


if __name__ == "__main__":
    print_summary("generator", run())

# uv run evals/eval_generator.py

### Improve the RAG generator for better faithfulness and answer relevancy
# 1. Generation model
# Change the LLM to a stronger model with better instruction following
# and reasoning ability.

# 2. System prompt
# Improve the system prompt to give the generator clear instructions
# about how it should use the retrieved context and answer the question.

# 3. User prompt / prompt template
# Improve the prompt structure so the question and retrieved context
# are presented clearly to the model.

# 4. Temperature
# Tune the temperature to control how deterministic or creative
# the generated answers are.

# 5. Context handling
# Change how many retrieved chunks are passed to the generator and
# how the context is organized to reduce irrelevant information.

# 6. Output instructions
# Specify how the generator should format its answer, such as being
# concise, directly answering the question, and avoiding unsupported claims.

# 7. Evaluation
# Run the same evaluation dataset for each configuration and compare
# metrics such as faithfulness and answer relevancy.