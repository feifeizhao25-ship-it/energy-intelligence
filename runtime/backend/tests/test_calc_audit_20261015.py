"""2026-10-15 口径审计：手算参考用例（PR / LCOE / 风速 / NASA 单位 / PDF 字体）。"""
import inspect
import io
import re

import pytest

from app.utils.financial_utils import calc_lcoe
from app.utils.wind_calculations import wind_shear_extrapolation


# ── LCOE ──────────────────────────────────────────────────────────────────────
def test_lcoe_hand_case_no_degradation():
    # capex 1000, opex 100/yr, 1000 kWh/yr, r=10%, 2 yrs:
    # PV(cost) = 1000 + 100/1.1 + 100/1.21 = 1173.5537; PV(E) = 1735.5372 → 0.67619 元/kWh
    assert calc_lcoe(1000, 100, 1000, discount_rate=0.1, project_life=2, degradation_rate=0) == pytest.approx(0.6762, abs=1e-4)


def test_lcoe_year1_is_undegraded():
    # d=10%, 1 yr: PV(E) = 1000/1.1 (no degradation in year 1) → (1000+100/1.1)/(1000/1.1) = 1.2
    assert calc_lcoe(1000, 100, 1000, discount_rate=0.1, project_life=1, degradation_rate=0.1) == pytest.approx(1.2, abs=1e-4)
    # 2 yrs: E2 = 900. PV(E) = 909.0909 + 743.8017 = 1652.8926; PV(C)=1173.5537 → 0.71
    assert calc_lcoe(1000, 100, 1000, discount_rate=0.1, project_life=2, degradation_rate=0.1) == pytest.approx(0.7100, abs=1e-4)


def test_finance_callers_pass_project_life_and_degradation():
    from app.api.v1 import finance
    from app.services import finance_service
    for mod in (finance, finance_service):
        calls = re.findall(r"calc_lcoe\((.*?)\)", inspect.getsource(mod), re.S)
        assert calls, mod
        for args in calls:
            assert "project_life" in args and "degradation_rate" in args, (mod, args)


# ── 风速（功率律，m/s）────────────────────────────────────────────────────────
def test_wind_shear_power_law_hand_case():
    # 6 m/s @10 m → 80 m, α=0.2: 6 × 8^0.2 = 6 × 1.51572 = 9.0943
    assert wind_shear_extrapolation(6, 10, 80, 0.2) == pytest.approx(9.0943, abs=1e-4)
    assert wind_shear_extrapolation(6, 10, 10) == pytest.approx(6)


# ── PR：年辐照 × 容量 × PR，不乘 365 ──────────────────────────────────────────
def test_yield_fallback_formula_has_no_extra_365():
    import pathlib
    # app/routers/resource.py 目前未挂载且导入失败（缺 app.utils.exceptions），按源码检查
    text = (pathlib.Path(__file__).resolve().parents[1] / "app/routers/resource.py").read_text()
    src = text[text.index("async def yield_estimate"):text.index("async def yield_estimate") + 2500]
    assert "body.capacity_mw * 1000 * annual_ghi * body.pr" in src
    assert "365" not in src
    # hand case: 1 MW × 1000 kW/MW × 1600 kWh/m²/yr × 0.82 = 1,312,000 kWh → CF 14.98%
    assert 1 * 1000 * 1600 * 0.82 / (1 * 1000 * 8760) == pytest.approx(0.1498, abs=1e-4)


# ── NASA POWER 单位：kWh/m²/day × 365，不再 ÷1000 ────────────────────────────
@pytest.mark.asyncio
async def test_nasa_power_annual_ghi_units(monkeypatch):
    from app.services import nasa_power_service

    class Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"properties": {"parameter": {"ALLSKY_SFC_SW_DWN": {
                "20200101": 4.0, "20200102": 5.0, "20200103": -999.0}}}}

    class Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return Resp()

    monkeypatch.setattr(nasa_power_service.httpx, "AsyncClient", Client)
    out = await nasa_power_service.NASAPowerService().get_solar_resource(31.2, 121.5)
    assert out["ghi_annual"] == pytest.approx(4.5 * 365, abs=0.1)  # 1642.5, fill value ignored


# ── PDF 字体：本地字体、嵌入、无外链 ──────────────────────────────────────────
def test_report_source_has_no_remote_font_urls():
    from app.routers import reports
    src = inspect.getsource(reports)
    assert not re.search(r"fonts\.googleapis|fonts\.gstatic|https?://[^\"']+\.(ttf|otf|woff2?)", src)


def test_requirements_include_reportlab_and_dockerfile_has_truetype_cjk_font():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    assert re.search(r"^reportlab", (root / "requirements.txt").read_text(), re.M)
    assert "fonts-wqy-zenhei" in (root / "Dockerfile").read_text()


def test_pdf_embeds_local_cjk_font():
    pytest.importorskip("reportlab")
    from reportlab.pdfgen import canvas
    from app.routers import reports

    name = reports._register_cn_font()
    if name in ("Helvetica", "STSong-Light"):
        pytest.skip("no local TrueType CJK font on this machine")
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.setFont(name, 12)
    c.drawString(72, 720, "新能源可研报告")
    c.save()
    pdf = buf.getvalue()
    assert b"/FontFile2" in pdf  # TrueType 字体已嵌入（子集），不依赖查看器
