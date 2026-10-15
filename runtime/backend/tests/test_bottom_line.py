"""底线：后端提示词含三条底线与"允许说不知道"，后端源码无禁词；禁词表与前端一致。"""
import json
import pathlib

from app.api.v1 import ai_assistant
from app.core.bottom_line import find_violations, load_terms

ROOT = pathlib.Path(__file__).resolve().parents[1]


def test_prompts_state_bottom_lines_and_allow_unknown():
    for prompt in (ai_assistant.SYSTEM_PROMPT,):
        assert "investment advice" in prompt and "price prediction" in prompt and "impersonate" in prompt
        assert "No data available" in prompt
    cn = ai_assistant.CN_SYSTEM_PROMPT
    assert "不提供投资建议" in cn and "不做价格预测" in cn and "不冒充官方" in cn and "本库尚未收录" in cn


def test_terms_match_web_copy():
    web = ROOT.parent / "web/src/lib/compliance/bottom-line-terms.json"
    if web.exists():
        assert json.loads(web.read_text()) == load_terms()


def test_backend_source_has_no_banned_phrases():
    allow = {"app/core/bottom_line.py", "app/api/v1/ai_assistant.py"}
    hits = []
    for f in (ROOT / "app").rglob("*.py"):
        rel = f.relative_to(ROOT).as_posix()
        if rel in allow:
            continue
        v = find_violations(f.read_text(encoding="utf-8", errors="ignore"))
        if v:
            hits.append(f"{rel}: {v}")
    assert hits == []


def test_find_violations():
    assert find_violations("该项目具有极高的投资价值，建议投资") == ["建议投资", "投资价值"]
    assert find_violations("首年发电量 12 万 kWh") == []
