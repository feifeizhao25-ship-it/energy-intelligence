"""43：省会样本改用 NASA POWER 气候态缓存，注明来源与偏差；前后端同一份数据（2026-11-23）。"""
import json
import math
from pathlib import Path

import pytest

from app.services.domestic_resource import lookup

ROOT = Path(__file__).resolve().parents[1]
DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
R = math.log(100 / 0.03) / math.log(50 / 0.03)


def _seed():
    return json.loads((ROOT / "data" / "domestic_resources.json").read_text(encoding="utf-8"))


def test_backend_and_web_seed_identical():
    web = ROOT.parent / "web" / "src" / "data" / "domestic-resources.json"
    assert json.loads(web.read_text(encoding="utf-8")) == _seed()


def test_source_and_bias_are_stated():
    d = _seed()
    assert d["source"]["name"] == "NASA POWER" and d["source"]["period"] == "2001–2025"
    note = d["license_note"]
    for w in ("离线样本", "power.larc.nasa.gov", "注明出处", "通知", "不是地面气象站实测", "偏差", "对数律"):
        assert w in note, w
    assert "气象局" not in note  # 不用气象局数据
    for s in d["stations"]:
        assert s["license_note"] == note and "NASA POWER" in s["provenance"]


def test_internal_consistency():
    for s in _seed()["stations"]:
        assert len(s["monthly_daily_ghi"]) == len(s["monthly_ghi"]) == len(s["monthly_temp"]) == 12
        for i in range(12):
            assert s["monthly_ghi"][i] == pytest.approx(s["monthly_daily_ghi"][i] * DAYS[i], abs=0.06)
            assert s["monthly_wind_100m"][i] == pytest.approx(s["monthly_wind_50m"][i] * R, abs=0.006)
        assert s["ghi_annual"] == pytest.approx(sum(s["monthly_ghi"]), abs=0.6)
        assert 900 < s["ghi_annual"] < 2300


def test_beijing_peak_not_july_and_lhasa_highest():
    # 步骤5 核5/核11：原样本 19 城 7 月出峰；NASA POWER 北京峰值在 5 月
    st = {s["city"]: s for s in _seed()["stations"]}
    bj = st["北京"]["monthly_ghi"]
    assert bj.index(max(bj)) + 1 == 5
    assert max(st, key=lambda c: st[c]["ghi_annual"]) == "拉萨"


def test_lookup_returns_new_provenance():
    row = lookup(39.9, 116.41)
    assert row["data_source"].startswith("离线样本：NASA POWER") and row["ghi_annual"] == pytest.approx(1443.8, abs=1)
