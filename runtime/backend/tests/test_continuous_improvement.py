"""持续改进（金标准评测 / 陈旧扫描 / 雷达暂存 / 月报）测试：默认关闭、国内版与国际版分开、只写数据目录、候选永不自动通过。"""

import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from app.library import store
from app.self_improve import continuous as C
from app.self_improve import golden as G
from app.self_improve import radar_stage as RS
from app.self_improve.config import SILConfig

TZ = timezone(timedelta(hours=8))
NOW = datetime(2026, 11, 1, 5, 0, tzinfo=TZ)


def cfg(tmp_path, enabled=True):
    return SILConfig(product="energy", enabled=enabled, data_dir=str(tmp_path / "sil"))


def test_defaults_are_off(tmp_path):
    c = cfg(tmp_path, enabled=False)
    for fn in (C.run_golden, C.run_stale, C.run_radar, C.run_radar_stage, C.run_monthly_report):
        assert fn(NOW, cfg=c) == {"status": "disabled"}
    assert not (tmp_path / "sil").exists()
    assert C.SLOTS["golden_eval"].startswith("weekly:") and C.SLOTS["monthly_report"].startswith("monthly:")


def test_golden_files_valid_cover_every_skill_and_are_language_isolated():
    for ed, meta in C.EDITIONS.items():
        cases = G.load(meta["golden"])
        v = G.validate_all(cases, meta["lang"])
        assert v["invalid"] == {} and v["duplicate_ids"] == [], v
        assert G.coverage(cases, C.SKILLS[ed])["missing"] == []
        for c in cases:
            assert c["review_status"] in ("待审核", "Pending review")  # 没有专家签字
            assert c["expect"] == "refuse" or c["sources"]
    # 国际版全英文：任何题、必含词里都不能有汉字
    for c in G.load(C.EDITIONS["global"]["golden"]):
        assert not G.CJK.search(json.dumps(c, ensure_ascii=False)), c["id"]


def test_golden_run_passes_on_bundled_content(tmp_path):
    out = C.run_golden(NOW, force=True, cfg=cfg(tmp_path))
    assert out["status"] == "ok"
    for ed, r in out["editions"].items():
        assert r["pass_rate"] == 1.0, (ed, r["failures"])
        assert r["coverage_missing"] == []
    assert (tmp_path / "sil" / "cn" / "golden" / "last.json").exists() and (tmp_path / "sil" / "global" / "golden" / "last.json").exists()


def test_golden_regression_goes_to_worklist(tmp_path):
    c = cfg(tmp_path)
    cases = G.load(C.EDITIONS["cn"]["golden"])[:3]
    good = lambda case: {"text": " ".join(case["must_include"]), "citations": [s["url"] for s in case["sources"]]}
    good.wants_case = True
    bad = lambda case: {"text": "无关"}
    bad.wants_case = True
    assert C.run_golden(NOW, edition="cn", cases=cases, answer_fn=good, cfg=c)["editions"]["cn"]["regressions"] == []
    second = C.run_golden(NOW + timedelta(days=7), edition="cn", cases=cases, answer_fn=bad, cfg=c)
    assert set(second["editions"]["cn"]["regressions"]) == {x["id"] for x in cases}
    assert len((tmp_path / "sil" / "cn" / "worklist.jsonl").read_text("utf-8").splitlines()) == 3


def test_calc_reference_is_independent_of_the_code_under_test():
    import app.utils.financial_utils as F

    cf = [-1000, 500, 500, 500]
    assert abs(C._ref_irr(cf) - F.calc_irr(cf)) < 0.01


def test_stale_flags_expiring_rag_sources_per_edition(tmp_path):
    out = C.run_stale(datetime(2026, 12, 1, tzinfo=TZ), force=True, cfg=cfg(tmp_path))
    assert out["status"] == "ok" and set(out["editions"]) == {"cn", "global"}
    rep = json.loads((tmp_path / "sil" / "cn" / "stale_report.json").read_text("utf-8"))
    assert any(f["kind"] == "expiring_soon" or f["kind"] == "expired" for f in rep["findings"])
    assert all(not f["id"].startswith("en-intl") for f in rep["findings"])  # 国际版条目不进国内版报告


def test_staged_entries_pending_and_never_visible():
    staged = store.load_staged("cn")
    assert {e["id"] for e in staged} == {"en-lib-s01", "en-lib-s02", "en-lib-s03"}
    visible = {e["id"] for e in store.annotated("cn", date(2026, 11, 1), include_hidden=True)}
    assert not visible & {e["id"] for e in staged}
    for e in staged:
        assert e["review_status"] == "待审核" and e["source"]["url"].startswith("https://") and e["source"]["tier"] == "A"
    assert store.load_staged("global") == []


