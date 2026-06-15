# rag_backend\backend\routers\voice.py

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from backend.schemas.schemas import SynthesizeRequest
from backend.voice.stt import transcribe_audio
from backend.voice.tts import synthesize_speech, list_voices


router = APIRouter(prefix="/voice", tags=["Voice"])


@router.post("/transcribe", summary="Speech to text (faster-whisper)")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form(None)
):

    data = await audio.read()

    if not data:
        raise HTTPException(400, "Empty audio")

    return await transcribe_audio(data, language=language)


@router.post("/synthesize", summary="Text to speech (edge-tts, free)")
async def synthesize(req: SynthesizeRequest):

    audio = await synthesize_speech(
        text=req.text,
        voice=req.voice,
        rate=req.rate,
        pitch=req.pitch
    )

    if not audio:
        raise HTTPException(500, "TTS failed")

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=speech.mp3"
        }
    )


@router.get("/voices", summary="List TTS voices")
def voices():

    return {
        "voices": list_voices()
    }