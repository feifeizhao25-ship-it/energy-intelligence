"""公开服务状态。只返回是否已配置，不返回密钥。"""

import os

from fastapi import APIRouter

from app.config import settings
from app.services.status_heartbeat import heartbeat_level, read_heartbeat
from app.services.wechat_pay_service import WechatPayError, read_config

router = APIRouter()


@router.get("/status")
async def public_status():
    try:
        wechat = read_config() is not None
    except WechatPayError:
        wechat = False
    heartbeat = read_heartbeat()
    level = heartbeat_level(heartbeat)
    notes = {
        "ok": "心跳在两日确认窗口内。",
        "escalate": "心跳超过两日未确认，应升级通知。",
        "missing": "还没有心跳记录。",
    }
    return {
        "api": "ok",
        "payments": {
            "alipay_configured": bool(settings.ALIPAY_APP_ID and settings.ALIPAY_PRIVATE_KEY and settings.ALIPAY_PUBLIC_KEY),
            "wechat_configured": wechat,
        },
        "sms_configured": bool(os.environ.get("ALIYUN_SMS_ACCESS_KEY_ID") and os.environ.get("ALIYUN_SMS_ACCESS_KEY_SECRET") and os.environ.get("ALIYUN_SMS_TEMPLATE_CODE")),
        "domestic_model_configured": bool(settings.DEEPSEEK_API_KEY or os.environ.get("NENGJIAN_DEEPSEEK_API_KEY")),
        "heartbeat": {"level": level, "last_seen": heartbeat.get("lastSeen"), "note": notes[level]},
    }
