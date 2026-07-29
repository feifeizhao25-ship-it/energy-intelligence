"""OM-001 组件清洗排程技能（恢复重建版）。

真实计算逻辑（纯参数化计算，无外部依赖）：
1. 沙尘等级 → 积灰速率（%/天）：low 0.1 / medium 0.25 / high 0.5
   （IEA PVPS 干旱地区典型积灰损失区间 0.1–0.5 %/天），可用
   soiling_rate_pct_per_day 显式覆盖；
2. 最优清洗间隔复用 后端/app/utils/financial_utils.py 的
   calc_optimal_cleaning_interval：N = sqrt(2·C / (R·s/100))，
   C=单次清洗成本，R=日均发电收益，s=积灰速率 %/天；
3. 近 30 天降雨 ≥ 20mm 视为一次自然清洗：当前累积损失按 30% 计（启发式）；
4. 距上次清洗天数 ≈ 有效累积损失 / 积灰速率；
   建议日期 = as_of + max(0, N − 已积灰天数)，达到/超过间隔则建议立即清洗；
5. 预计挽回发电收益 = 日均收益 × 有效损失% × N（避免当前累积损失在
   下一间隔内持续造成损失），并给出扣除清洗成本后的净收益；
6. 置信度：显式积灰速率 0.90 / 沙尘等级映射 0.75，自然清洗事件 −0.15，
   成本/收益用内置假设 −0.10，区间 [0.40, 0.95]。

清洗成本与日均收益属运营假设：生产环境必须显式提供（fail-closed），
开发环境用内置值并标注 estimated。
"""

from __future__ import annotations

import datetime
import math
import os
from typing import Any, Dict, Optional

try:
    from app.utils.financial_utils import calc_optimal_cleaning_interval
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.utils.financial_utils import calc_optimal_cleaning_interval

# 沙尘等级 → 积灰速率（%/天），IEA PVPS 干旱地区典型区间
SOILING_RATE_BY_DUST_LEVEL: Dict[str, float] = {
    "low": 0.1,
    "medium": 0.25,
    "high": 0.5,
}

RAIN_NATURAL_CLEANING_MM = 20.0  # 视为自然清洗的近 30 天降雨阈值
RAIN_RESIDUAL_LOSS_FACTOR = 0.3  # 自然清洗后残余损失比例（启发式）

DEV_CLEANING_COST = 450.0  # 开发环境内置假设（生产禁止）
DEV_DAILY_REVENUE = 200.0


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


def compute_schedule(
    soiling_rate: float,
    pr_loss_pct: float,
    rainfall_30d_mm: float,
    cleaning_cost: float,
    daily_revenue: float,
    as_of: datetime.date,
) -> Dict[str, Any]:
    """纯函数：由积灰参数推出最优间隔、建议日期与挽回收益。"""
    rain_event = rainfall_30d_mm >= RAIN_NATURAL_CLEANING_MM
    effective_loss = pr_loss_pct * (RAIN_RESIDUAL_LOSS_FACTOR if rain_event else 1.0)

    optimal_interval = calc_optimal_cleaning_interval(
        cleaning_cost, daily_revenue, soiling_rate
    )
    days_since_clean = effective_loss / soiling_rate if soiling_rate > 0 else 0.0
    days_until = max(0.0, optimal_interval - days_since_clean)
    clean_now = days_since_clean >= optimal_interval
    next_date = as_of + datetime.timedelta(days=int(math.ceil(days_until)))

    gross_recovered = daily_revenue * effective_loss / 100.0 * optimal_interval
    net_benefit = gross_recovered - cleaning_cost

    return {
        "optimal_interval_days": optimal_interval,
        "effective_loss_pct": effective_loss,
        "rain_natural_cleaning": rain_event,
        "days_since_clean": days_since_clean,
        "clean_now": clean_now,
        "next_cleaning_date": next_date.isoformat(),
        "gross_recovered_revenue": gross_recovered,
        "net_benefit": net_benefit,
    }


