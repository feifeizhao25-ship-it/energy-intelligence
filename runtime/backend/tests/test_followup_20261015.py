"""Regression tests for 2026-10-15 follow-up fixes."""
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.routers import reports
from app.utils.financial_utils import build_solar_cashflows, calc_irr


def test_refresh_token_is_not_accepted_as_access_token():
    refresh = create_refresh_token(subject="user_1")
    assert decode_token(refresh) is None
    assert decode_token(refresh, expected_type="refresh") == "user_1"


def test_access_token_still_decodes():
    assert decode_token(create_access_token(subject="user_2")) == "user_2"
    assert decode_token(create_access_token(subject="u"), expected_type="refresh") is None


def test_reports_dir_honours_env(tmp_path, monkeypatch):
    target = tmp_path / "writable" / "reports"
    monkeypatch.setenv("REPORTS_DIR", str(target))
    rid = "123e4567-e89b-12d3-a456-426614174000"
    assert reports._report_file(rid, "pdf") == str(target / f"{rid}.pdf")


def test_reports_dir_defaults_to_cwd_when_unset(tmp_path, monkeypatch):
    monkeypatch.delenv("REPORTS_DIR", raising=False)
    monkeypatch.chdir(tmp_path)
    assert reports._reports_dir() == str(tmp_path / "generated_reports")


_ARGS = dict(
    capacity_mw=10.0, capex_per_w=0.85, opex_per_kw_yr=15.0, electricity_price=55.0,
    itc_rate=0.0, capacity_factor=0.225, degradation_rate=0.0, debt_ratio=0.70,
    interest_rate=0.055, tax_rate=0.21, project_life=25,
)


def test_loan_principal_is_an_outflow_not_income():
    with_debt = build_solar_cashflows(**_ARGS)
    capex = 10.0 * 1_000_000 * 0.85
    principal = capex * 0.70 / 25
    revenue = 10.0 * 1000 * 8760 * 0.225 * 55.0 / 1000
    opex = 10.0 * 1000 * 15.0
    interest = capex * 0.70 * 0.055
    ebt = revenue - opex - interest
    expected_y1 = ebt - max(0, ebt * 0.21) - principal
    assert abs(with_debt[1] - expected_y1) < 1e-6


def test_total_equity_cashflow_does_not_exceed_unlevered_profit():
    # Sum of levered equity CFs must be <= unlevered (debt costs interest).
    levered = sum(build_solar_cashflows(**_ARGS))
    unlevered = sum(build_solar_cashflows(**{**_ARGS, "debt_ratio": 0.0}))
    assert levered <= unlevered + 1e-6
    assert calc_irr(build_solar_cashflows(**_ARGS)) is not None
