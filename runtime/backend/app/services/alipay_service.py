"""Minimal, auditable Alipay RSA2 page-pay integration.

The service deliberately owns price lookup and signature construction. Client
amounts are never accepted, and membership activation happens only in the
verified callback transaction in the billing router.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from app.config import settings

_ENTITLEMENTS_PATH = Path(__file__).resolve().parents[2] / "data" / "entitlements.json"
_PRODUCTION_GATEWAY = "https://openapi.alipay.com/gateway.do"
_SANDBOX_GATEWAY = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"


def _pem(value: str) -> bytes:
    return value.replace("\\n", "\n").strip().encode("utf-8")


def _canonical(params: dict[str, str], *, callback: bool = False) -> str:
    excluded = {"sign"}
    if callback:
        excluded.add("sign_type")
    return "&".join(
        f"{key}={params[key]}"
        for key in sorted(params)
        if key not in excluded and params[key] not in (None, "")
    )


class AlipayService:
    def _require_config(self) -> None:
        required = {
            "ALIPAY_APP_ID": settings.ALIPAY_APP_ID,
            "ALIPAY_SELLER_ID": settings.ALIPAY_SELLER_ID,
            "ALIPAY_PRIVATE_KEY": settings.ALIPAY_PRIVATE_KEY,
            "ALIPAY_PUBLIC_KEY": settings.ALIPAY_PUBLIC_KEY,
            "ALIPAY_NOTIFY_URL": settings.ALIPAY_NOTIFY_URL,
            "ALIPAY_RETURN_URL": settings.ALIPAY_RETURN_URL,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(f"支付宝商户配置缺失：{', '.join(missing)}")
        if settings.ENVIRONMENT == "production":
            urls = [settings.ALIPAY_NOTIFY_URL, settings.ALIPAY_RETURN_URL]
            if settings.ALIPAY_SANDBOX:
                raise RuntimeError("生产环境禁止启用支付宝沙箱")
            if any(not str(url).startswith("https://") for url in urls):
                raise RuntimeError("生产环境支付宝回调地址必须使用 HTTPS")

    def price_for(self, plan: str, billing_period: str) -> Decimal:
        if billing_period not in {"monthly", "yearly"}:
            raise ValueError("billing_period must be monthly or yearly")
        registry = json.loads(_ENTITLEMENTS_PATH.read_text(encoding="utf-8"))
        tier = registry.get("tiers", {}).get(plan)
        if not tier or plan == "free":
            raise ValueError("不支持的会员套餐")
        value = tier.get("price", {}).get(f"{billing_period}_cny")
        amount = Decimal(str(value or 0)).quantize(Decimal("0.01"))
        if amount <= 0:
            raise ValueError("该套餐不支持所选付费周期")
        return amount

    def create_page_pay_url(
        self, *, order_no: str, plan: str, billing_period: str, amount: Decimal
    ) -> str:
        self._require_config()
        expected = self.price_for(plan, billing_period)
        if amount != expected:
            raise ValueError("订单金额与服务端会员价格不一致")
        product = json.dumps(
            {
                "out_trade_no": order_no,
                "product_code": "FAST_INSTANT_TRADE_PAY",
                "total_amount": f"{amount:.2f}",
                "subject": f"新能源智库-{plan}-{billing_period}",
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )
        params = {
            "app_id": str(settings.ALIPAY_APP_ID),
            "method": "alipay.trade.page.pay",
            "format": "JSON",
            "charset": "utf-8",
            "sign_type": "RSA2",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "version": "1.0",
            "notify_url": str(settings.ALIPAY_NOTIFY_URL),
            "return_url": str(settings.ALIPAY_RETURN_URL),
            "biz_content": product,
        }
        private_key = serialization.load_pem_private_key(
            _pem(str(settings.ALIPAY_PRIVATE_KEY)), password=None
        )
        signature = private_key.sign(
            _canonical(params).encode("utf-8"), padding.PKCS1v15(), hashes.SHA256()
        )
        params["sign"] = base64.b64encode(signature).decode("ascii")
        gateway = settings.ALIPAY_GATEWAY_URL or (
            _SANDBOX_GATEWAY if settings.ALIPAY_SANDBOX else _PRODUCTION_GATEWAY
        )
        if not str(gateway).startswith("https://"):
            raise RuntimeError("支付宝网关必须使用 HTTPS")
        return f"{gateway}?{urlencode(params)}"

    def verify_callback(self, params: dict[str, str]) -> bool:
        self._require_config()
        if params.get("app_id") != settings.ALIPAY_APP_ID:
            return False
        if params.get("seller_id") != settings.ALIPAY_SELLER_ID:
            return False
        signature = params.get("sign")
        if not signature or params.get("sign_type") != "RSA2":
            return False
        try:
            public_key = serialization.load_pem_public_key(
                _pem(str(settings.ALIPAY_PUBLIC_KEY))
            )
            public_key.verify(
                base64.b64decode(signature, validate=True),
                _canonical(params, callback=True).encode("utf-8"),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
        except (InvalidSignature, ValueError, TypeError):
            return False


alipay_service = AlipayService()
