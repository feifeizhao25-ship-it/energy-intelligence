"""站内调用：国内模型路由与反馈样本。生产环境必须带内部令牌。"""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.domestic_router import complete_domestic
from app.services.embeddings_cn import embed_texts
from app.services.feedback_samples import KINDS, record_sample

router = APIRouter()


class DomesticChatIn(BaseModel):
    messages: list[dict] = Field(default_factory=list)
    model: str | None = None


class FeedbackIn(BaseModel):
    kind: str
    text: str = ""


class EmbedIn(BaseModel):
    input: list[str] = Field(default_factory=list)


def _authorize(token: str | None) -> None:
    expected = os.environ.get("NENGJIAN_INTERNAL_TOKEN", "")
    if not expected:
        if os.environ.get("ENVIRONMENT", "development") == "development":
            return
        raise HTTPException(status_code=401, detail="内部令牌未配置")
    if token != expected:
        raise HTTPException(status_code=401, detail="未授权")


@router.post("/ai/domestic")
async def domestic_chat(body: DomesticChatIn, x_internal_token: str | None = Header(default=None)):
    _authorize(x_internal_token)
    if not body.messages:
        raise HTTPException(status_code=400, detail="需要提供对话内容")
    try:
        result = await complete_domestic(body.messages, body.model)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="国内模型暂不可用") from exc
    return result


@router.post("/ai/embeddings")
async def domestic_embeddings(body: EmbedIn, x_internal_token: str | None = Header(default=None)):
    _authorize(x_internal_token)
    result = embed_texts(body.input)
    if result.get("status") != "ok":
        raise HTTPException(status_code=503, detail="向量服务未启用")
    return {"vectors": result.get("vectors") or [], "model": result.get("model")}


@router.post("/internal/feedback")
async def internal_feedback(body: FeedbackIn, x_internal_token: str | None = Header(default=None)):
    _authorize(x_internal_token)
    if body.kind not in KINDS:
        raise HTTPException(status_code=400, detail="未知的反馈类型")
    return record_sample(body.kind, body.text)
