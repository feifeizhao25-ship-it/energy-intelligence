"""CA-001：2023 排放因子 0.5306 与 CCER 资格判定（陆上风光暂无方法学，不给收益）。"""
import importlib.util
import pathlib

import pytest

_P = pathlib.Path(__file__).resolve().parents[2] / "services/monetization-service/app/skills/carbon_asset.py"
_spec = importlib.util.spec_from_file_location("carbon_asset_20261015", _P)
carbon = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(carbon)


async def _run(**p):
    return await carbon.CarbonAssetSkill().execute(p)


def test_factor_and_source():
    assert carbon.DEFAULT_GRID_FACTOR_TCO2_PER_MWH == 0.5306
    assert "第47号" in carbon.GRID_FACTOR_SOURCE_CN and "2023" in carbon.GRID_FACTOR_SOURCE_CN
    assert carbon.GRID_FACTOR_URL.startswith("https://www.mee.gov.cn/")


@pytest.mark.asyncio
@pytest.mark.parametrize("ptype", ["solar_pv", "onshore_wind", "distributed_pv"])
async def test_onshore_wind_and_pv_get_no_ccer_revenue(ptype):
    r = await _run(annual_generation_mwh=1_000, market="cn", project_type=ptype)
    assert r["减排量_tCO2"] == pytest.approx(530.6, abs=1e-6)  # 1,000 MWh × 0.5306
    assert r["CCER潜在收益_CNY"] is None
    assert r["CCER资格"] == "暂无适用方法学"
    assert "陆上风电、光伏暂无适用方法学" in r["CCER说明"]


@pytest.mark.asyncio
async def test_unknown_type_does_not_assume_ccer():
    r = await _run(annual_generation_mwh=1_000, market="global")
    assert r["ccer_eligibility"] == "unknown"
    assert r["ccer_potential_revenue_cny"] is None


@pytest.mark.asyncio
async def test_production_does_not_require_ccer_prices_for_ineligible(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    r = await _run(annual_generation_mwh=100, market="cn", project_type="solar_pv")
    assert r["CCER潜在收益_CNY"] is None
    with pytest.raises(RuntimeError):
        await _run(annual_generation_mwh=100, market="cn", project_type="offshore_wind")