def test_promote_requires_listed_reviewer_and_stays_pending(monkeypatch, tmp_path):
    from app.library import review_cli

    monkeypatch.setenv("ENERGY_LIBRARY_DIR", str(tmp_path / "lib"))
    assert review_cli.main(["--edition", "cn", "promote", "en-lib-s01", "--reviewer", "u1"], env={}) == 3  # 名单为空：谁也不能审
    env = {"POLICY_REVIEWERS": "u1"}
    assert review_cli.main(["--edition", "cn", "promote", "en-lib-s01", "--reviewer", "u1"], env=env) == 0
    doc = json.loads((tmp_path / "lib" / "reference_entries_cn.json").read_text("utf-8"))
    e = next(x for x in doc["entries"] if x["id"] == "en-lib-s01")
    assert e["review_status"] == "待审核" and "reviewer" not in e
    assert review_cli.main(["--edition", "cn", "promote", "en-lib-s01", "--reviewer", "u1"], env=env) == 2


def test_radar_stage_lead_only(tmp_path):
    c = cfg(tmp_path)
    rd = tmp_path / "sil" / "radar"
    rd.mkdir(parents=True)
    items = [
        {"source": "arxiv", "id": "2611.1", "title": "Photovoltaic power forecasting benchmark", "summary": "solar", "url": "https://arxiv.org/abs/2611.1", "license": None},
        {"source": "github", "id": "a/gpl", "title": "Wind farm optimiser", "summary": "wind", "url": "https://github.com/a/gpl", "license": "GPL-2.0"},
        {"source": "arxiv", "id": "2611.2", "title": "Cooking", "summary": "recipes", "url": "https://arxiv.org/abs/2611.2", "license": None},
    ]
    (rd / "items_20261101.json").write_text(json.dumps(items), "utf-8")
    out = C.run_radar_stage(NOW, force=True, cfg=c)
    assert out["staged"] == 2
    rows = RS.load_staged(tmp_path / "sil" / "library_staged.jsonl")
    assert all(r["review_status"] == "待审核" and r["kind"] == "lead" and not r["visible"] and not r["auto_approved"] for r in rows)
    assert {r["title"]: r["ingest_allowed"] for r in rows}["Wind farm optimiser"] is False
    assert C.run_radar_stage(NOW, force=True, cfg=c)["staged"] == 0


def test_monthly_report_per_edition_and_language(tmp_path):
    c = cfg(tmp_path)
    C.run_golden(datetime(2026, 10, 25, 3, 30, tzinfo=TZ), force=True, cfg=c)
    out = C.run_monthly_report(NOW, force=True, cfg=c, env={})
    assert out["month"] == "2026-10"
    cn = Path(out["editions"]["cn"]["markdown"]).read_text("utf-8")
    gl = Path(out["editions"]["global"]["markdown"]).read_text("utf-8")
    assert "月度改进报告" in cn and "Monthly improvement report" in gl
    assert not G.CJK.search(gl), "国际版报告必须全英文"
    assert "人工批准" in cn


def test_english_input_layer_blocks_investment_requests_but_not_energy_questions():
    """金标准评测发现：国际版输入层原来拦不住英文投资建议请求。只在输入层拦，不进输出过滤。"""
    from app.services.bottom_line import blocked_input_text, enforce_bottom_line

    for q in ("Which renewable energy stock should I buy now?", "Guarantee me a 12% annual return on this solar project", "Is it a good time to buy solar ETF?", "Recommend a stock to buy"):
        assert blocked_input_text(q, market="global") is not None, q
    for q in ("When should I buy a heat pump?", "What is the LCOE of utility-scale solar?", "Which stock exchange lists Chinese renewable companies?", "How do I calculate the IRR of a battery project?"):
        assert blocked_input_text(q, market="global") is None, q
    assert enforce_bottom_line("I do not recommend any stocks; this is general information only.", market="global").startswith("I do not recommend")


def test_chinese_buy_timing_gap_is_closed():
    from app.services.bottom_line import blocked_input_text

    assert blocked_input_text("我想买光伏ETF，现在是买入的好时机吗") is not None
    assert blocked_input_text("光伏组件采购的最佳时机是什么季节") is None
    assert blocked_input_text("政策原文：买入电价怎么确定") is None


def test_beat_entries_only_registered_when_sil_enabled(monkeypatch):
    from app.tasks import celery_app

    monkeypatch.delenv("SIL_ENABLED", raising=False)
    assert celery_app._continuous_beat() == {}
    monkeypatch.setenv("SIL_ENABLED", "1")
    beat = celery_app._continuous_beat()
    assert {v["task"] for v in beat.values()} == {"energy.domestic.stale_scan", "energy.domestic.golden_eval", "energy.domestic.radar", "energy.domestic.radar_stage", "energy.domestic.monthly_report"}
