"""
Skill 参数适配器 v2 — 统一归一化各 Skill 的入参。

恢复说明：原文件只剩返回字典尾部残片。这里按残片语义重建完整适配器：
坐标校验、缺省数据源/年份范围、market 字段透传（cn 默认，global 不改写）。
"""

from __future__ import annotations

from typing import Any, Dict


def adapt_params(skill_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """归一化 Skill 调用参数。

    - latitude/longitude 若提供则做范围校验
    - data_source / year_range / market 提供默认值
    - market 原样透传（国内 "cn" 与国际 "global" 不互相改写）
    """
    params = dict(params or {})

    lat = params.get("latitude")
    lng = params.get("longitude")
    if lat is not None and not -90 <= float(lat) <= 90:
        raise ValueError(f"latitude 超出范围: {lat}")
    if lng is not None and not -180 <= float(lng) <= 180:
        raise ValueError(f"longitude 超出范围: {lng}")

    return {
        **params,
        "skill_id": skill_id,
        "data_source": params.get("data_source", "CMA"),
        "year_range": params.get("year_range", "2020-2024"),
        "market": params.get("market", "cn"),
    }
