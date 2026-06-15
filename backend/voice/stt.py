# rag_backend\backend\voice\stt.py

from __future__ import annotations

import os
import tempfile

from functools import lru_cache
from typing import Any, Dict, List, Optional, cast

from backend.config import settings


@lru_cache()
def _get_model() -> Any:

    from faster_whisper import WhisperModel  # type: ignore[import-not-found]

    return cast(
        Any,
        WhisperModel(
            settings.WHISPER_MODEL,
            device="cpu",
            compute_type="int8"
        )
    )


async def transcribe_audio(
    audio_bytes: bytes,
    language: Optional[str] = None
) -> Dict[str, Any]:

    if not audio_bytes:
        raise ValueError("Empty audio")

    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        model: Any = _get_model()

        segments: Any
        info: Any

        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
        )

        segment_list: List[Dict[str, Any]] = []
        text_parts: List[str] = []

        for segment in segments:
            text_parts.append(segment.text)

            segment_list.append(
                {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                }
            )

        return {
            "text": " ".join(text_parts).strip(),
            "language": getattr(info, "language", None),
            "confidence": round(
                float(getattr(info, "language_probability", 0.0)),
                3
            ),
            "duration_s": round(
                float(getattr(info, "duration", 0.0)),
                2
            ),
            "segments": segment_list,
        }

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass