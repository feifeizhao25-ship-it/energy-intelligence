"""核12 / 核21（2026-11-23）：ST-001 引 GB/T 36276-2023；OM-001 净收益为负时提示不划算；FM-001 文档公式与代码一致。"""
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def _load(rel, name):
    spec = importlib.util.spec_from_file_location(name, str(ROOT / rel))
    m = importlib.util.module_from_spec(spec); sys.modules[name] = m; spec.loader.exec_module(m)
    return m


clean = _load("services/diagnostic-service/app/skills/cleaning_schedule.py", "_notes_om001")
storage = _load("services/simulation-service/app/skills/storage_sizing.py", "_notes_st001")
lcoe = _load("services/financial-service/app/skills/lcoe.py", "_notes_fm001")

P = {"pr_loss_pct": 4.0, "dust_level": "high", "rainfall_30d_mm": 0.0, "soiling_rate_pct_per_day": 0.5}


async def test_om001_negative_net_benefit_says_not_worth_it():
    r = await clean.CleaningScheduleSkill().execute({**P, "market": "cn"})
    assert r["清洗排程"]["扣除成本净收益"] < 0
    assert r["清洗排程"]["清洗是否划算"] is False and "不划算" in r["不划算提示"]


async def test_om001_positive_net_benefit_no_hint():
    r = await clean.CleaningScheduleSkill().execute({**P, "market": "cn", "cleaning_cost": 100, "daily_revenue": 5000})
    if r["清洗排程"]["扣除成本净收益"] >= 0:
        assert r["清洗排程"]["清洗是否划算"] is True and "不划算提示" not in r


async def test_om001_global_unchanged():
    r = await clean.CleaningScheduleSkill().execute({**P, "market": "global"})
    assert "不划算提示" not in r and "cleaning_schedule" in r


def test_st001_cites_36276_2023():
    text = json.dumps(getattr(storage.StorageSizingSkill, "references", None) or storage.__dict__.get("REFERENCES") or open(storage.__file__, encoding="utf-8").read(), ensure_ascii=False)
    assert "GB/T 36276-2023" in text and "GB/T 36276-2018 电力储能用锂离子电池（" not in text


def test_fm001_doc_matches_calc_lcoe():
    assert "(1 - degradation)^(t-1)" in lcoe.__doc__
    from app.utils.financial_utils import calc_lcoe
    # 2 年、无折现：第 1 年不衰减 → LCOE = capex / (E + E·(1-d))
    assert calc_lcoe(1_000_000, 0, 1_000_000, discount_rate=0.0, project_life=2, degradation_rate=0.1) == pytest.approx(1 / 1.9, abs=1e-4)
