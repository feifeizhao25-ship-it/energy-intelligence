"""用户级提醒规则 API（落库：app.models.alert.AlertRule）。

POST 创建规则时立即对接 KA-070 政策影响评估：impact_score > threshold
（默认 0.7，与 KA-070 ALERT_THRESHOLD 一致）即触发，写入 last_triggered_at。
KA-070 在生产 fail-closed（未配置 LLM）时评估结果为 None，不阻断规则创建。
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.policies import _get_registry, _load_policy_tracker
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.alert import AlertRule

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/alerts")

DEFAULT_THRESHOLD = 0.7


class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    source_id: str = Field(..., min_length=1, description="RAG 注册表政策/标准条目 ID")
    threshold: float = Field(DEFAULT_THRESHOLD, ge=0.0, le=1.0)


def _rule_payload(rule: AlertRule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "source_id": rule.source_id,
        "threshold": rule.threshold,
        "enabled": rule.enabled,
        "last_impact_score": rule.last_impact_score,
        "last_evaluated_at": (
            rule.last_evaluated_at.isoformat() if rule.last_evaluated_at else None
        ),
        "last_triggered_at": (
            rule.last_triggered_at.isoformat() if rule.last_triggered_at else None
        ),
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


async def _evaluate_impact(source: dict) -> Optional[dict]:
    """调 KA-070 计算 impact_score；技能不可用（生产 fail-closed）时返回 None。"""
    try:
        module = _load_policy_tracker()
        skill = module.PolicyTrackerSkill()
        text = "{}\n{}".format(source.get("title", ""), source.get("content", ""))
        result = await skill.execute(
            {
                "policy_text": text,
                "metadata": {"title": source.get("title")},
                "market": "cn" if source.get("lang") == "cn" else "global",
            }
        )
        return {
            "impact_score": result.get("impact_score"),
            "engine": result.get("engine"),
            "estimated": bool(result.get("estimated")),
        }
    except Exception as exc:
        logger.warning("alerts: KA-070 评估不可用（%s），跳过本次评估", exc)
        return None


@router.get("")
async def list_alert_rules(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """当前用户的提醒规则列表。"""
    result = await db.execute(
        select(AlertRule).where(AlertRule.user_id == user_id).order_by(AlertRule.created_at)
    )
    rules = result.scalars().all()
    return {"data": [_rule_payload(rule) for rule in rules]}


@router.post("", status_code=201)
async def create_alert_rule(
    req: AlertRuleCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """创建提醒规则并立即评估一次政策影响（>threshold 触发）。"""
    registry = _get_registry()
    source = registry.get(req.source_id)
    if source is None or source.get("type") not in ("policy", "standard"):
        raise HTTPException(status_code=404, detail="Policy source not found")

    rule = AlertRule(
        id=str(uuid4()),
        user_id=user_id,
        name=req.name,
        source_id=req.source_id,
        threshold=req.threshold,
        enabled=True,
    )

    evaluation = await _evaluate_impact(source)
    triggered = False
    now = datetime.now(timezone.utc)
    if evaluation is not None:
        score = float(evaluation.get("impact_score") or 0.0)
        rule.last_impact_score = score
        rule.last_evaluated_at = now
        triggered = score > req.threshold
        if triggered:
            rule.last_triggered_at = now

    db.add(rule)
    await db.commit()

    return {
        "data": {
            "rule": _rule_payload(rule),
            "evaluation": evaluation,
            "triggered": triggered,
            "message": "提醒已触发：政策影响评分超过阈值" if triggered else "规则已创建",
        }
    }


@router.delete("/{rule_id}")
async def delete_alert_rule(
    rule_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """删除自己的提醒规则；不存在或不属于当前用户返回 404。"""
    result = await db.execute(
        select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == user_id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    await db.delete(rule)
    await db.commit()
    return {"data": {"id": rule_id, "deleted": True}}
