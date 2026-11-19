"""国内版注册来源题「从哪知道我们」（App 注册与短信首次登录）。

- 可跳过的单选，九个固定选项，只认枚举代码；不认识的值（含自由文本）直接丢掉。
- 开关 ENERGY_CN_SIGNUP_SOURCE_ENABLED，默认关闭；只对国内市场（market=cn）的新账号记录。
- 记录失败不影响注册 / 登录。
"""
from __future__ import annotations

import logging
import os
import uuid
from collections import Counter
from typing import Any, Iterable, Mapping

logger = logging.getLogger(__name__)

ENV_FLAG = "ENERGY_CN_SIGNUP_SOURCE_ENABLED"
QUESTION = "从哪知道我们"

SIGNUP_SOURCES: tuple[tuple[str, str], ...] = (
    ("xiaohongshu", "小红书"),
    ("douyin", "抖音"),
    ("wechat_channels", "视频号"),
    ("wechat_oa", "公众号"),
    ("zhihu", "知乎"),
    ("bilibili", "哔哩哔哩"),
    ("search", "搜索"),
    ("friend", "朋友推荐"),
    ("other", "其他"),
)
_CODES = frozenset(code for code, _ in SIGNUP_SOURCES)
_TRUE = {"1", "true", "yes", "on"}


def signup_source_enabled(env: Mapping[str, str] | None = None) -> bool:
    env = env if env is not None else os.environ
    return str(env.get(ENV_FLAG, "")).strip().lower() in _TRUE


def normalize(raw: Any) -> str:
    """合法代码原样返回，其余（大小写不符、中文文字、自由文本、非字符串）返回空串。"""
    return raw if isinstance(raw, str) and raw in _CODES else ""


def public_options(env: Mapping[str, str] | None = None) -> dict:
    if not signup_source_enabled(env):
        return {"enabled": False, "question": QUESTION, "options": [], "skippable": True}
    return {
        "enabled": True,
        "question": QUESTION,
        "options": [{"code": code, "label": label} for code, label in SIGNUP_SOURCES],
        "skippable": True,
    }


def count_by_source(rows: Iterable[Mapping[str, Any]]) -> dict[str, int]:
    """只输出 代码 -> 次数，按固定顺序；没有任何身份字段。"""
    counts: Counter[str] = Counter()
    for row in rows:
        code = normalize(row.get("source"))
        if code:
            counts[code] += 1
    return {code: counts[code] for code, _ in SIGNUP_SOURCES if counts[code]}


async def record_signup_source(db, user_id: str, raw: Any, market: str | None, env: Mapping[str, str] | None = None) -> bool:
    """新账号建好后调用。开关关、非国内市场、没答或不合法都不写；写失败只记日志。"""
    source = normalize(raw)
    if not source or not user_id or (market or "cn") != "cn" or not signup_source_enabled(env):
        return False
    from app.models.signup_source import SignupSourceEvent

    try:
        async with db.begin_nested():
            db.add(SignupSourceEvent(id=str(uuid.uuid4()), user_id=user_id, source=source))
        return True
    except Exception as exc:  # noqa: BLE001 — 来源只是统计，失败不能挡住注册
        logger.warning("signup source not recorded: %s", type(exc).__name__)
        return False
