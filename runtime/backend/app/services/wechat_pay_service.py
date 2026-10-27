"""微信支付 API v3：Native 与 JSAPI。金额只取服务端标价，通知先验签再解密。"""

from __future__ import annotations

import base64
import json
import os
import secrets
import time
from decimal import Decimal
from urllib.parse import quote

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

HOST = "https://api.mch.weixin.qq.com"


def _pem(value: str) -> str:
    return value.replace("\\n", "\n").strip()


def _environment() -> str:
    return os.environ.get("ENVIRONMENT") or settings.ENVIRONMENT or "development"


class WechatPayError(RuntimeError):
    def __init__(self, message: str, code: str = "WECHAT_PAY_ERROR"):
        super().__init__(message)
        self.code = code


def read_config() -> dict | None:
    app_id = os.environ.get("WECHAT_PAY_APP_ID") or settings.WECHAT_PAY_APP_ID or ""
    mch_id = os.environ.get("WECHAT_PAY_MCH_ID") or settings.WECHAT_PAY_MCH_ID or ""
    api_v3_key = os.environ.get("WECHAT_PAY_API_V3_KEY") or os.environ.get("WECHAT_PAY_API_KEY") or settings.WECHAT_PAY_API_KEY or ""
    serial_no = os.environ.get("WECHAT_PAY_SERIAL_NO") or settings.WECHAT_PAY_SERIAL_NO or ""
    private_key = _pem(os.environ.get("WECHAT_PAY_PRIVATE_KEY") or settings.WECHAT_PAY_PRIVATE_KEY or "")
    notify_url = os.environ.get("WECHAT_PAY_NOTIFY_URL") or settings.WECHAT_PAY_NOTIFY_URL or ""
    platform_public_key = _pem(os.environ.get("WECHAT_PAY_PLATFORM_PUBLIC_KEY") or "")
    sandbox_raw = os.environ.get("WECHAT_PAY_SANDBOX")
    if sandbox_raw is None:
        sandbox = bool(settings.WECHAT_PAY_SANDBOX)
    else:
        sandbox = sandbox_raw in {"1", "true", "True"}
    if not all([app_id, mch_id, api_v3_key, serial_no, private_key, notify_url]):
        return None
    if _environment() == "production" and (sandbox or os.environ.get("PAYMENT_SIMULATION") == "1"):
        raise WechatPayError("生产环境禁止模拟支付", "PAYMENT_SIMULATION_FORBIDDEN")
    if len(api_v3_key) != 32:
        raise WechatPayError("微信支付密钥长度不正确", "WECHAT_PAY_NOT_CONFIGURED")
    return {
        "app_id": app_id,
        "mch_id": mch_id,
        "api_v3_key": api_v3_key,
        "serial_no": serial_no,
        "private_key": private_key,
        "notify_url": notify_url,
        "platform_public_key": platform_public_key,
        "sandbox": sandbox,
    }


def _sign(private_key_pem: str, message: str) -> str:
    key = serialization.load_pem_private_key(private_key_pem.encode(), password=None)
    signature = key.sign(message.encode(), padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(signature).decode()


def authorization_header(config: dict, method: str, path: str, body: str) -> str:
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    message = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body}\n"
    signature = _sign(config["private_key"], message)
    return (
        'WECHATPAY2-SHA256-RSA2048 '
        f'mchid="{config["mch_id"]}",nonce_str="{nonce}",timestamp="{timestamp}",'
        f'serial_no="{config["serial_no"]}",signature="{signature}"'
    )


