# backend/observability/metrics.py
import logging
import statistics
from typing import Any, Dict, List


logger = logging.getLogger(__name__)


def _sorted_latencies(records: List[Dict[str, Any]]) -> List[float]:
	return sorted(float(record.get("latency_ms", 0)) for record in records)


def _percentile(values: List[float], percentile: float) -> float:
	if not values:
		return 0.0

	index = int(round((len(values) - 1) * percentile))
	index = max(0, min(index, len(values) - 1))
	return float(values[index])


def compute_latency_percentiles(records: List[Dict[str, Any]]) -> Dict[str, float]:
	latencies = _sorted_latencies(records)

	if not latencies:
		return {"p50": 0.0, "p95": 0.0, "p99": 0.0}

	return {
		"p50": _percentile(latencies, 0.50),
		"p95": _percentile(latencies, 0.95),
		"p99": _percentile(latencies, 0.99),
	}


def compute_cost_per_request(
	records: List[Dict[str, Any]],
	cost_per_1k_tokens: float = 0.002,
) -> Dict[str, float]:
	tokens = [float(record.get("tokens_used", 0)) for record in records]

	if not tokens:
		return {"avg_tokens": 0.0, "avg_cost_usd": 0.0, "total_cost_usd": 0.0}

	avg_tokens = float(statistics.mean(tokens))
	total_tokens = float(sum(tokens))
	total_cost_usd = (total_tokens / 1000.0) * cost_per_1k_tokens

	return {
		"avg_tokens": avg_tokens,
		"avg_cost_usd": (avg_tokens / 1000.0) * cost_per_1k_tokens,
		"total_cost_usd": total_cost_usd,
	}


def compute_citation_coverage(records: List[Dict[str, Any]]) -> Dict[str, float]:
	coverages = [float(record.get("citation_coverage", 0.0)) for record in records]

	if not coverages:
		return {"mean_citation_coverage": 0.0, "pct_fully_grounded": 0.0}

	fully_grounded = sum(1 for coverage in coverages if coverage >= 0.8)

	return {
		"mean_citation_coverage": float(statistics.mean(coverages)),
		"pct_fully_grounded": fully_grounded / len(coverages),
	}


def compute_failure_rate(records: List[Dict[str, Any]]) -> Dict[str, Any]:
	total_requests = len(records)
	failed_requests = sum(1 for record in records if record.get("error") is not None)

	if total_requests == 0:
		return {"failure_rate": 0.0, "total_requests": 0, "failed_requests": 0}

	return {
		"failure_rate": failed_requests / total_requests,
		"total_requests": total_requests,
		"failed_requests": failed_requests,
	}


def compute_all_metrics(records: List[Dict[str, Any]]) -> Dict[str, Any]:
	metrics: Dict[str, Any] = {}
	metrics.update(compute_latency_percentiles(records))
	metrics.update(compute_cost_per_request(records))
	metrics.update(compute_citation_coverage(records))
	metrics.update(compute_failure_rate(records))
	return metrics
