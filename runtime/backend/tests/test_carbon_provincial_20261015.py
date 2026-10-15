"""审计 8-2：CA-001 按项目所在省取 2023 年省级排放因子（公告 2025 年第 47 号附件表 3）。"""
import importlib.util
import pathlib

import pytest

_P = pathlib.Path(__file__).resolve().parents[2] / "services/monetization-service/app/skills/carbon_asset.py"
_spec = importlib.util.spec_from_file_location("carbon_asset_prov_20261015", _P)
carbon = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(carbon)


async def _run(**p):
    return await carbon.CarbonAssetSkill().execute(p)


@pytest.mark.asyncio
@pytest.mark.parametrize("prov,expected", [("江苏省", 582.7), ("云南", 133.3)])
async def test_jiangsu_yunnan_match_annex(prov, expected):
    r = await _run(annual_generation_mwh=1_000, market="cn", project_type="solar_pv", province=prov)
    assert r["减排量_tCO2"] == pytest.approx(expected, abs=1e-6)
    assert "省级" in r["排放因子口径"]


@pytest.mark.asyncio
async def test_unknown_province_falls_back_to_national():
    r = await _run(annual_generation_mwh=1_000, market="cn", project_type="solar_pv", province="西藏自治区")
    assert r["减排量_tCO2"] == pytest.approx(530.6, abs=1e-6)
    assert "未收录西藏" in r["排放因子口径"]


@pytest.mark.asyncio
async def test_explicit_factor_wins():
    r = await _run(annual_generation_mwh=1_000, market="cn", project_type="solar_pv", province="江苏", grid_emission_factor=0.6)
    assert r["减排量_tCO2"] == pytest.approx(600.0)
