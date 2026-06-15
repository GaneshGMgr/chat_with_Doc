from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path

import httpx


BASE = Path(__file__).resolve().parent
DATASET = BASE / "eval_dataset.json"
THRESHOLDS = BASE / "thresholds.json"
RESULTS = BASE / "eval_results.json"
URL = "http://localhost:8000/api/v1/chat/stream"


def load_json(path: Path, default):
	try:
		text = path.read_text(encoding="utf-8").strip()
		return json.loads(text) if text else default
	except Exception:
		return default


async def run_one(client: httpx.AsyncClient, item: dict) -> dict:
	result = {"id": item["id"], "question": item["question"]}
	try:
		async with client.stream(
			"POST", URL,
			json={"query": item["question"], "model": "ollama/llama3.2", "conversation_history": []},
		) as response:
			response.raise_for_status()
			answer, citations, event, data, latency = [], [], None, [], 0
			async for line in response.aiter_lines():
				if line.startswith("event:"):
					event = line.split(":", 1)[1].strip()
				elif line.startswith("data:"):
					data.append(line.split(":", 1)[1].strip())
				elif not line and event:
					payload = json.loads("\n".join(data) or "{}")
					if event == "token": answer.append(payload.get("content", ""))
					elif event == "citations": citations = payload.get("chunks", [])
					elif event == "done": latency = payload.get("latency_ms", 0)
					event, data = None, []
	except (httpx.RequestError, httpx.HTTPStatusError, json.JSONDecodeError) as exc:
		result.update({"answer": "", "citations": [], "latency_ms": 0, "error": str(exc)})
		return result

	answer_text = "".join(answer)
	hit = any(k.lower() in answer_text.lower() for k in item["expected_keywords"])
	result.update({"answer": answer_text, "citations": citations, "latency_ms": latency, "keyword_hit": hit, "has_citations": bool(citations), "pass": hit and bool(citations)})
	return result


async def main() -> int:
	dataset = load_json(DATASET, [])
	thresholds = load_json(THRESHOLDS, {"min_faithfulness": 0.5, "min_citation_rate": 0.5})
	rows = []
	async with httpx.AsyncClient(timeout=30.0) as client:
		for item in dataset:
			rows.append(await run_one(client, item))

	faithfulness = sum(1 for r in rows if r.get("keyword_hit")) / len(rows) if rows else 0.0
	citation_rate = sum(1 for r in rows if r.get("has_citations")) / len(rows) if rows else 0.0
	avg_latency = sum(r.get("latency_ms", 0) for r in rows) / len(rows) if rows else 0.0
	results_output = {
		"timestamp": datetime.utcnow().isoformat(),
		"total_evals": len(rows),
		"faithfulness_score": faithfulness,
		"citation_rate": citation_rate,
		"avg_latency_ms": avg_latency,
		"passed": True,
		"individual_results": rows,
	}
	Path("eval_results.json").write_text(json.dumps(results_output, indent=2), encoding="utf-8")

	print("ID | Question | keyword_hit | citations | ms | PASS/FAIL")
	for r in rows:
		print(f"{r['id']} | {r['question'][:48]} | {r.get('keyword_hit', False)} | {r.get('has_citations', False)} | {r.get('latency_ms', 0)} | {'PASS' if r.get('pass') else 'FAIL'}")
	print(f"faithfulness_score={faithfulness:.3f} citation_rate={citation_rate:.3f} avg_latency_ms={avg_latency:.1f}")

	if faithfulness < thresholds.get("min_faithfulness", 0.5) or citation_rate < thresholds.get("min_citation_rate", 0.5):
		results_output["passed"] = False
		Path("eval_results.json").write_text(json.dumps(results_output, indent=2), encoding="utf-8")
		print("EVAL FAILED")
		return 1
	if avg_latency > thresholds.get("max_avg_latency_ms", 10000):
		results_output["passed"] = False
		Path("eval_results.json").write_text(json.dumps(results_output, indent=2), encoding="utf-8")
		print("EVAL FAILED")
		return 1
	print("EVAL PASSED")
	return 0


if __name__ == "__main__":
	raise SystemExit(asyncio.run(main()))
