"""
RAG source registry — JSON 驱动的语料来源注册表。

语料条目从 ``后端/data/rag_sources.json`` 加载，每条带官方来源 URL、
发布机构、版权说明与核验周期（verify_interval_days），并带文献溯源字段：
作者（authors）、版本（version）、发布日期（published_at）、页码/段落（locator）：

- 政策（policy）90 天
- 标准（standard）365 天
- 价格数据（price）7 天

时效分档按各条目自己的核验周期计算：逾期未核验 → ``stale``，
已用掉超过 80% 周期 → ``review_recommended``，其余 → ``current``。
``corroborated_by`` 记录独立第二来源，支撑多方验证（verification）标记。
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

# 后端/data/rag_sources.json（本文件位于 后端/app/services/ 下两级）
REGISTRY_PATH = Path(__file__).resolve().parents[2] / "data" / "rag_sources.json"

REQUIRED_FIELDS = (
    "source_id",
    "type",
    "lang",
    "title",
    "authors",
    "version",
    "published_at",
    "locator",
    "content",
    "year",
    "last_verified_at",
    "source_url",
    "source_org",
    "license_note",
    "verify_interval_days",
)

VALID_TYPES = ("policy", "standard", "price")

# 接近截止的阈值：已用掉超过 80% 核验周期即建议复核
REVIEW_THRESHOLD_RATIO = 0.8


def freshness_status(
    last_verified_at: str,
    verify_interval_days: int = 365,
    today: Optional[date] = None,
) -> str:
    """按条目核验周期计算时效档位。

    逾期（age > interval）→ stale；超过 80% 周期 → review_recommended；
    其余 → current。日期非法一律按 stale 处理。
    """
    today = today or date.today()
    try:
        verified = date.fromisoformat(str(last_verified_at))
    except ValueError:
        return "stale"
    interval = max(int(verify_interval_days), 1)
    age = max((today - verified).days, 0)
    if age > interval:
        return "stale"
    if age > interval * REVIEW_THRESHOLD_RATIO:
        return "review_recommended"
    return "current"


def verification_status(source: Dict) -> str:
    """多方验证标记：存在独立第二来源即为 verified。"""
    corroborated = source.get("corroborated_by") or []
    return "verified" if corroborated else "single_source"


class SourceRegistry:
    """JSON 注册表驱动的语料来源集合。"""

    def __init__(self, sources: List[Dict], path: Optional[Path] = None) -> None:
        self._sources = list(sources)
        self.path = path
        self._by_id = {s["source_id"]: s for s in self._sources}

    @classmethod
    def from_file(cls, path: Optional[Path] = None) -> "SourceRegistry":
        registry_path = Path(path) if path else REGISTRY_PATH
        payload = json.loads(registry_path.read_text(encoding="utf-8"))
        sources = payload["sources"] if isinstance(payload, dict) else payload
        return cls(sources, path=registry_path)

    @property
    def sources(self) -> List[Dict]:
        return list(self._sources)

    def get(self, source_id: str) -> Optional[Dict]:
        return self._by_id.get(source_id)

    def freshness_of(self, source: Dict, today: Optional[date] = None) -> str:
        return freshness_status(
            source.get("last_verified_at", ""),
            int(source.get("verify_interval_days", 365)),
            today=today,
        )

    def validate(self) -> List[str]:
        """注册表完整性检查，返回问题清单（空列表表示通过）。"""
        problems: List[str] = []
        seen = set()
        for source in self._sources:
            sid = source.get("source_id", "<missing>")
            for field_name in REQUIRED_FIELDS:
                if field_name not in source or source[field_name] in (None, ""):
                    problems.append("%s: missing required field %s" % (sid, field_name))
            if sid in seen:
                problems.append("%s: duplicate source_id" % sid)
            seen.add(sid)
            url = str(source.get("source_url", ""))
            if not (url.startswith("https://") or url.startswith("http://")):
                problems.append("%s: source_url must be an http(s) URL" % sid)
            if source.get("lang") not in ("cn", "en"):
                problems.append("%s: lang must be 'cn' or 'en'" % sid)
            if source.get("type") not in VALID_TYPES:
                problems.append("%s: type must be one of %s" % (sid, VALID_TYPES))
            try:
                date.fromisoformat(str(source.get("last_verified_at", "")))
            except ValueError:
                problems.append("%s: last_verified_at must be ISO date" % sid)
            try:
                date.fromisoformat(str(source.get("published_at", "")))
            except ValueError:
                problems.append("%s: published_at must be ISO date" % sid)
            for ref in source.get("corroborated_by") or []:
                if ref not in self._by_id:
                    problems.append("%s: corroborated_by unknown source %s" % (sid, ref))
                elif ref == sid:
                    problems.append("%s: cannot corroborate itself" % sid)
        langs = {s.get("lang") for s in self._sources}
        for lang in ("cn", "en"):
            if lang not in langs:
                problems.append("registry: no %s sources" % lang)
        return problems
