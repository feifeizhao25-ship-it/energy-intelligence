"""批2: 会员单一事实源 = entitlements.json 五档年付; 月付/停售档不得下单."""
import json, pathlib
import pytest
ROOT = pathlib.Path(__file__).resolve().parents[1]
REG = json.loads((ROOT/"data/entitlements.json").read_text())

def test_five_yearly_tiers_single_source():
    assert REG["tier_order"] == ["free","pro","full","team","enterprise"]
    assert REG["sales_billing_period"] == "yearly"
    prices = {k: REG["tiers"][k]["price"]["yearly_cny"] for k in REG["tier_order"]}
    assert prices == {"free":0,"pro":1980,"full":5800,"team":16800,"enterprise":33000}
    for tier in REG["tiers"].values():
        assert tier["price"]["monthly_cny"] == 0, "月付残留必须为 0"
    assert REG["tiers"]["maintenance"]["purchasable"] is False
    # 前端副本与后端唯一源一致
    web = json.loads((ROOT.parent/"web/src/lib/entitlements/entitlements.json").read_text())
    assert web == REG

def test_alipay_price_yearly_only():
    from app.services.alipay_service import alipay_service
    from decimal import Decimal
    assert alipay_service.price_for("pro","yearly") == Decimal("1980.00")
    with pytest.raises(ValueError):
        alipay_service.price_for("pro","monthly")
    with pytest.raises(ValueError):
        alipay_service.price_for("maintenance","yearly")
