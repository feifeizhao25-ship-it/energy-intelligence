"""从已审核政策文本抽取受影响的测算参数，并与项目参数对照。

不抓取、不入库。只读调用方已经拿到的正文。
"""
from __future__ import annotations

import re

_PERIOD = re.compile(r"(峰|谷|平|尖峰).{0,8}(\d{1,2}:\d{2})")
_PRICE = re.compile(r"(\d+(?:\.\d+)?)\s*元\s*/\s*(?:千瓦时|kWh|度)")
_TERM = re.compile(r"(\d+)\s*年")
_CAPACITY = re.compile(r"(\d+(?:\.\d+)?)\s*(?:千瓦|kW|兆瓦|MW)")


def extract_parameters(text: str) -> dict:
    return {
        "periods": _PERIOD.findall(text or ""),
        "prices": [float(item) for item in _PRICE.findall(text or "")],
        "terms_years": [int(item) for item in _TERM.findall(text or "")],
        "capacity": _CAPACITY.findall(text or ""),
    }


def affected_keys(extracted: dict) -> list[str]:
    keys = []
    if extracted["periods"]:
        keys.append("时段")
    if extracted["prices"]:
        keys.append("价格")
    if extracted["terms_years"]:
        keys.append("期限")
    if extracted["capacity"]:
        keys.append("容量")
    return keys


def project_diff(before: dict, after: dict) -> dict:
    """同一引擎两次测算的数值差。只列变化了的键。"""
    changed = {}
    for key in sorted(set(before) | set(after)):
        old = before.get(key)
        new = after.get(key)
        if old != new:
            changed[key] = {"before": old, "after": new}
    return {
        "changed": changed,
        "needs_recalc": bool(changed),
        "label": "测算值已变化" if changed else "测算值未变化",
    }
