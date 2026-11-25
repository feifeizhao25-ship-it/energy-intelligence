"""能8：免费档导出计入额度，PDF 每页有水印。"""
import io
import uuid

import pytest
from pypdf import PdfReader

from app.core.security import create_access_token
from app.utils.security import get_password_hash
from app.models.user import User
from app.services.answer_export import render_answer_file


def test_watermark_is_painted_on_the_page_not_only_as_a_footer_line():
    pdf = render_answer_file(
        {"market": "cn", "message": "示例回答", "sources": [], "watermark": True},
        "pdf",
    )
    text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf)).pages)
    assert "EVALUATION COPY" in text
    assert "免费档水印" in text


@pytest.mark.asyncio
async def test_free_plan_fourth_pdf_export_is_rejected(client, db_session, monkeypatch):
    from app.api.v1 import ai_assistant as ask_api

    async def unavailable(message, system_prompt, *, market):
        raise RuntimeError("AI provider is not configured")

    monkeypatch.setattr(ask_api.ai_assistant, "chat_openai_with_metadata", unavailable)
    user = User(
        id=str(uuid.uuid4()),
        email=f"free-{uuid.uuid4().hex[:8]}@example.com",
        password_hash=get_password_hash("Passw0rd!x"),
        name="导出测试",
        role="user",
        market="cn",
        subscription_plan="free",
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    asked = await client.post("/api/v1/ai/chat-json", headers=headers, json={"message": "分布式光伏是什么"})
    assert asked.status_code == 200, asked.text
    answer_id = asked.json()["answer_id"]
    for index in range(3):
        exported = await client.post(f"/api/v1/ai/answers/{answer_id}/export", headers=headers, json={"format": "pdf"})
        assert exported.status_code == 200, (index, exported.text)
        assert b"EVALUATION COPY" in exported.content or "EVALUATION COPY" in "\n".join(
            page.extract_text() or "" for page in PdfReader(io.BytesIO(exported.content)).pages
        )
    blocked = await client.post(f"/api/v1/ai/answers/{answer_id}/export", headers=headers, json={"format": "pdf"})
    assert blocked.status_code == 429, blocked.text
