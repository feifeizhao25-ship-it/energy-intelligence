"""国内版风功率密度按 GB/T 18710-2002 附录 B（瑞利分布求 v³ 期望）、分级按表 4（核1，2026-11-23）。国际版不变。"""
import importlib.util
import math
import sys
from pathlib import Path

import pytest

from app.services import domestic_resource as dr
from app.services.wind_grade_gbt18710 import assess, cube_factor, height_ratio, score_50m


def _skill():
    p = Path(__file__).resolve().parents[2] / "services" / "resource-service" / "app" / "skills" / "wind_resource.py"
    spec = importlib.util.spec_from_file_location("ra002_gb_test", p)
    m = importlib.util.module_from_spec(spec); sys.modules["ra002_gb_test"] = m; spec.loader.exec_module(m)
    return m


def test_reviewed_weibull_case_is_about_472_not_252():
    # 审阅：mean 7.39、k=2、c=8.34 时旧式 ½ρ·v̄³ 约 252，威布尔公式约 472。
    c = 8.34
    hand = 0.5 * 1.225 * c ** 3 * math.gamma(1 + 1.5)
    assert hand == pytest.approx(472, abs=2)
    from app.utils.wind_calculations import weibull_power_density
    assert weibull_power_density(7.39, k=2) == pytest.approx(hand, rel=0.02)


def test_cube_factor_is_6_over_pi():
    assert cube_factor() == pytest.approx(6 / math.pi, rel=1e-9)


def test_6_5_ms_is_about_321_and_grade_3():
    # 步骤5 核1：6.5 m/s 原来算 168 W/m²（1 级），按附录 B 应约 321 W/m²（3 级）
    g = assess([6.5], height_m=50)
    assert g["wind_power_density"] == pytest.approx(321.3, abs=0.2)
    assert g["gb_grade"] == 3 and g["gb_grade_label"].startswith("3 级")
    assert g["resource_class"] == "II"


@pytest.mark.parametrize("wpd,grade", [(150, 1), (199.9, 1), (200, 2), (350, 3), (450, 4), (550, 5), (700, 6), (900, 7)])
def test_table4_50m(wpd, grade):
    v = ((wpd + 0.01) / (0.5 * 1.225 * cube_factor())) ** (1 / 3)
    assert assess([v], height_m=50)["gb_grade"] == grade


def test_score_monotonic_capped_continuous():
    xs = [i * 5 for i in range(0, 400)]
    s = [score_50m(x) for x in xs]
    assert all(b >= a for a, b in zip(s, s[1:])) and max(s) <= 100
    assert score_50m(397.8) < 100  # 原来 397.8 W/m² 得 147.8 分
    for edge in (200, 300, 400):
        assert abs(score_50m(edge) - score_50m(edge - 0.01)) < 0.1


def test_domestic_wind_fields_100m_to_50m():
    f = dr.wind_response_fields(39.9, 116.41)
    monthly = f["monthly_speed"]
    assert f["wind_power_density"] > 0.5 * 1.225 * (sum(monthly) / 12) ** 3 * 1.8  # 不再是均值立方
    assert f["wind_power_density_50m"] < f["wind_power_density"]
    assert 1 <= f["gb_grade"] <= 7 and f["grading_standard"].startswith("GB/T 18710")
    from app.schemas.resource import WindResourceResponse
    fields = dict(f); fields.pop("data_source")
    assert WindResourceResponse(**fields).gb_grade == f["gb_grade"]


def test_height_ratio_matches_web_log_law():
    assert height_ratio(50, 100) == pytest.approx(math.log(100 / 0.03) / math.log(50 / 0.03))


async def test_ra002_cn_uses_gb_global_unchanged():
    m = _skill()
    cn = await m.WindResourceSkill().execute({"latitude": 41, "longitude": 114, "market": "cn", "mean_speed_ms": 6.5})
    assert cn["wind_power_density"] == pytest.approx(321.3, abs=0.2) and cn["gb_grade"] == 3 and cn["score"] <= 100
    gl = await m.WindResourceSkill().execute({"latitude": 41, "longitude": 114, "market": "global", "mean_speed_ms": 6.5})
    scale = 6.5 / math.gamma(1.5)
    expected = 0.5 * 1.225 * scale ** 3 * math.gamma(2.5)
    assert gl["wind_power_density"] == pytest.approx(expected, abs=0.2)
    assert "gb_grade" not in gl
    assert str(gl["grading_standard"]).startswith("IEC 61400-1:2019")
