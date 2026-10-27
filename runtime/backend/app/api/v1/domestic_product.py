"""站内调用：国内模型路由与反馈样本。生产环境必须带内部令牌。"""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.bottom_line import enforce_bottom_line, find_violations
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


_CHECKED_ROLES = {"user", "assistant"}


def _message_text(message: dict) -> str:
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts)
    return ""


@router.post("/ai/domestic")
async def domestic_chat(body: DomesticChatIn, x_internal_token: str | None = Header(default=None)):
    _authorize(x_internal_token)
    if not body.messages:
        raise HTTPException(status_code=400, detail="需要提供对话内容")
    incoming = "\n".join(
        _message_text(item)
        for item in body.messages
        if isinstance(item, dict) and str(item.get("role") or "user").lower() in _CHECKED_ROLES
    )
    if find_violations(incoming, market="cn"):
        return {
            "content": enforce_bottom_line(incoming, market="cn"),
            "provider": "bottom_line",
            "model": "blocked",
        }
    try:
        result = await complete_domestic(body.messages, body.model)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="国内模型暂不可用") from exc
    if isinstance(result, dict):
        result["content"] = enforce_bottom_line(str(result.get("content") or ""), market="cn")
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
