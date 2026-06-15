# backend/observability/langfuse_client.py
import logging
from typing import Optional

from langfuse import Langfuse

from backend.config import settings


logger = logging.getLogger(__name__)

_langfuse_client: Optional[Langfuse] = None


def get_langfuse() -> Optional[Langfuse]:
	global _langfuse_client

	if not settings.LANGFUSE_ENABLED:
		return None

	if settings.LANGFUSE_SECRET_KEY is None or settings.LANGFUSE_PUBLIC_KEY is None:
		return None

	if _langfuse_client is None:
		try:
			_langfuse_client = Langfuse(
				secret_key=settings.LANGFUSE_SECRET_KEY,
				public_key=settings.LANGFUSE_PUBLIC_KEY,
				host=settings.LANGFUSE_HOST,
			)
		except Exception as exc:
			logger.warning("Failed to initialize Langfuse client: %s", exc)
			return None

	return _langfuse_client
