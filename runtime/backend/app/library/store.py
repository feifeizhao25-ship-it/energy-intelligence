"""读取资料库条目 + 来源核对状态，套上展示规则。

两个版本各有一份条目和状态：edition = "cn"（中文，国内版）/ "global"（英文，国际版）。
数据目录：环境变量 ENERGY_LIBRARY_DIR（默认 var/library）。条目文件：目录里的 reference_entries_<edition>.json
（审核人用 review_cli 写回）；没有就用包内 data/entries_<edition>_v1.json。
"""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from typing import Optional

from ..library_live import decide

HERE = Path(__file__).parent
EDITIONS = ("cn", "global")
LANG = {"cn": "zh", "global": "en"}
TTL_DEFAULT = 90
TTL_BY_CATEGORY = {"统计数据": 45, "Market data": 45}  # 数字会被后续月度/季度统计覆盖，核对得更勤


def edition_of(market: Optional[str]) -> str:
    return "global" if (market or "cn") == "global" else "cn"


def data_dir() -> Path:
    return Path(os.environ.get("ENERGY_LIBRARY_DIR") or "var/library")


def bundled_path(edition: str) -> Path:
    return HERE / "data" / f"entries_{edition}_v1.json"


def entries_path(edition: str) -> Path:
    p = data_dir() / f"reference_entries_{edition}.json"
    return p if p.exists() else bundled_path(edition)


def state_path(edition: str) -> Path:
    return data_dir() / f"library_state_{edition}.json"


def load_document(edition: str) -> dict:
    return json.loads(entries_path(edition).read_text("utf-8"))


def load_state(edition: str) -> dict:
    p = state_path(edition)
    return json.loads(p.read_text("utf-8")) if p.exists() else {"entries": {}, "candidates": []}


def show_pending() -> bool:
    return os.environ.get("ENERGY_LIBRARY_SHOW_PENDING", "0").lower() in ("1", "true", "yes", "on")


def annotated(edition: str, today: date, *, document: Optional[dict] = None, state: Optional[dict] = None, preview: Optional[bool] = None,
              include_hidden: bool = False) -> list[dict]:
    """每条 = 条目内容 + display（展示规则的结论）。默认只返回对用户可见的。语言由版本决定，不会混用。"""
    doc = document if document is not None else load_document(edition)
    st = state if state is not None else load_state(edition)
    preview = show_pending() if preview is None else preview
    out = []
    for e in doc["entries"]:
        d = decide(e, st.get("entries", {}).get(e["id"]), today, LANG[edition], ttl_default=TTL_DEFAULT, ttl_by_category=TTL_BY_CATEGORY, preview=preview)
        if d.visible or include_hidden:
            out.append({**e, "display": d.to_dict()})
    return out


def find(edition: str, entry_id: str, today: date, **kw) -> Optional[dict]:
    """详情页：已废止 / 核对中的条目只有直接打开才看得到（带横幅）；待审核的只在预览开关打开时可见。"""
    preview = kw.pop("preview", None)
    preview = show_pending() if preview is None else preview
    for e in annotated(edition, today, include_hidden=True, preview=preview, **kw):
        if e["id"] == entry_id:
            if e["display"]["state"] == "pending" and not preview:
                return None
            return e
    return None
