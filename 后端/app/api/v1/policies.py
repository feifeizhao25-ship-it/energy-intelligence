"""政策与标准 API — RAG 注册表驱动的政策清单与 KA-070 影响评估。

- ``GET /api/v1/policies``：输出注册表中 type=policy/standard 的条目，
  每条带 title/source_url/source_org/last_verified_at/freshness_status/verification。
- ``GET /api/v1/policies/{source_id}/impact``：调用 KA-070 政策追踪技能
  （services/knowledge-service/app/skills/policy_tracker.py）计算 impact_score，
  >0.7 标 alert；无 LLM 时规则法降级并在 engine/estimated 中如实标注；
  生产环境未配置 LLM 时技能 fail-closed（抛 RuntimeError），本端点映射为 503。
"""

import importlib.util
import logging
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user_id
from app.services.rag_sources import SourceRegistry, verification_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/policies")

# 后端/app/api/v1/policies.py → 项目根（项目-新能源智库/）
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_POLICY_TRACKER_PATH = (
    _PROJECT_ROOT / "services" / "knowledge-service" / "app" / "skills" / "policy_tracker.py"
)

_policy_tracker_module = None


def _get_registry() -> SourceRegistry:
    """每次请求重新加载注册表（JSON 可能更新）；测试可 monkeypatch 本函数。"""
    return SourceRegistry.from_file()


def _load_policy_tracker():
    """与 tests/test_oracle_skills_v3.py 相同的方式按文件路径加载 KA-070。"""
    global _policy_tracker_module
    if _policy_tracker_module is not None:
        return _policy_tracker_module
    if not _POLICY_TRACKER_PATH.is_file():
        raise RuntimeError(f"KA-070 技能文件缺失: {_POLICY_TRACKER_PATH}")
    module_name = "_energy_api_policy_tracker"
    spec = importlib.util.spec_from_file_location(module_name, str(_POLICY_TRACKER_PATH))
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    _policy_tracker_module = module
    return module


def _policy_entry(source: dict, registry: SourceRegistry) -> dict:
    return {
        "source_id": source["source_id"],
        "type": source["type"],
        "lang": source["lang"],
        "title": source["title"],
        "source_url": source["source_url"],
        "source_org": source["source_org"],
        "last_verified_at": source["last_verified_at"],
        "freshness_status": registry.freshness_of(source),
        "verification": verification_status(source),
    }


@router.get("")
async def list_policies(
    lang: Optional[str] = Query(default=None, description="按语料语言过滤：cn | en"),
    user_id: str = Depends(get_current_user_id),
):
    """政策/标准条目清单（鉴权）。"""
    registry = _get_registry()
    entries = [
        _policy_entry(source, registry)
        for source in registry.sources
        if source.get("type") in ("policy", "standard")
        and (lang is None or source.get("lang") == lang)
    ]
    return {"data": entries, "meta": {"total": len(entries)}}


@router.get("/{source_id}/impact")
async def policy_impact(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """KA-070 政策影响评估：impact_score > 0.7 → alert=true。"""
    registry = _get_registry()
    source = registry.get(source_id)
    if source is None or source.get("type") not in ("policy", "standard"):
        raise HTTPException(status_code=404, detail="Policy source not found")

    try:
        module = _load_policy_tracker()
        skill = module.PolicyTrackerSkill()
        text = "{}\n{}".format(source.get("title", ""), source.get("content", ""))
        result = await skill.execute(
            {
                "policy_text": text,
                "metadata": {
                    "title": source.get("title"),
                    "effective_date": source.get("effective_date"),
                },
                "market": "cn" if source.get("lang") == "cn" else "global",
            }
        )
    except RuntimeError as exc:
        # KA-070 生产 fail-closed（未配置 LLM）或技能文件缺失
        logger.warning("KA-070 不可用: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))

    return {
        "data": {
            "source_id": source_id,
            "title": source.get("title"),
            "impact_score": result.get("impact_score"),
            "alert": bool(result.get("alert")),
            "engine": result.get("engine"),
            "estimated": bool(result.get("estimated")),
            "freshness_status": registry.freshness_of(source),
            "assessment": result,
        }
    }
