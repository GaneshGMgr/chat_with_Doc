import time
from contextlib import contextmanager
from typing import Any, Dict, Iterator, Optional

from backend.observability.langfuse_client import get_langfuse


class RagTrace:
	def __init__(
		self,
		query,
		model,
		message_id,
		collection_ids=None,
	):
		self.query = query
		self.model = model
		self.message_id = message_id
		self.collection_ids = collection_ids
		self.trace = None
		self.lf = None
		self._spans: Dict[str, Any] = {}
		self.metadata: Dict[str, Any] = {}
		self._t_start = None

	def __enter__(self):
		self.lf = get_langfuse()
		if self.lf is None:
			return self

		self.trace = self.lf.trace(
			id=self.message_id,
			name="rag_pipeline",
			input={
				"query": self.query,
				"model": self.model,
				"collection_ids": self.collection_ids,
			},
			metadata={"model": self.model},
		)
		self._t_start = time.time()
		return self

	def __exit__(self, exc_type, exc_val, exc_tb):
		if self.trace is None or self._t_start is None:
			return False

		latency_ms = int((time.time() - self._t_start) * 1000)
		metadata = {
			"latency_ms": latency_ms,
			"tokens_used": self.metadata.get("tokens_used"),
			"chunks_retrieved": self.metadata.get("chunks_retrieved"),
			"chunks_after_rerank": self.metadata.get("chunks_after_rerank"),
			"citation_coverage": self.metadata.get("citation_coverage"),
			"error": self.metadata.get("error", exc_val),
		}
		self.trace.update(
			output=self.metadata.get("answer_preview", ""),
			metadata=metadata,
		)
		if self.lf is not None:
			self.lf.flush()
		return False

	@contextmanager
	def span_retrieval(self, query) -> Iterator[None]:
		if self.trace is None:
			yield
			return

		span = self.trace.span(name="retrieval", input={"query": query})
		self._spans["retrieval"] = span
		try:
			yield
		finally:
			span.end(output={"chunks_count": self.metadata.get("chunks_retrieved")})

	@contextmanager
	def span_reranking(self, chunk_count) -> Iterator[None]:
		if self.trace is None:
			yield
			return

		span = self.trace.span(name="reranking")
		self._spans["reranking"] = span
		try:
			yield
		finally:
			span.end(
				output={
					"chunks_before": chunk_count,
					"chunks_after": self.metadata.get("chunks_after_rerank"),
				}
			)

	@contextmanager
	def span_generation(self, prompt_messages) -> Iterator[None]:
		if self.trace is None:
			yield
			return

		span = self.trace.span(
			name="generation",
			input={"message_count": len(prompt_messages), "model": self.model},
		)
		self._spans["generation"] = span
		try:
			yield
		finally:
			span.end(
				output={
					"tokens_used": self.metadata.get("tokens_used"),
					"answer_preview": self.metadata.get("answer_preview"),
				}
			)
