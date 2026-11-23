"""站内调用：国内模型路由与反馈样本。生产环境必须带内部令牌。"""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.services.bottom_line import enforce_bottom_line, find_violations
from app.services.domestic_router import complete_domestic, complete_domestic_with_tools
from app.services.embeddings_cn import embed_texts
from app.services.feedback_samples import KINDS, record_sample

router = APIRouter()


class DomesticChatIn(BaseModel):
    messages: list[dict] = Field(default_factory=list)
    model: str | None = None
    # 网页端专业助手的工具定义（OpenAI function 格式）。有就原样交给模型，返回 tool_calls。
    tools: list[dict] | None = None
    tool_choice: str | dict | None = None


class FeedbackIn(BaseModel):
    kind: str
    text: str = ""


class LibrarySearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=500)


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
        if body.tools:
            result = await complete_domestic_with_tools(body.messages, body.tools, body.tool_choice, body.model)
        else:
            result = await complete_domestic(body.messages, body.model)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="国内模型暂不可用") from exc
    if isinstance(result, dict):
        content = str(result.get("content") or "")
        # 只调工具、正文为空的一轮不过底线（空文本本来也不会命中）。
        result["content"] = enforce_bottom_line(content, market="cn") if content else ""
    return result


@router.post("/ai/library-search")
async def domestic_library_search(body: LibrarySearchIn, x_internal_token: str | None = Header(default=None)):
    """网页端专业助手的资料库检索工具：和 App 问答（/api/v1/ai/ask）用同一个 _retrieve（词面闸门，
    启用 RAG_VECTOR_RESCUE 时含本地向量补召回），只返回未过期、过了相关度下限的来源。不调模型。"""
    _authorize(x_internal_token)
    from app.api.v1.ai_assistant import _retrieve
    from app.services.citation_record import date_lines

    hits = _retrieve(body.query, "cn")
    sources = []
    for index, hit in enumerate(hits, 1):
        md = hit.metadata or {}
        sources.append({
            "ref": f"S{index}",
            "id": hit.source_id,
            "title": hit.title,
            "source_org": md.get("source_org") or md.get("issuer") or None,
            "doc_number": md.get("doc_number") or None,
            "dates": " ".join(date_lines(md, "zh")) or (str(md.get("year")) if md.get("year") else ""),
            # 回答底部「引用来源最新日期」用：优先发文日期；PDF 元数据日期不算发布日期（同 date_lines 的口径）。
            "published_at": _source_date(md),
            "url": md.get("source_url") or None,
            "content": (hit.content or "")[:1200],
        })
    return {"query": body.query, "count": len(sources), "sources": sources}


def _source_date(md: dict) -> str | None:
    for key in ("publish_date", "issue_date"):
        if md.get(key):
            return str(md[key])
    if md.get("published_at") and str(md.get("date_kind") or "") != "pdf_creation":
        return str(md["published_at"])
    return None


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
