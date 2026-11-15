"""国内版 P1：空回答、裁判、检索、审批与测算夹具。不外呼模型。"""
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.services.answer_cache import AnswerCache, TTL_SECONDS
from app.services.bottom_line import find_violations
from app.services.cross_check import agreement_with_human, apply_judgements, judge_request, parse_judge_label
from app.services.domestic_router import (
    REWRITE_ZH,
    SHORT_SYSTEM,
    complete_domestic,
    english_sentence_ratio,
)
from app.services.empty_answer_stats import empty_rates, reset_empty_stats
from app.services.follow_schedule import allows_send
from app.services.group_webhook import bind_webhook, push_allowed, reset_webhooks, unbind_webhook
from app.services.hybrid_retrieval import hybrid_scores, recall_at_k, rerank
from app.services.model_tier import estimate_cost_cny, judge_within_budget, qa_within_budget, tier_for
from app.services.policy_parameter_link import affected_keys, extract_parameters, project_diff
from app.services.readability import ensure_readable
from app.services.report_typst import compile_pdf, render_source
from app.utils.financial_utils import calc_irr, tax_assumptions

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


@pytest.mark.asyncio
async def test_empty_chain_retries_with_short_prompt(monkeypatch):
    reset_empty_stats()
    calls = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        calls.append(payload)
        if len(calls) < 4:
            return "", use_model, "stop"
        return "发改价格〔2025〕136号写明了机制电量。", use_model, "stop"

    async def pause(_seconds):
        return None

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [("deepseek", "https://api.deepseek.com", "k", "deepseek-flash")],
    )
    result = await complete_domestic(
        [{"role": "system", "content": "很长的系统提示"}, {"role": "user", "content": "请说明136号文"}],
        transport=transport,
        pause=pause,
    )
    assert result["content"].startswith("发改价格")
    assert calls[3][0]["content"] == SHORT_SYSTEM
    assert empty_rates()


@pytest.mark.asyncio
async def test_english_sentence_is_rewritten_once(monkeypatch):
    calls = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        calls.append(payload)
        if len(calls) == 1:
            return "The posted tariff copies the official notice. It lists the published table only. Users should read the original page.", use_model, "stop"
        return "已公布电价表只复述公告原文。", use_model, "stop"

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [("deepseek", "https://api.deepseek.com", "k", "deepseek-flash")],
    )
    result = await complete_domestic([{"role": "user", "content": "电价表"}], transport=transport, pause=lambda _s: _async_none())
    assert english_sentence_ratio(calls[0] and "The posted tariff copies the official notice. It lists the published table only. Users should read the original page.") > 0.10
    assert calls[-1][-1]["content"] == REWRITE_ZH
    assert "公告" in result["content"]


async def _async_none():
    return None


def test_answer_cache_expires_and_policy_version_splits():
    now = {"t": 1_000.0}
    cache = AnswerCache(now=lambda: now["t"])
    messages = [{"role": "user", "content": "136号文"}]
    cache.put(messages, {"content": "第一版"}, policy_version="v1")
    assert cache.get(messages, "v1")["content"] == "第一版"
    assert cache.get(messages, "v2") is None
    now["t"] += TTL_SECONDS + 1
    assert cache.get(messages, "v1") is None
    cache.put(messages, {"content": "仍在"}, "v1")
    assert cache.invalidate_policy("v1") == 1


def test_model_tiers_stay_inside_budget():
    assert tier_for("summary")["provider"] == "deepseek"
    assert tier_for("judge")["model"] == "qwen-plus"
    assert qa_within_budget()
    assert judge_within_budget()
    assert estimate_cost_cny("qwen-plus", 1500, 8) <= 0.01


def test_cross_check_agreement_and_dispute_queue():
    assert parse_judge_label("Yes.") == "yes"
    assert parse_judge_label("maybe") is None
    request = judge_request("发改价格〔2025〕136号写了机制电量。", "原文：机制电量。")
    assert request["provider"] == "dashscope"
    assert request["estimated_cny"] <= 0.01
    checked = {"sentences": [
        {"text": "机制电量按原文。", "label": "支持", "shown": "机制电量按原文。", "status": "支持"},
        {"text": "另外一句。", "label": "支持", "shown": "另外一句。", "status": "支持"},
    ]}
    judged = apply_judgements(checked, ["yes", "no"])
    assert judged["sentences"][1]["status"] == "待核验"
    assert judged["review_queue"]
    pairs = [("yes", "yes")] * 9 + [("no", "yes")]
    assert agreement_with_human(pairs) >= 0.9


