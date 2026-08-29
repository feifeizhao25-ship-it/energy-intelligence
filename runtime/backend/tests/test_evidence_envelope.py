"""evidence_envelope 统一证据封装测试（19 项要求第 1 项）。

覆盖：置信度规则（数量/新鲜度）、无来源不伪造、RAGHit 元数据透出、
AI 问答端点响应附带 evidence、报告证据封装的计算轨迹。
"""

import pytest

from app.services.evidence_envelope import (
    build_envelope,
    compute_confidence,
    envelope_from_rag,
    source_from_dict,
    source_from_rag_hit,
)
from app.services.rag_service import RAGHit


def _hit(source_id: str, freshness: str = "current", score: float = 0.5) -> RAGHit:
    return RAGHit(
        source_id=source_id,
        title=f"来源 {source_id}",
        content="内容",
        score=score,
        metadata={
            "type": "policy",
            "source_url": f"https://example.com/{source_id}",
            "source_org": "国家能源局",
            "published_at": "2026-01-01",
            "retrieved_at": "2026-08-23",
            "authors": "张三",
            "version": "v2",
            "locator": "第 3 页",
            "license_note": "公开发布",
            "freshness_status": freshness,
        },
    )


class TestConfidenceRules:
    """置信度只按「来源数量 × 新鲜度」规则得出，规则可解释。"""

    def test_no_sources_is_low_and_marked_no_source(self):
        confidence, reason = compute_confidence([])
        assert confidence == "low"
        assert "无来源" in reason

    def test_any_stale_source_forces_low(self):
        sources = [source_from_rag_hit(_hit("a")), source_from_rag_hit(_hit("b", "stale"))]
        confidence, reason = compute_confidence(sources)
        assert confidence == "low"
        assert "stale" in reason

    def test_three_current_sources_is_high(self):
        sources = [source_from_rag_hit(_hit(s)) for s in ("a", "b", "c")]
        confidence, _ = compute_confidence(sources)
        assert confidence == "high"

    def test_fewer_than_three_current_sources_is_medium(self):
        sources = [source_from_rag_hit(_hit("a"))]
        confidence, reason = compute_confidence(sources)
        assert confidence == "medium"
        assert "数量不足" in reason

    def test_review_recommended_caps_at_medium(self):
        sources = [source_from_rag_hit(_hit(s)) for s in ("a", "b")]
        sources.append(source_from_rag_hit(_hit("c", "review_recommended")))
        confidence, reason = compute_confidence(sources)
        assert confidence == "medium"
        assert "review_recommended" in reason

    def test_unknown_freshness_caps_at_medium(self):
        sources = [source_from_dict({"title": "t", "url": "u", "retrieved_at": "2026-08-23"})
                   for _ in range(4)]
        confidence, reason = compute_confidence(sources)
        assert confidence == "medium"
        assert "新鲜度未知" in reason


class TestEnvelopeShape:
    def test_envelope_contains_all_required_fields(self):
        env = build_envelope("结论", [source_from_rag_hit(_hit("a"))])
        for key in ("answer", "confidence", "confidence_reason", "as_of",
                    "engine_version", "sources", "sources_status",
                    "assumptions", "calculation_trace", "limitations"):
            assert key in env, key
        assert env["answer"] == "结论"
        assert env["sources_status"] == "ok"

    def test_no_sources_marks_status_without_fabricating(self):
        env = build_envelope("结论", [])
        assert env["sources"] == []
        assert env["sources_status"] == "无来源"
        assert env["confidence"] == "low"

    def test_source_from_rag_hit_exposes_provenance_metadata(self):
        src = source_from_rag_hit(_hit("policy-1"))
        assert src["url"] == "https://example.com/policy-1"
        assert src["publisher"] == "国家能源局"
        assert src["published_at"] == "2026-01-01"
        assert src["retrieved_at"] == "2026-08-23"
        assert src["authors"] == "张三"
        assert src["version"] == "v2"
        assert src["locator"] == "第 3 页"
        assert src["license"] == "公开发布"

    def test_envelope_from_rag_maps_all_hits(self):
        env = envelope_from_rag("答", [_hit("a"), _hit("b"), _hit("c")])
        assert len(env["sources"]) == 3
        assert env["confidence"] == "high"


class TestChatEndpointEvidence:
    @pytest.mark.asyncio
    async def test_chat_json_includes_evidence_envelope(self, client, auth_headers, monkeypatch):
        from app.api.v1.ai_assistant import ai_assistant

        async def fake_chat(message: str, system_prompt: str, *, market: str) -> dict:
            assert market == "cn"
            return {"content": "回答", "metadata": {"provider": "test"}}

        monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
        response = await client.post(
            "/api/v1/ai/chat-json",
            json={"message": "光伏 政策"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["message"] == "回答"  # 既有响应字段不回归
        evidence = body["evidence"]
        assert evidence["answer"] == "回答"
        assert evidence["confidence"] in ("high", "medium", "low")
        assert evidence["sources_status"] in ("ok", "无来源")
        if evidence["sources_status"] == "无来源":
            assert evidence["sources"] == []
        else:
            for src in evidence["sources"]:
                assert "publisher" in src and "retrieved_at" in src

    @pytest.mark.asyncio
    async def test_analyze_includes_evidence_envelope(self, client, auth_headers, monkeypatch):
        from app.api.v1.ai_assistant import ai_assistant

        async def fake_chat(message: str, system_prompt: str, *, market: str) -> dict:
            assert market == "cn"
            return {"content": "分析结果", "metadata": {"provider": "test"}}

        monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
        response = await client.post(
            "/api/v1/ai/analyze",
            params={"query": "风电政策"},
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 200
        assert response.json()["evidence"]["answer"] == "分析结果"


class TestReportEvidence:
    def test_build_report_evidence_with_financials_has_calculation_trace(self):
        from app.routers.reports import _build_report_evidence, _demo_data

        data = _demo_data()
        data["data_sources"] = [{
            "title": "2026 年电价政策", "url": "https://example.com/policy",
            "retrieved_at": "2026-08-20", "freshness_status": "current",
            "type": "policy",
        }]
        evidence = _build_report_evidence("可研报告", data)
        assert evidence["sources_status"] == "ok"
        formulas = {entry["formula"] for entry in evidence["calculation_trace"]}
        assert any("NPV" in f for f in formulas)
        assert any("IRR" in f for f in formulas)
        assert any("LCOE" in f for f in formulas)
        assert evidence["assumptions"], "财务假设必须透出"
        assert evidence["limitations"]

    def test_build_report_evidence_without_sources_marks_no_source(self):
        from app.routers.reports import _build_report_evidence

        evidence = _build_report_evidence("合规报告", {"financial": {}, "data_sources": []})
        assert evidence["sources_status"] == "无来源"
        assert evidence["confidence"] == "low"
        assert evidence["calculation_trace"] == []
