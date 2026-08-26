"""
会员权益注册表（entitlements registry）— 四项目 19 项要求第 6 项。

唯一事实源：``data/entitlements.json``。后端 ``GET /api/entitlements``、
国内站定价页（构建期同步副本 + 运行期 API 拉取）、支付与客服口径都从
同一份 JSON 读取，禁止各自硬编码权益文案。

加载即强校验（fail-closed）：缺 product/version、缺必需 tier
（free/pro/team/enterprise）或任一 tier 缺六维（quotas/knowledge/
personalization/export/collaboration/service）直接抛 ValueError，
宁可端点 503 也不返回残缺权益表。
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

REGISTRY_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "entitlements.json"

REQUIRED_TIERS = ("free", "pro", "team", "enterprise")
REQUIRED_DIMENSIONS = (
    "quotas",
    "knowledge",
    "personalization",
    "export",
    "collaboration",
    "service",
)


class EntitlementsRegistryError(ValueError):
    """注册表缺失或结构不合法时抛出（fail-closed）。"""


def validate_registry(registry: Dict[str, Any]) -> Dict[str, Any]:
    if not registry.get("product") or not registry.get("version"):
        raise EntitlementsRegistryError("entitlements 注册表缺少 product/version")
    tiers = registry.get("tiers")
    if not isinstance(tiers, dict):
        raise EntitlementsRegistryError("entitlements 注册表缺少 tiers")
    missing = [t for t in REQUIRED_TIERS if t not in tiers]
    if missing:
        raise EntitlementsRegistryError(f"entitlements 注册表缺少必需档位: {', '.join(missing)}")
    for tier_id, tier in tiers.items():
        if not isinstance(tier, dict):
            raise EntitlementsRegistryError(f"档位 {tier_id} 结构非法")
        missing_dims = [d for d in REQUIRED_DIMENSIONS if d not in tier]
        if missing_dims:
            raise EntitlementsRegistryError(
                f"档位 {tier_id} 缺少权益维度: {', '.join(missing_dims)}"
            )
    return registry


@lru_cache(maxsize=1)
def load_registry(path: Path = REGISTRY_PATH) -> Dict[str, Any]:
    """加载并校验注册表（带缓存；测试可用 load_registry.cache_clear() 重置）。"""
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise EntitlementsRegistryError(f"entitlements 注册表不可读: {path}") from exc
    try:
        registry = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise EntitlementsRegistryError(f"entitlements 注册表不是合法 JSON: {exc}") from exc
    return validate_registry(registry)
