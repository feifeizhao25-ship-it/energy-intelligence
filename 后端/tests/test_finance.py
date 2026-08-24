"""
Tests for financial modeling utilities and endpoints.
Run with: pytest tests/test_finance.py -v
"""
import pytest
from app.utils.financial_utils import (
    calc_irr,
    calc_npv,
    calc_lcoe,
    calc_optimal_cleaning_interval,
    build_solar_cashflows,
)


# ── calc_irr ──────────────────────────────────────────────────────────────────
class TestCalcIRR:
    def test_positive_irr(self):
        """Standard project with positive IRR."""
        cashflows = [-1_000_000, 150_000, 180_000, 210_000, 240_000, 270_000]
        irr = calc_irr(cashflows)
        assert 0 < irr < 100, f"Expected IRR in percentage (0,100), got {irr}"

    def test_irr_precision(self):
        """Newton-Raphson should converge to tolerance 1e-7."""
        cashflows = [-100.0, 10.0, 20.0, 30.0, 40.0, 50.0]
        irr = calc_irr(cashflows)
        # Verify NPV at IRR ≈ 0 (within float tolerance)
        npv_at_irr = calc_npv(irr / 100, cashflows)  # convert percentage to decimal rate
        assert abs(npv_at_irr) < 0.01, f"NPV at IRR should be ~0, got {npv_at_irr}"

    def test_negative_irr_returns_none_or_negative(self):
        """Losing project — cashflows never recover investment."""
        cashflows = [-1_000_000, 10_000, 10_000, 10_000]
        irr = calc_irr(cashflows)
        # Either None/NaN or a large negative number
        assert irr is None or irr < 0

    def test_irr_known_value(self):
        """Validate against a manually computed IRR (~0.1 = 10%)."""
        # -1000 → 1100 in one period: IRR = 10%
        cashflows = [-1000.0, 1100.0]
        irr = calc_irr(cashflows)
        assert irr is not None
        assert abs(irr - 10.0) < 1e-2, f"Expected IRR ≈ 10.0 (percentage), got {irr}"


# ── calc_npv ──────────────────────────────────────────────────────────────────
class TestCalcNPV:
    def test_positive_npv(self):
        cashflows = [-1_000_000, 220_000, 220_000, 220_000, 220_000, 220_000, 220_000]
        npv = calc_npv(0.08, cashflows)
        assert npv > 0, f"Expected positive NPV, got {npv}"

    def test_zero_discount_rate(self):
        """At 0% discount, NPV = sum of cashflows."""
        cashflows = [-100.0, 30.0, 30.0, 30.0, 30.0]
        npv = calc_npv(0.0, cashflows)
        assert abs(npv - 20.0) < 0.01

    def test_negative_npv_high_rate(self):
        """At 100% discount rate, future cashflows become negligible."""
        cashflows = [-1_000_000, 100_000, 100_000, 100_000]
        npv = calc_npv(1.0, cashflows)
        assert npv < 0

    def test_npv_formula_correctness(self):
        """One-period: NPV = -C0 + C1/(1+r)"""
        r = 0.10
        cashflows = [-100.0, 110.0]
        expected = -100 + 110 / 1.10  # = 10
        npv = calc_npv(r, cashflows)
        assert abs(npv) < 0.01, f"Expected NPV ≈ 0, got {npv}"


# ── calc_lcoe ─────────────────────────────────────────────────────────────────
class TestCalcLCOE:
    def test_lcoe_reasonable_range(self):
        """Utility-scale solar LCOE should be $20–$60/MWh."""
        capex = 850_000         # $850k/MW
        opex_annual = 15_000   # $15k/MW/yr
        annual_gen_mwh = 1_800  # MWh/yr per MW (22% CF)
        lcoe = calc_lcoe(capex, opex_annual, annual_gen_mwh)
        assert 0.020 < lcoe < 0.060 or 20 < lcoe < 60, f"LCOE out of expected range: {lcoe}"

    def test_lcoe_higher_with_more_capex(self):
        """Higher CapEx → higher LCOE."""
        annual_gen = 2_000
        opex = 10_000
        lcoe_low  = calc_lcoe(500_000,   opex, annual_gen)
        lcoe_high = calc_lcoe(1_500_000, opex, annual_gen)
        assert lcoe_high > lcoe_low

    def test_lcoe_lower_with_more_generation(self):
        """More generation → lower LCOE."""
        capex = 1_000_000
        opex  = 15_000
        lcoe_low_gen  = calc_lcoe(capex, opex, 1_000)
        lcoe_high_gen = calc_lcoe(capex, opex, 3_000)
        assert lcoe_high_gen < lcoe_low_gen