class CleaningScheduleSkill:
    """OM-001 组件清洗排程。"""

    skill_id = "OM-001"
    name = "组件清洗排程"
    description = (
        "按沙尘等级/近 30 天降雨/当前 PR 衰减推算最优清洗间隔与下次清洗建议日期，"
        "估算挽回发电收益并给出置信度；清洗成本与日均收益假设在生产环境"
        "必须显式传入，否则 fail-closed。"
    )
    category = "OM"
    references = [
        "IEA PVPS Task 13: soiling losses in arid regions 0.1–0.5 %/day",
        "financial_utils.calc_optimal_cleaning_interval: N=sqrt(2C/(R·s/100)) 最优间隔模型",
        "IEC 61724-1:2021 光伏系统性能监测（PR 衰减与积灰损失）",
        "NREL PV Soiling Studies: 强降雨（≥20mm）近似一次自然清洗（启发式）",
    ]

    def validate(self, params: Dict[str, Any]) -> bool:
        loss = params.get("pr_loss_pct")
        return loss is not None and float(loss) >= 0

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        loss_raw = params.get("pr_loss_pct")
        if loss_raw is None:
            raise ValueError("OM-001 需要 pr_loss_pct 参数（当前 PR 衰减 %）")
        pr_loss_pct = float(loss_raw)
        if pr_loss_pct < 0:
            raise ValueError("OM-001 pr_loss_pct 不能为负")

        market = params.get("market", "cn")
        dust_level = params.get("dust_level", "medium")
        rate_override = params.get("soiling_rate_pct_per_day")
        if rate_override is not None:
            soiling_rate = float(rate_override)
            if soiling_rate <= 0:
                raise ValueError("OM-001 积灰速率必须为正数")
        else:
            if dust_level not in SOILING_RATE_BY_DUST_LEVEL:
                raise ValueError(
                    f"OM-001 未知沙尘等级 {dust_level!r}，"
                    f"可选: {sorted(SOILING_RATE_BY_DUST_LEVEL)}"
                )
            soiling_rate = SOILING_RATE_BY_DUST_LEVEL[dust_level]

        rainfall_30d_mm = float(params.get("rainfall_30d_mm", 0.0))

        estimated = False
        cleaning_cost = params.get("cleaning_cost")
        daily_revenue = params.get("daily_revenue")
        if cleaning_cost is None or daily_revenue is None:
            if _is_production():
                raise RuntimeError(
                    "OM-001 生产环境必须显式提供 cleaning_cost 与 daily_revenue，"
                    "拒绝使用内置运营假设冒充真实结果"
                )
            cleaning_cost = (
                DEV_CLEANING_COST if cleaning_cost is None else cleaning_cost
            )
            daily_revenue = (
                DEV_DAILY_REVENUE if daily_revenue is None else daily_revenue
            )
            estimated = True
        cleaning_cost = float(cleaning_cost)
        daily_revenue = float(daily_revenue)

        as_of_raw: Optional[str] = params.get("as_of_date")
        if as_of_raw:
            as_of = datetime.date.fromisoformat(as_of_raw)
        else:
            as_of = datetime.date.today()

        schedule = compute_schedule(
            soiling_rate, pr_loss_pct, rainfall_30d_mm,
            cleaning_cost, daily_revenue, as_of,
        )

        # 置信度模型（确定性规则，见模块 docstring）
        confidence = 0.90 if rate_override is not None else 0.75
        if schedule["rain_natural_cleaning"]:
            confidence -= 0.15
        if estimated:
            confidence -= 0.10
        confidence = min(0.95, max(0.40, confidence))

        inputs_block = {
            "soiling_rate_pct_per_day": soiling_rate,
            "dust_level": dust_level,
            "pr_loss_pct": pr_loss_pct,
            "rainfall_30d_mm": rainfall_30d_mm,
        }
        schedule_block = {
            "optimal_interval_days": schedule["optimal_interval_days"],
            "next_cleaning_date": schedule["next_cleaning_date"],
            "clean_now": schedule["clean_now"],
            "days_since_clean_est": round(schedule["days_since_clean"], 2),
            "effective_loss_pct": round(schedule["effective_loss_pct"], 4),
            "rain_natural_cleaning": schedule["rain_natural_cleaning"],
            "recovered_revenue_gross": round(
                schedule["gross_recovered_revenue"], 2
            ),
            "net_benefit_after_cost": round(schedule["net_benefit"], 2),
            "confidence": round(confidence, 2),
        }

        common = {
            "skill_id": self.skill_id,
            "market": market,
            "engine": "financial_utils.calc_optimal_cleaning_interval",
            "estimated": estimated,
            "references": list(self.references),
        }

        if market == "global":
            result = {
                "inputs": inputs_block,
                "cleaning_schedule": schedule_block,
            }
            if estimated:
                result["warning"] = (
                    "Cost/revenue are built-in assumptions — provide explicit "
                    "cleaning_cost and daily_revenue for production use"
                )
        else:
            result = {
                "输入参数": {
                    "积灰速率_百分比每天": inputs_block["soiling_rate_pct_per_day"],
                    "沙尘等级": inputs_block["dust_level"],
                    "当前PR衰减_pct": inputs_block["pr_loss_pct"],
                    "近30天降雨_mm": inputs_block["rainfall_30d_mm"],
                },
                "清洗排程": {
                    "最优清洗间隔_天": schedule_block["optimal_interval_days"],
                    "下次清洗建议日期": schedule_block["next_cleaning_date"],
                    "建议立即清洗": schedule_block["clean_now"],
                    "估计已积灰天数": schedule_block["days_since_clean_est"],
                    "有效累积损失_pct": schedule_block["effective_loss_pct"],
                    "近期自然清洗": schedule_block["rain_natural_cleaning"],
                    "预计挽回发电收益": schedule_block["recovered_revenue_gross"],
                    "扣除成本净收益": schedule_block["net_benefit_after_cost"],
                    "置信度": schedule_block["confidence"],
                },
            }
            if estimated:
                result["warning"] = (
                    "成本/收益为内置假设——生产环境请显式提供 "
                    "cleaning_cost 与 daily_revenue"
                )

        result.update(common)
        return result
