"""国内版太阳能资源分级按 GB/T 31155-2014 四档（核4，2026-11-23）。国际版沿用原阈值。"""
import pytest

from app.services.solar_grade_gb31155 import grade
from app.services import domestic_resource as dr


@pytest.mark.parametrize("ghi,code,name,roman", [
    (2200, "A", "最丰富", "I"), (1750, "A", "最丰富", "I"), (1749.9, "B", "很丰富", "II"),
    (1450, "B", "很丰富", "II"), (1400, "B", "很丰富", "II"), (1399, "C", "丰富", "III"),
    (1050, "C", "丰富", "III"), (1049, "D", "一般", "IV"), (0, "D", "一般", "IV"),
])
def test_thresholds_are_1750_1400_1050(ghi, code, name, roman):
    g = grade(ghi)
    assert (g["gb_grade"], g["gb_grade_label"], g["resource_class"]) == (code, name, roman)
    assert g["grading_standard"].startswith("GB/T 31155-2014")


def test_score_continuous_monotonic_capped():
    xs = [i * 10 for i in range(0, 400)]
    s = [grade(x)["score"] for x in xs]
    assert all(b >= a for a, b in zip(s, s[1:]))
    assert max(s) <= 100 and grade(1e9)["score"] == 100
    for edge in (1050, 1400, 1750):
        assert abs(grade(edge)["score"] - grade(edge - 0.01)["score"]) < 0.2


def test_domestic_solar_fields_use_gb_grade():
    f = dr.solar_response_fields(39.9, 116.41)  # 北京样本
    g = grade(f["ghi"])
    assert f["resource_class"] == g["resource_class"] and f["gb_grade"] == g["gb_grade"]
    assert f["grading_standard"].startswith("GB/T 31155")


def test_domestic_response_schema_keeps_gb_fields():
    from app.schemas.resource import SolarResourceResponse
    r = SolarResourceResponse(**dr.solar_response_fields(39.9, 116.41))
    assert r.gb_grade in ("A", "B", "C", "D") and r.gb_grade_label


async def test_ra001_cn_uses_gb_global_keeps_legacy():
    import importlib.util, sys
    from pathlib import Path
    p = Path(__file__).resolve().parents[2] / "services" / "resource-service" / "app" / "skills" / "solar_resource.py"
    spec = importlib.util.spec_from_file_location("ra001_gb_test", p)
    m = importlib.util.module_from_spec(spec); sys.modules["ra001_gb_test"] = m; spec.loader.exec_module(m)
    cn = await m.SolarResourceSkill().execute({"latitude": 39.9, "longitude": 116.4, "market": "cn", "ghi_annual_kwh_m2": 1450})
    assert cn["resource_class"] == "II" and cn["gb_grade_label"] == "很丰富"
    gl = await m.SolarResourceSkill().execute({"latitude": 39.9, "longitude": 116.4, "market": "global", "ghi_annual_kwh_m2": 1450})
    assert gl["resource_class"] == "III" and "gb_grade" not in gl