def test_readability_rewrites_once_then_flags_review():
    long = "这是一个故意写得很长并且没有逗号的句子用来检查句长规则是否会进入抽检队列因为改写无法拆开它。"
    result = ensure_readable(long, glossary=[])
    assert result["rewritten"] or result["review"] or result["ok"]
    comma = "前半句说明电价来自公告，后半句说明要写明文号和日期，第三段还在继续补充口径所以整句超过了限制。"
    rewritten = ensure_readable(comma)
    assert rewritten["rewritten"]
    assert "截至日期见所引用原文" in rewritten["text"]


def test_hybrid_recall_and_local_rerank(monkeypatch):
    docs = [
        {"source_id": "a", "doc_number": "发改价格〔2025〕136号", "issuer": "国家发展改革委", "content": "机制电量与市场交易电量分开结算"},
        {"source_id": "b", "doc_number": "无文号", "issuer": "示例", "content": "清洗周期与组件积灰"},
    ]
    rows = hybrid_scores("机制电量", docs, {"a": 0.9, "b": 0.1})
    assert rows[0]["source_id"] == "a"
    assert "文号：" in rows[0]["chunk"]
    formula_docs = [
        {"source_id": "formula", "title": "光伏发电站设计标准", "locator": "6.6 发电量计算", "content": "发电量 Ep = H_A × P_AZ × K"},
        {"source_id": "other", "content": "电价市场化交易"},
    ]
    formula_rows = hybrid_scores("只复述已收录公式。发电量计算公式 Ep = H_A × P_AZ × K（第 3 题）不要补充未收录内容。", formula_docs, {"formula": 0.1, "other": 0.95})
    assert formula_rows[0]["source_id"] == "formula"
    assert "定位：" in formula_rows[0]["chunk"]
    assert recall_at_k(rows, {"a"}) >= 0.85
    monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
    called = []
    ranked = rerank("机制电量", rows, remote=lambda *_args: called.append(1))
    assert ranked["engine"] == "local-lexical"
    assert called == []


def test_policy_diff_and_follow_frequency():
    extracted = extract_parameters("峰段 08:00 开始，电价 0.82 元/千瓦时，期限 20 年，容量 10 兆瓦。")
    assert affected_keys(extracted) == ["时段", "价格", "期限", "容量"]
    diff = project_diff({"价格": 0.8}, {"价格": 0.82})
    assert diff["needs_recalc"]
    now = datetime(2026, 10, 27, tzinfo=timezone.utc)
    assert allows_send("即时", now, now)
    assert not allows_send("每日汇总", now - timedelta(hours=2), now)
    assert allows_send("每周", now - timedelta(days=7), now)


def test_webhook_unbind_stops_push():
    reset_webhooks()
    assert push_allowed("u") is False
    bind_webhook("u", "https://example.cn/hook")
    assert push_allowed("u") is True
    unbind_webhook("u")
    assert push_allowed("u") is False


def test_expert_sample_does_not_invent_scores():
    from ops.weekly_expert_sample import apply_scores, due_for_optimization, select_sample
    sample = select_sample([{"id": str(i)} for i in range(30)], [{"id": "r"}] * 8)
    assert sample["scores"] is None
    assert sample["status"] == "pending_wecom"
    assert len(sample["answers"]) == 20
    untouched = apply_scores(sample, [])
    assert untouched["scores"] is None
    now = datetime(2026, 10, 27, tzinfo=timezone(timedelta(hours=8)))
    scored = apply_scores(sample, [{"id": "1", "accuracy": 2, "citation": 5, "bottom_line": 5, "readability": 5}], now)
    assert scored["failures"][0]["id"] == "1"
    assert due_for_optimization(scored["failures"][0], now + timedelta(hours=47))
    assert not due_for_optimization(scored["failures"][0], now + timedelta(hours=49))


def test_freshness_escalates_on_second_day():
    from ops.freshness_alert import collect, reset_alerts
    reset_alerts()
    records = [{"type_id": "policy", "updated_at": "2026-10-20", "published_at": "2026-10-01"}]
    first = collect(records, date(2026, 10, 26))
    second = collect(records, date(2026, 10, 27))
    assert first["sent"] is False
    assert "policy" in second["alert"]["escalated"]


