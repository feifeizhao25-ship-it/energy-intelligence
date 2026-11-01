"""Owner decision 2026-11-01: the international (market=global) currency is USD, and the registry seats follow 0S2."""
import json
from pathlib import Path

import pytest

from app.services import market_localization as ml

REGISTRY = json.loads((Path(__file__).resolve().parents[1] / "data" / "entitlements.json").read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def _clear():
    ml.clear_price_cache()
    yield
    ml.clear_price_cache()


def _stripe(monkeypatch, price):
    from app.services.stripe_service import StripeService

    monkeypatch.setattr(StripeService, "get_price", staticmethod(lambda plan: price))


def test_usd_stripe_price_is_shown(monkeypatch):
    _stripe(monkeypatch, {"amount_cents": 41900, "currency": "usd", "interval": "year"})
    block = ml._price_block("pro")
    assert (block["amount_cents"], block["currency"], block["source"]) == (41900, "USD", "stripe")


@pytest.mark.parametrize("cur", ["eur", "gbp", "cny"])
def test_non_usd_stripe_price_is_never_shown(monkeypatch, cur):
    _stripe(monkeypatch, {"amount_cents": 41900, "currency": cur, "interval": "year"})
    block = ml._price_block("pro")
    assert block["amount_cents"] is None and block["source"] is None and "USD" in block["note"]


def test_global_copy_names_usd_and_never_cny():
    assert "USD" in ml.GLOBAL_PRICING_NOTE
    assert "USD" in ml.GLOBAL_BILLING_RULES["currency"]
    assert ml.INTERNATIONAL_CURRENCY == "USD"
    assert not ml.contains_cjk(ml.GLOBAL_PRICING_NOTE)


def test_checkout_refuses_non_usd_price(monkeypatch):
    from app.config import settings
    from app.services.stripe_service import StripeService

    monkeypatch.setattr(settings, "STRIPE_PRO_PRICE_ID", "price_test", raising=False)
    monkeypatch.setattr(settings, "STRIPE_SUCCESS_URL", "https://example.test/ok", raising=False)
    monkeypatch.setattr(settings, "STRIPE_CANCEL_URL", "https://example.test/no", raising=False)
    _stripe(monkeypatch, {"amount_cents": 100, "currency": "eur", "interval": "year"})
    with pytest.raises(RuntimeError, match="USD"):
        StripeService.create_checkout_session("u1", "pro")


def test_registry_seats_follow_0s2_not_the_older_d5_draft():
    seats = {t: REGISTRY["tiers"][t]["collaboration"]["team_seats"] for t in REGISTRY["tier_order"]}
    # D5 6-1 draft (2026-10-15) said team 5 / enterprise 20; 0S2 (registry v2.0.0, 2026-10-27) is the newer decision.
    assert seats == {"free": 1, "pro": 1, "full": 3, "team": 10, "enterprise": 10}