def verify_notify(config: dict, timestamp: str, nonce: str, body: str, signature: str) -> bool:
    if not config.get("platform_public_key") or not signature:
        return False
    try:
        key = serialization.load_pem_public_key(config["platform_public_key"].encode())
        key.verify(base64.b64decode(signature), f"{timestamp}\n{nonce}\n{body}\n".encode(), padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:
        return False


def decrypt_resource(api_v3_key: str, resource: dict) -> dict:
    raw = base64.b64decode(resource["ciphertext"])
    aes = AESGCM(api_v3_key.encode())
    associated = resource.get("associated_data") or ""
    plain = aes.decrypt(resource["nonce"].encode(), raw, associated.encode() if associated else None)
    return json.loads(plain.decode())


def amount_fen(amount_yuan: Decimal) -> int:
    return int((Decimal(amount_yuan) * 100).quantize(Decimal("1")))


def build_body(config: dict, *, order_no: str, description: str, amount_yuan: Decimal, openid: str | None) -> dict:
    body = {
        "appid": config["app_id"],
        "mchid": config["mch_id"],
        "description": description[:127],
        "out_trade_no": order_no,
        "notify_url": config["notify_url"],
        "amount": {"total": amount_fen(amount_yuan), "currency": "CNY"},
    }
    if openid is not None:
        if not openid.strip():
            raise WechatPayError("公众号支付需要付款人标识")
        body["payer"] = {"openid": openid}
    return body


async def place_order(*, order_no: str, description: str, amount_yuan: Decimal, trade_type: str, openid: str | None = None, transport=None) -> dict:
    config = read_config()
    if config is None:
        raise WechatPayError("微信支付未配置", "WECHAT_PAY_NOT_CONFIGURED")
    path = "/v3/pay/transactions/jsapi" if trade_type == "jsapi" else "/v3/pay/transactions/native"
    payload = build_body(config, order_no=order_no, description=description, amount_yuan=amount_yuan, openid=openid if trade_type == "jsapi" else None)
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    headers = {"Authorization": authorization_header(config, "POST", path, body), "Content-Type": "application/json", "Accept": "application/json"}
    status, text = await _exchange("POST", path, body, headers, transport)
    if status >= 300:
        raise WechatPayError("微信支付下单失败")
    parsed = json.loads(text)
    if trade_type == "native" and not parsed.get("code_url"):
        raise WechatPayError("微信支付未返回二维码链接")
    if trade_type == "jsapi" and not parsed.get("prepay_id"):
        raise WechatPayError("微信支付未返回预支付单号")
    return parsed


def query_path(mch_id: str, order_no: str) -> str:
    return f"/v3/pay/transactions/out-trade-no/{quote(order_no, safe='')}?mchid={quote(mch_id, safe='')}"


async def query_order(order_no: str, transport=None) -> dict:
    config = read_config()
    if config is None:
        raise WechatPayError("微信支付未配置", "WECHAT_PAY_NOT_CONFIGURED")
    path = query_path(config["mch_id"], order_no)
    headers = {"Authorization": authorization_header(config, "GET", path, ""), "Accept": "application/json"}
    status, text = await _exchange("GET", path, "", headers, transport)
    if status >= 300:
        raise WechatPayError("微信支付查询失败")
    return json.loads(text)


async def refund_order(*, order_no: str, refund_no: str, amount_yuan: Decimal, transport=None) -> dict:
    config = read_config()
    if config is None:
        raise WechatPayError("微信支付未配置", "WECHAT_PAY_NOT_CONFIGURED")
    fen = amount_fen(amount_yuan)
    payload = {"out_trade_no": order_no, "out_refund_no": refund_no, "amount": {"refund": fen, "total": fen, "currency": "CNY"}}
    body = json.dumps(payload, separators=(",", ":"))
    path = "/v3/refund/domestic/refunds"
    headers = {"Authorization": authorization_header(config, "POST", path, body), "Content-Type": "application/json", "Accept": "application/json"}
    status, text = await _exchange("POST", path, body, headers, transport)
    if status >= 300:
        raise WechatPayError("微信支付退款失败")
    return json.loads(text)


async def _exchange(method: str, path: str, body: str, headers: dict, transport) -> tuple[int, str]:
    if transport is not None:
        result = await transport({"method": method, "url": HOST + path, "body": body, "headers": headers})
        return result["status"], result["body"]
    import httpx

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.request(method, HOST + path, content=body or None, headers=headers)
        return response.status_code, response.text
