"""核19：国内版 /ask 无模型时与 /chat-json 一样带「核验状态」尾注和 grounding（2026-11-23）。"""
import asyncio
from types import SimpleNamespace

import pytest

from app.api.v1 import ai_assistant as aa


def _ask(query, market="cn"):
    body = aa.AskRequest(query=query, market=market)
    return asyncio.run(aa.ask(body, SimpleNamespace(headers={}), user_id="u-test", db=None))


@pytest.fixture(autouse=True)
def no_model(monkeypatch):
    monkeypatch.setattr(aa, "_llm_configured", lambda: False)


def test_out_of_library_general_question_has_footer():
    r = _ask("日本FIT 2026年太阳能收购价格")
    assert r["answer"].startswith("本库尚未收录相关资料。")
    assert "核验状态：未核验" in r["answer"]
    assert r["grounding"] == {"status": "no_source", "source_count": 0}
    assert "time_check" in r and r["model"] is None


def test_policy_question_without_source_still_refused():
    r = _ask("某某省2030年分布式光伏度电补贴0.3元是否属实")
    assert r["grounding"]["status"] == "no_source_refused"


def test_global_unchanged():
    r = _ask("Japan FIT 2026 solar purchase price", market="global")
    assert "Verification" not in r["answer"]  # 国际版本 PR 不改