# ── calc_optimal_cleaning_interval ────────────────────────────────────────────
class TestOptimalCleaning:
    def test_returns_positive_interval(self):
        interval = calc_optimal_cleaning_interval(500, 50, 2)
        assert 1 <= interval <= 60

    def test_higher_cost_longer_interval(self):
        """More expensive cleaning → clean less frequently."""
        cheap = calc_optimal_cleaning_interval(500,  50, 2)
        pricey= calc_optimal_cleaning_interval(5000, 50, 2)
        assert pricey > cheap

    def test_higher_soiling_shorter_interval(self):
        """Faster soiling → clean more frequently."""
        slow   = calc_optimal_cleaning_interval(500, 50, 1)
        fast   = calc_optimal_cleaning_interval(500, 50, 5)
        assert fast < slow


# ── build_solar_cashflows ─────────────────────────────────────────────────────
class TestSolarCashflows:
    def test_length(self):
        """Should return project_life + 1 cashflows (year 0 = capex)."""
        cashflows = build_solar_cashflows(
            capacity_mw=10.0,
            capex_per_w=0.85,
            opex_per_kw_yr=15.0,
            electricity_price=55.0,
            itc_rate=0.30,
            capacity_factor=0.225,
            degradation_rate=0.005,
            debt_ratio=0.70,
            interest_rate=0.055,
            tax_rate=0.21,
            project_life=25,
        )
        assert len(cashflows) == 26  # year 0 + years 1-25

    def test_year0_negative(self):
        """Year 0 should be the negative equity investment."""
        cashflows = build_solar_cashflows(
            capacity_mw=10.0, capex_per_w=0.85, opex_per_kw_yr=15.0,
            electricity_price=55.0, itc_rate=0.30, capacity_factor=0.225,
            degradation_rate=0.005, debt_ratio=0.70, interest_rate=0.055,
            tax_rate=0.21, project_life=25,
        )
        assert cashflows[0] < 0, "Year 0 must be negative (equity outflow)"

    def test_degradation_reduces_late_cashflows(self):
        """Year 25 cashflow should be < year 1 cashflow (degradation effect)."""
        cashflows = build_solar_cashflows(
            capacity_mw=10.0, capex_per_w=0.85, opex_per_kw_yr=15.0,
            electricity_price=55.0, itc_rate=0.30, capacity_factor=0.225,
            degradation_rate=0.005, debt_ratio=0.70, interest_rate=0.055,
            tax_rate=0.21, project_life=25,
        )
        assert cashflows[25] < cashflows[1], "Later cashflows should be lower due to degradation"

    def test_positive_irr_on_good_project(self):
        """A well-structured solar project should have positive IRR."""
        cashflows = build_solar_cashflows(
            capacity_mw=50.0, capex_per_w=0.85, opex_per_kw_yr=12.0,
            electricity_price=60.0, itc_rate=0.30, capacity_factor=0.25,
            degradation_rate=0.005, debt_ratio=0.70, interest_rate=0.055,
            tax_rate=0.21, project_life=25,
        )
        irr = calc_irr(cashflows)
        assert irr is not None and irr > 0, f"Expected positive IRR, got {irr}"


# ── Integration: finance endpoint ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_solar_finance_endpoint():
    """Integration test for the solar finance API endpoint."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Without auth — should return 401
        resp = await client.post("/api/v1/finance/solar", json={
            "capacity_mw": 10.0,
            "capex_per_w": 0.85,
            "opex_per_kw_yr": 15.0,
            "electricity_price": 55.0,
            "itc_rate": 0.30,
            "capacity_factor": 0.225,
        })
        assert resp.status_code == 401
