"""A 自动、B 人工发布包、C 永不。开关默认关。企业微信不可用时不发布。"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from ops.killswitch import is_killed
from ops.switches import SWITCHES

SHANGHAI = ZoneInfo("Asia/Shanghai")
AIGC_LABEL = "本内容由人工智能生成合成。"
TIER_B_CHANNELS = ("公众号", "视频号", "抖音", "知乎", "小红书", "B站", "行业媒体")


def within_publish_window(now: datetime) -> bool:
    local = now.astimezone(SHANGHAI)
    minutes = local.hour * 60 + local.minute
    return 8 * 60 <= minutes <= 21 * 60 + 30


def publish_a(now: datetime, wecom_up: bool, content_sha256: str, approved: bool) -> dict:
    if is_killed() or not SWITCHES["publish_a"] or not wecom_up or not approved:
        return {"published": False, "tier": "A"}
    if not within_publish_window(now):
        return {"published": False, "tier": "A", "reason": "outside 08:00-21:30"}
    return {"published": True, "tier": "A", "content_sha256": content_sha256, "label": AIGC_LABEL}


def build_tier_b_pack(title: str, body: str, content_sha256: str) -> dict:
    if is_killed() or not SWITCHES["publish_b"]:
        return {"ready": False, "tier": "B"}
    return {
        "ready": True,
        "tier": "B",
        "title": title,
        "body": body + "\n\n" + AIGC_LABEL,
        "channels": list(TIER_B_CHANNELS),
        "content_sha256": content_sha256,
        "posted": False,
        "note": "人工在各平台发布后，回到此页填写已发布和 URL。",
    }


def mark_published(pack: dict, url: str) -> dict:
    if not pack.get("ready") or not url:
        raise ValueError("pack is not ready or url missing")
    updated = dict(pack)
    updated["posted"] = True
    updated["url"] = url
    updated["status"] = "已发布"
    return updated


def publish_c() -> dict:
    return {"published": False, "tier": "C", "reason": "tier C never publishes"}
