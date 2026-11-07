"""Vertical check: citation text, unpublished records, and the answer download route.

The model is not called. These cases use the library records and the same generators the report route calls.
"""
import io
import uuid
import zipfile
from datetime import date
from types import SimpleNamespace

import pytest
from docx import Document
from pypdf import PdfReader

from app.api.v1 import ai_assistant as ask_api
from app.api.v1.ai_assistant import _provenance_footer, _retrieve
from app.core.security import create_access_token
from app.models.user import User
from app.utils.security import get_password_hash
from app.routers import reports as R
from app.services.citation_record import format_citation
from app.services.evidence_envelope import present_claim
from app.services.rag_service import RAGService

TODAY = date(2026, 11, 7)


def _hit(**meta):
    content = meta.pop("content", "并网申请应当提交调度计划。")
    return SimpleNamespace(
        title=meta.get("title", "广东省新能源上网电价市场化改革实施方案"),
        content=content,
        metadata=meta,
    )


def test_footer_keeps_locator_excerpt_and_does_not_invent_a_page():
    cited = _hit(
        source_org="广东省发展和改革委员会",
        published_at="2025-09-19",
        source_url="https://drc.gd.gov.cn/x",
        locator="第三条",
        freshness_status="current",
        license_note="政府公开信息",
        evidence_status="official_text_read",
    )
    bare = _hit(
        title="无页码通知",
        source_org="国家能源局",
        published_at="2024-01-02",
        source_url="https://example.gov/nopage",
        content="仅有正文摘录。",
    )
    out = _provenance_footer("结论见 [S1]，另一条见 [S2]。", [cited, bare], "cn", TODAY)
    assert "页码/段落：第三条" in out
    assert "摘录：并网申请应当提交调度计划。" in out
    assert "时效：current" in out
    assert "许可：政府公开信息" in out
    assert "https://example.gov/nopage" in out
    assert "页码/段落" not in out.split("[S2]", 1)[1]
    assert "第 1 页" not in out


def test_machine_extract_is_not_labelled_as_published():
    hit = _hit(
        source_org="国家发展改革委",
        published_at="2026-10-23",
        source_url="https://www.ndrc.gov.cn/x",
        evidence_status="auto_extracted",
        status="现行",
    )
    out = _provenance_footer("见 [S1]。", [hit], "cn", TODAY)
    assert "机器摘录" in out and "不是已发布文本" in out
    en = _provenance_footer("See [S1].", [hit], "global", TODAY)
    assert "not a human-reviewed publication" in en


def test_unverified_records_are_not_retrieved():
    corpus = [
        {
            "source_id": "pending",
            "lang": "cn",
            "title": "待核并网规则",
            "content": "分布式 光伏 并网 调度",
            "year": 2026,
            "status": "待核实",
            "evidence_status": "auto_extracted",
            "last_verified_at": "2026-11-01",
            "verify_interval_days": 30,
            "source_url": "https://example.gov/pending",
            "source_org": "国家能源局",
        },
        {
            "source_id": "live",
            "lang": "cn",
            "title": "现行并网规则",
            "content": "分布式 光伏 并网 调度",
            "year": 2026,
            "status": "现行",
            "evidence_status": "official_text_read",
            "last_verified_at": "2026-11-01",
            "verify_interval_days": 30,
            "source_url": "https://example.gov/live",
            "source_org": "国家能源局",
            "countries": ["cn"],
        },
    ]
    hits = RAGService(corpus=corpus).search("分布式光伏并网调度", market="cn").hits
    assert [h.source_id for h in hits] == ["live"]
    assert _retrieve("zzzz nothing matches qqqq", "cn") == []


def test_numeric_conflict_lists_both_sources_and_picks_none():
    shown = present_claim(
        [{"value": 0.32, "publisher": "电网甲"}, {"value": 0.41, "publisher": "电网乙"}],
    )
    assert shown["picked"] is None
    assert shown["status"] == "conflict"
    assert {row["publisher"] for row in shown["sources"]} == {"电网甲", "电网乙"}