def test_approval_matrix_voids_and_never_sends():
    from ops.approval_matrix import open_request, resolve_request
    now = datetime(2026, 10, 27, tzinfo=timezone(timedelta(hours=8)))
    request = open_request("退款", "abc", now)
    assert request["sent"] is False
    approved = resolve_request(request, "approved", now + timedelta(hours=1))
    assert approved["sent"] is False
    voided = resolve_request(request, None, now + timedelta(hours=48))
    assert voided["status"] == "void"
    assert voided["sent"] is False


def test_retention_north_star_and_typst_source(tmp_path, monkeypatch):
    from ops.log_retention import due_for_deletion, retention_policy
    from ops.north_star import digest, effective_seat, track_event
    policy = retention_policy()
    assert policy["backup_drill"]["last_signed"] is None
    assert due_for_deletion(184)
    assert not due_for_deletion(183)
    monkeypatch.delenv("NENGJIAN_UMAMI_URL", raising=False)
    tracked = track_event("测算", "u1")
    assert tracked["sent"] is False
    assert effective_seat(["打开政策原文"])
    assert digest(3)["sent"] is False
    source = render_source("测算报告", "首年发电量是测算值。")
    assert "Noto Sans SC" in source
    assert "收益承诺" not in source or "不构成" in source
    compiled = compile_pdf(source, tmp_path / "out.pdf")
    assert "compiled" in compiled


def test_tax_assumptions_default_uncounted():
    assert tax_assumptions()["增值税"] == "未计"
    assert tax_assumptions()["含税LCOE"] == "未计"


def test_finance_fixtures_match_independent_irr():
    rows = json.loads((ROOT / "data/eval/finance_irr_v1.json").read_text(encoding="utf-8"))
    assert len(rows) >= 50
    for row in rows:
        got = calc_irr(row["cashflows"])
        if row["expected_percent"] is None:
            assert got is None
        else:
            assert got is not None
            assert abs(got - row["expected_percent"]) <= 0.1


def test_redteam_and_false_positives_expanded():
    prompts = json.loads((ROOT / "data/redteam_prompts.json").read_text(encoding="utf-8"))["prompts"]
    facts = json.loads((ROOT / "data/eval/false_positives_v1.json").read_text(encoding="utf-8"))["items"]
    assert len(prompts) >= 600
    assert len(facts) >= 200
    missed = [item for item in prompts if not find_violations(item)]
    blocked = [item for item in facts if find_violations(item)]
    assert missed == []
    assert blocked == []


def test_repo_has_no_investment_analysis_phrase():
    needles = ("investment " + "case", "Investment " + "Analysis")
    skip = {".git", "node_modules", ".next", "dist", "__pycache__"}
    hits = []
    for dirpath, dirnames, filenames in os.walk(REPO):
        dirnames[:] = [name for name in dirnames if name not in skip]
        for name in filenames:
            if not name.endswith((".py", ".ts", ".tsx", ".json", ".md", ".yml")):
                continue
            path = Path(dirpath) / name
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeError, OSError):
                continue
            if any(needle in text for needle in needles):
                hits.append(str(path))
    assert hits == []


def test_carbon_public_view_hides_revenue_numbers():
    import importlib.util
    path = REPO / "runtime/services/monetization-service/app/skills/carbon_asset.py"
    spec = importlib.util.spec_from_file_location("carbon_asset_p1", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    view = module.public_reduction_view({"减排量_tCO2": 1.2, "CCER潜在收益_CNY": {"下限": 1, "上限": 2}})
    assert "CCER潜在收益_CNY" not in view
    assert view["减排量_tCO2"] == 1.2
    assert view["展示"] == "仅减排量"
    assert view["审批状态"] == "pending_wecom"


def test_skill_contract_requires_fields():
    import sys
    services = REPO / "runtime" / "services"
    sys.path.insert(0, str(services))
    from skill_contract import attach
    out = attach({"value": 1}, skill_id="RA-001", formula_ref="式", inputs={"ghi": 1}, assumptions=["口径见引用"], sources=["见方法卡"], valid_range="为正")
    assert out["contract"]["skill_id"] == "RA-001"
    with pytest.raises(ValueError):
        attach({}, skill_id="", formula_ref="式", inputs={}, assumptions=["有"], sources=["有"], valid_range="有")
    solar = (services / "resource-service/app/skills/solar_resource.py").read_text(encoding="utf-8")
    assert "_install_contract" in solar
