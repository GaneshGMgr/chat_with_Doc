# rag_backend\backend\voice\tts.py

from __future__ import annotations

import io

from typing import List


VOICES = [
    {
        "id": "en-US-AriaNeural",
        "language": "en-US",
        "gender": "Female"
    },
    {
        "id": "en-US-GuyNeural",
        "language": "en-US",
        "gender": "Male"
    },
    {
        "id": "en-GB-SoniaNeural",
        "language": "en-GB",
        "gender": "Female"
    },
    {
        "id": "en-GB-RyanNeural",
        "language": "en-GB",
        "gender": "Male"
    },
    {
        "id": "en-AU-NatashaNeural",
        "language": "en-AU",
        "gender": "Female"
    },
]


async def synthesize_speech(
    text: str,
    voice: str = "en-US-AriaNeural",
    rate: str = "+0%",
    pitch: str = "+0Hz"
) -> bytes:

    import edge_tts

    communicate = edge_tts.Communicate(
        text,
        voice,
        rate=rate,
        pitch=pitch
    )

    buf = io.BytesIO()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])

    return buf.getvalue()


def list_voices() -> List[dict]:
    return VOICES