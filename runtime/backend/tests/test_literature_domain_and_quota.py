"""智12：文献排除天文和高能物理，摘要不截断，没有模型时不扣次数。"""
import pytest

from app.api.v1.research import energy_search_query, in_energy_domain
from app.api.v1.research_new import search_domestic_corpus


def test_energy_query_excludes_astrophysics_and_hep():
    query = energy_search_query("solar cell")
    assert "all:solar cell" in query
    assert "cat:astro-ph.*" in query
    assert "cat:hep-ph" in query
    assert in_energy_domain(["physics.app-ph"]) is True
    assert in_energy_domain(["astro-ph.SR"]) is False
    assert in_energy_domain(["hep-ph"]) is False
    assert in_energy_domain([]) is True


def test_domestic_abstract_is_not_cut_at_300(tmp_path):
    path = tmp_path / "corpus.json"
    abstract = "公式 $E=mc^2$ 。" + ("甲" * 400)
    path.write_text(
        '{"records":[{"external_id":"p1","title":"光伏组件衰减","abstract":"%s","year":2024}]}' % abstract,
        encoding="utf-8",
    )
    papers = search_domestic_corpus("光伏", path)
    assert papers[0]["abstract"] == abstract
    assert papers[0]["latex"] == abstract
    assert len(papers[0]["abstract"]) > 300


@pytest.mark.asyncio
async def test_no_model_reply_does_not_consume_ai_quota(client, auth_headers, monkeypatch):
    calls = {"n": 0}

    async def consume(user, db):
        calls["n"] += 1

    async def missing(*args, **kwargs):
        raise RuntimeError("Model provider is not configured")

    monkeypatch.setattr("app.api.v1.ai_assistant.consume_ai_quota", consume)
    monkeypatch.setattr("app.api.v1.ai_assistant.ai_assistant.chat_openai_with_metadata", missing)
    response = await client.post(
        "/api/v1/ai/chat-json",
        json={"message": "光伏组件的温度系数怎么理解"},
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["ai_metadata"].get("model_called") is False
    assert calls["n"] == 0
