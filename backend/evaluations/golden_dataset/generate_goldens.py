# rag-eval-deepeval\goldens\generate_goldens.py
import json
import logging
import os
import random
import re
import time
from pathlib import Path

from deepeval.models import GeminiModel
from deepeval.synthesizer import Synthesizer
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter

# --- retry-with-backoff imports ---
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.genai.errors import ClientError

# Path resolution (Resolves rag-eval-deepeval root regardless of invocation location)
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name in ["src", "goldens"] else SCRIPT_DIR

# Force override environment variables with .env values
load_dotenv(BASE_DIR / ".env", override=True)

# Directories
DATA_DIR = BASE_DIR / "data"
GOLDENS_DIR = BASE_DIR / "goldens"
GOLDENS_DIR.mkdir(parents=True, exist_ok=True)


# 1. LOAD & CHUNK TRANSCRIPTS WITH METADATA
def load_chunks_with_metadata():
    chunk_objects = []  # List of tuples: (chunk_text, session_id)
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)

    for path in DATA_DIR.rglob("*.vtt"):
        session_match = re.search(r"Session[ _]*(\d+)", path.name, re.IGNORECASE)
        session_id = session_match.group(1) if session_match else "unknown"

        lines = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line == "WEBVTT" or "-->" in line:
                    continue
                lines.append(line)

        transcript_text = " ".join(lines)
        chunks = splitter.split_text(transcript_text)

        for chunk in chunks:
            chunk_objects.append((chunk, session_id))

    return chunk_objects


# 2. SAMPLE & PREPARE CONTEXTS
all_chunk_objects = load_chunks_with_metadata()

# Sample 10 chunks for generation
sample_size = min(10, len(all_chunk_objects))
sampled_objects = random.sample(all_chunk_objects, sample_size)


# 3. INITIALIZE GEMINI MODEL & SYNTHESIZER
# CHANGED: gemini-3.5-flash free tier = only 5 requests/minute. A single
# context triggers 6-8 internal calls in a burst, which alone exceeds that
# limit. gemini-3.1-flash-lite has a much more generous free-tier RPM.
gemini_model = GeminiModel(
    model="gemini-3.1-flash-lite",
    api_key=os.getenv("GOOGLE_API_KEY"),
)

synthesizer = Synthesizer(model=gemini_model)


# --- retry wrapper around the API-calling function ---
# CHANGED: more attempts (8) and longer waits (up to 120s) -- 5 attempts /
# 90s max wasn't enough runway to clear the per-minute quota last time.
# reraise=True shows you the real ClientError/429 message if it still
# fails after all attempts, instead of a generic tenacity.RetryError.
@retry(
    retry=retry_if_exception_type(ClientError),
    wait=wait_exponential(multiplier=2, min=15, max=120),
    stop=stop_after_attempt(8),
    reraise=True,
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def safe_generate(contexts):
    return synthesizer.generate_goldens_from_contexts(
        contexts=contexts,
        include_expected_output=True,  # Generates ideal_answer
        max_goldens_per_context=1,
    )


# 4. SYNTHESIZE GOLDENS IN BATCHES (STAYS UNDER FREE TIER RPM LIMIT)
batch_size = 1
all_generated_goldens = []

for i in range(0, len(sampled_objects), batch_size):
    batch_objects = sampled_objects[i : i + batch_size]
    batch_contexts = [[chunk_text] for chunk_text, _ in batch_objects]

    print(
        f"\n[Batch {i // batch_size + 1}] Synthesizing goldens for {len(batch_contexts)} context(s)..."
    )

    goldens = safe_generate(batch_contexts)
    all_generated_goldens.extend(goldens)

    # CHANGED: pause 30s instead of 60s (lite model recovers faster;
    # bump this back up if you still see 429s)
    if i + batch_size < len(sampled_objects):
        print("Pausing 30s to reset Gemini Free Tier Rate Limit...")
        time.sleep(30)


# 5. CONVERT TO SCHEMA WITH AUTOMATED SOURCE METADATA
rows = []
for i, g in enumerate(all_generated_goldens, 1):
    context_text = g.context[0] if g.context else ""
    matching_session = "unknown"

    for chunk_text, session in sampled_objects:
        if chunk_text == context_text:
            matching_session = session
            break

    rows.append(
        {
            "id": f"g{i:03d}",
            "query": g.input,
            "ideal_answer": g.expected_output,
            "source": f"Session {matching_session}",
        }
    )


# 6. SAVE DATASET IN rag-eval-deepeval/goldens/
output_file = GOLDENS_DIR / "retriever_deepeval_goldens.json"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully wrote {len(rows)} DRAFT goldens -> {output_file}")
print("!! REVIEW EVERY ONE before using: check grounding, trim padding, fix leading questions.")