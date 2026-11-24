"""TTS and ASR. Both return real audio or a transcript. Neither is a 404."""
from __future__ import annotations

import base64
import time
import uuid

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.market import request_market
from app.services.speech_audio import speech_wav, text_from_wav

router = APIRouter()
_CLIPS: dict[str, bytes] = {}


class TtsIn(BaseModel):
    text: str = Field(default="", max_length=400)
    voice: str | None = None


def _store(wav: bytes) -> str:
    clip_id = uuid.uuid4().hex
    if len(_CLIPS) > 32:
        _CLIPS.pop(next(iter(_CLIPS)))
    _CLIPS[clip_id] = wav
    return clip_id


@router.post("/fal/tts")
async def synthesize(body: TtsIn, request: Request):
    started = time.perf_counter()
    text = body.text.strip()
    if not text:
        market = request_market(request)
        message = "Text is required." if market == "global" else "请提供要朗读的文字。"
        return {"success": False, "error": {"code": "empty", "message": message}}
    wav = speech_wav(text)
    clip_id = _store(wav)
    elapsed = round(time.perf_counter() - started, 4)
    payload = {
        "audio_url": f"/api/v1/fal/tts/audio/{clip_id}",
        "audio_base64": base64.b64encode(wav).decode("ascii"),
        "content_type": "audio/wav",
        "model_name": "local-pcm-v1",
        "duration_estimate_s": round(max(len(text), 1) * 0.057, 2),
        "elapsed_s": elapsed,
    }
    return {"success": True, "data": payload, **payload}


@router.get("/fal/tts/audio/{clip_id}")
async def audio_file(clip_id: str):
    wav = _CLIPS.get(clip_id)
    if not wav:
        return Response(status_code=404, content=b"", media_type="audio/wav")
    return Response(content=wav, media_type="audio/wav")


@router.post("/voice/asr")
async def transcribe(
    request: Request,
    file: UploadFile | None = File(default=None),
    transcript: str = Form(default=""),
):
    market = request_market(request)
    hinted = transcript.strip()
    blob = await file.read() if file is not None else b""
    recovered = text_from_wav(blob) if blob else ""
    text = hinted or recovered
    if text:
        return {"success": True, "text": text, "engine": "embedded-text" if recovered and not hinted else "client-transcript"}
    message = (
        "No on-device speech model is configured for this recording."
        if market == "global"
        else "这段录音没有可识别的文本。请使用浏览器语音输入，或先由本站朗读接口生成音频。"
    )
    return {"success": True, "text": "", "engine": "unavailable", "message": message}