def test_free_license_is_kept_and_absent_locator_is_absent():
    line = format_citation(1, {
        "title": "公开通知",
        "url": "https://example.gov/free",
        "license_note": "政府公开信息",
        "retrieved_at": "2026-11-07",
    }, "zh")
    assert "许可：政府公开信息" in line
    assert "页码" not in line


def _file_text(payload: bytes, kind: str) -> str:
    if kind == "pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(payload)).pages)
    doc = Document(io.BytesIO(payload))
    return "\n".join(p.text for p in doc.paragraphs)


def test_report_entry_writes_pdf_and_word_with_clickable_sources():
    data = R._demo_data()
    data["data_sources"] = [
        {
            "title": "并网细则",
            "url": "https://example.gov/policy",
            "authors": "国家能源局",
            "published_at": "2026-01-01",
            "locator": "第二章 并网申请",
            "retrieved_at": "2026-08-20",
            "excerpt": "并网申请应当提交",
            "freshness_status": "current",
            "license_note": "政府公开信息",
            "evidence_status": "official_text_read",
        },
        {
            "title": "机器摘录",
            "url": "https://example.gov/extract",
            "published_at": "2026-02-02",
            "retrieved_at": "2026-08-20",
            "evidence_status": "auto_extracted",
            "status": "现行",
        },
    ]
    metrics = R.calc_financial_metrics(data["financial"])
    for kind, builder in (("pdf", R.generate_pdf), ("docx", R.generate_docx)):
        payload = builder(data, "compliance", R.TEMPLATES["compliance"], metrics, "引用报告", "internal", "cn")
        text = _file_text(payload, kind)
        assert "第二章 并网申请" in text
        assert "摘录：并网申请应当提交" in text
        assert "https://example.gov/policy" in text
        assert "机器摘录，未经人工复核" in text
        assert "合成测试数据" in text
        assert "不是经人工签字的审核结论" in text
        extract_line = text.split("机器摘录", 1)[-1]
        assert "页码/段落" not in extract_line.split("https://example.gov/policy", 1)[0]
        if kind == "pdf":
            assert b"/URI" in payload and b"https://example.gov/policy" in payload
        else:
            with zipfile.ZipFile(io.BytesIO(payload)) as package:
                document = package.read("word/document.xml").decode("utf-8")
                rels = package.read("word/_rels/document.xml.rels").decode("utf-8")
            assert "hyperlink" in document
            assert "https://example.gov/policy" in rels


