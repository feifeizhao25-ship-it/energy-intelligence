"""electricity_price units: 0.32 CNY/kWh must not be priced as 0.32 CNY/MWh.

UI test 2026-10-31: a Chinese user entered 0.32 (CNY/kWh) and got IRR=null and NPV of about -22.8 million CNY,
because the engine read it as 0.32 per MWh. Storage with two full cycles a day (660 a year, common in Jiangsu)
was rejected because the cap was 365.
"""

import pytest

from app.schemas.finance import SolarFinanceRequest, StorageFinanceRequest, WindFinanceRequest, price_to_per_mwh

SOLAR_CN = dict(
    capacity_mw=10, capex_per_w=3.6, opex_per_kw_yr=45, capacity_factor=0.19,
    currency="CNY", debt_ratio=0.7, interest_rate=0.036, tax_rate=0.25,
)
SOLAR_CN_EXPLICIT_ITC = {**SOLAR_CN, "itc_rate": 0.0}


def test_bare_small_number_is_read_as_per_kwh_with_a_note():
    req = SolarFinanceRequest(electricity_price=0.32, **SOLAR_CN)
    assert req.electricity_price == pytest.approx(320.0)
    assert "0.32" in req.price_notes[0] and "CNY/kWh" in req.price_notes[0] and "electricity_price_unit" in req.price_notes[0]


def test_bare_large_number_stays_per_mwh_without_a_note():
    req = SolarFinanceRequest(electricity_price=320, **SOLAR_CN_EXPLICIT_ITC)
    assert req.electricity_price == 320 and req.price_notes == []


def test_explicit_unit_always_wins():
    kwh = SolarFinanceRequest(electricity_price=0.32, electricity_price_unit="per_kwh", **SOLAR_CN_EXPLICIT_ITC)
    assert kwh.electricity_price == pytest.approx(320.0) and "converted" in kwh.price_notes[0]
    mwh = SolarFinanceRequest(electricity_price=0.32, electricity_price_unit="per_mwh", **SOLAR_CN_EXPLICIT_ITC)
    assert mwh.electricity_price == 0.32 and mwh.price_notes == []


def test_itc_default_only_applies_outside_cny():
    assert SolarFinanceRequest(electricity_price=320, **SOLAR_CN).itc_rate == 0.0
    usd = {**SOLAR_CN, "currency": "USD"}
    assert SolarFinanceRequest(electricity_price=45, **usd).itc_rate == 0.30
    assert SolarFinanceRequest(electricity_price=320, itc_rate=0.1, **SOLAR_CN).itc_rate == 0.1


def test_us_style_price_per_mwh_unchanged():
    req = WindFinanceRequest(capacity_mw=300, capex_per_kw=1500, opex_per_kw_yr=45, electricity_price=70, currency="EUR")
    assert req.electricity_price == 70 and req.price_notes == []


def test_price_to_per_mwh_boundaries():
    assert price_to_per_mwh(4.99, None, "USD")[0] == pytest.approx(4990)
    assert price_to_per_mwh(5.0, None, "USD")[0] == 5.0


def test_two_cycles_a_day_is_allowed_but_not_absurd():
    base = dict(power_mw=5, capacity_mwh=10, peak_price_per_mwh=1100, offpeak_price_per_mwh=350, capex_per_kwh=1100, currency="CNY")
    assert StorageFinanceRequest(cycles_per_year=660, **base).cycles_per_year == 660
    with pytest.raises(ValueError):
        StorageFinanceRequest(cycles_per_year=731, **base)


@pytest.mark.asyncio
async def test_solar_api_gives_sane_result_for_cny_per_kwh(client, auth_headers):
    body = dict(electricity_price=0.32, **SOLAR_CN)
    r = await client.post("/api/v1/finance/solar", json=body, headers=auth_headers)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["irr"] is not None and 3 < out["irr"] < 40, out["irr"]
    assert out["npv"] > -5_000_000, "NPV must not be the -22.8 million of the unit bug"
    assert out["input_notes"] and "kWh" in out["input_notes"][0]
    assert any("ITC" in n for n in out["input_notes"]), "US ITC must not be silently applied to a CNY project"
    explicit = (await client.post("/api/v1/finance/solar", json={**body, "electricity_price": 320, "electricity_price_unit": "per_mwh", "itc_rate": 0}, headers=auth_headers)).json()
    assert explicit["irr"] == pytest.approx(out["irr"]) and explicit["input_notes"] == []


@pytest.mark.asyncio
async def test_storage_api_accepts_660_cycles(client, auth_headers):
    body = dict(power_mw=5, capacity_mwh=10, cycles_per_year=660, peak_price_per_mwh=1100, offpeak_price_per_mwh=350, capex_per_kwh=1100, currency="CNY")
    r = await client.post("/api/v1/finance/storage", json=body, headers=auth_headers)
    assert r.status_code == 200, r.text