async def _user(db_session, market: str, plan: str) -> dict:
    user = User(
        id=str(uuid.uuid4()),
        email=f"{market}-{uuid.uuid4().hex[:8]}@example.com",
        password_hash=get_password_hash("Passw0rd!x"),
        name="Citation tester",
        role="user",
        market=market,
        subscription_plan=plan,
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


@pytest.mark.asyncio
async def test_chat_download_uses_real_library_record_and_rejects_other_users(client, db_session, monkeypatch):
    async def unavailable(message, system_prompt, *, market):
        raise RuntimeError("Global AI provider is not configured")

    monkeypatch.setattr(ask_api.ai_assistant, "chat_openai_with_metadata", unavailable)
    free = await _user(db_session, "global", "free")
    other = await _user(db_session, "global", "pro")
    hit = await client.post("/api/v1/ai/chat-json", headers=free, json={"message": "IRS Notice 2025-42 solar investment tax credit"})
    assert hit.status_code == 200, hit.text
    body = hit.json()
    assert body["ai_metadata"]["model_called"] is False
    assert body["sources"]
    source = body["sources"][0]
    assert "irs.gov" in source["url"]
    assert source.get("locator")
    assert "FS-2025-05" not in source["locator"]
    assert source["published_at"] == "2025-08-15"
    assert source["url"].endswith("n-25-42.pdf")
    assert "example.gov" not in source["url"]
    assert body["downloads"]["pdf"] is True and body["downloads"]["docx"] is False
    answer_id = body["answer_id"]

    denied = await client.post(f"/api/v1/ai/answers/{answer_id}/export", headers=other, json={"format": "pdf"})
    assert denied.status_code == 404
    assert denied.json()["detail"] == "This answer does not exist or you cannot access it."

    word = await client.post(f"/api/v1/ai/answers/{answer_id}/export", headers=free, json={"format": "docx"})
    assert word.status_code == 403
    assert word.json()["detail"]["message"] == "Word export is not included in this plan."

    pdf = await client.post(f"/api/v1/ai/answers/{answer_id}/export", headers=free, json={"format": "pdf"})
    assert pdf.status_code == 200
    text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf.content)).pages)
    assert "irs.gov" in text
    assert source["locator"] in text
    assert "Evaluation copy" in text
    assert "SYNTHETIC TEST DATA" not in text
    assert "not a signed human review" in text
    assert "No model was called" in text

    missing = await client.post("/api/v1/ai/chat-json", headers=free, json={"message": "zzzz nothing matches qqqq"})
    assert missing.status_code == 200 and missing.json()["sources"] == []

    refused = await client.post(
        "/api/v1/ai/chat-json",
        headers=free,
        json={"message": "What statute sets the zoning penalty in fictional county ZZQQ-999?"},
    )
    assert refused.status_code == 200
    assert refused.json()["message"].startswith("Status: No source")
    assert refused.json()["sources"] == []

    domestic = await _user(db_session, "cn", "pro")
    cn = await client.post("/api/v1/ai/chat-json", headers=domestic, json={"message": "能源保供中长期合同管理办法"})
    assert cn.status_code == 200, cn.text
    cn_body = cn.json()
    if cn_body["sources"]:
        assert any("机器摘录" in cn_body["message"] or src.get("evidence_status") == "auto_extracted" for src in cn_body["sources"])
        docx = await client.post(f"/api/v1/ai/answers/{cn_body['answer_id']}/export", headers=domestic, json={"format": "docx"})
        assert docx.status_code == 200
        package = zipfile.ZipFile(io.BytesIO(docx.content))
        xml = package.read("word/document.xml").decode("utf-8")
        assert "机器摘录" in xml or "不是经人工签字" in xml
    other_cn = await _user(db_session, "cn", "free")
    foreign = await client.post(f"/api/v1/ai/answers/{cn_body['answer_id']}/export", headers=other_cn, json={"format": "pdf"})
    assert foreign.status_code == 404
    assert foreign.json()["detail"] == "回答不存在或无权访问"


@pytest.mark.asyncio
async def test_exhausted_report_exports_are_not_described_as_ai_answers(client, db_session, monkeypatch):
    async def unavailable(message, system_prompt, *, market):
        raise RuntimeError("Global AI provider is not configured")

    monkeypatch.setattr(ask_api.ai_assistant, "chat_openai_with_metadata", unavailable)
    user = User(
        id=str(uuid.uuid4()),
        email=f"quota-{uuid.uuid4().hex[:8]}@example.com",
        password_hash=get_password_hash("Passw0rd!x"),
        name="Quota tester",
        role="user",
        market="global",
        subscription_plan="free",
        usage_quota={"ai_calls": {}, "report_exports": {"monthly_2026-11": 3}},
    )
    db_session.add(user)
    await db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id))}"}
    hit = await client.post("/api/v1/ai/chat-json", headers=headers, json={"message": "IRS Notice 2025-42"})
    assert hit.status_code == 200, hit.text
    exported = await client.post(
        f"/api/v1/ai/answers/{hit.json()['answer_id']}/export",
        headers=headers,
        json={"format": "pdf"},
    )
    assert exported.status_code == 429
    detail = exported.json()["detail"]
    assert detail["error"] == "REPORT_QUOTA_EXCEEDED"
    assert "report export" in detail["message"]
    assert "not an extra AI answer" in detail["message"]
