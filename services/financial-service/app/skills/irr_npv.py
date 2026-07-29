"""FM-002 IRR / NPV / 投资回收期计算技能（恢复重建版）。

纯财务计算，无外部依赖，任何环境都返回真实计算结果。
IRR / NPV 复用 后端/app/utils/financial_utils.py 的 calc_irr / calc_npv；
回收期（静态与动态）在本文件内按累计现金流线性插值计算。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from app.utils.financial_utils import build_solar_cashflows, calc_irr, calc_npv
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.utils.financial_utils import build_solar_cashflows, calc_irr, calc_npv


def _payback_years(cashflows: List[float], rate: float = 0.0) -> Optional[float]:
    """累计现金流（可选折现）首次转正的年份，年内线性插值；未回收返回 None。"""
    cumulative = 0.0
    divisor = 1.0
    for t, cf in enumerate(cashflows):
        if t > 0:
            divisor *= 1.0 + rate
        discounted = cf / divisor
        previous = cumulative
        cumulative += discounted
        if t > 0 and cumulative >= 0 and discounted > 0:
            return round(t - 1 + (-previous / discounted), 2)
    return None


class IrrNpvSkill:
    """FM-002 IRR / NPV / 回收期计算。"""

    skill_id = "FM-002"
    aliases = ["F-040"]  # 运营规格首发编号：F-040 IRR/LCOE 财务建模（与 FM-001 共享，先注册者保留）
    name = "内部收益率与净现值计算"
    description = (
        "基于年度现金流计算 IRR（Newton-Raphson）、NPV、静态与动态投资回收期；"
        "现金流可直接给出，或由光伏项目参数经 build_solar_cashflows 生成。"
    )
    category = "FM"
    references = [
        "NREL ATB 财务假设（折现率、项目周期）",
        "《建设项目经济评价方法与参数（第三版）》 IRR/NPV/回收期定义",
        "Brealey-Myers-Allen, Principles of Corporate Finance（折现现金流）",
    ]

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        cashflows = params.get("cashflows")
        engine = "financial_utils.calc_irr/calc_npv"
        if cashflows is None:
            cashflows = self._cashflows_from_project(params)
            engine = "financial_utils.build_solar_cashflows"
        cashflows = [float(cf) for cf in cashflows]
        if len(cashflows) < 2:
            raise ValueError("FM-002 至少需要两期现金流")

        discount_rate = float(params.get("discount_rate", 0.08))

        return {
            "skill_id": self.skill_id,
            "irr_pct": calc_irr(cashflows),
            "npv": calc_npv(discount_rate, cashflows),
            "payback_years": _payback_years(cashflows),
            "discounted_payback_years": _payback_years(cashflows, discount_rate),
            "discount_rate": discount_rate,
            "cashflows": cashflows,
            "engine": engine,
            "references": list(self.references),
        }

    def _cashflows_from_project(self, params: Dict[str, Any]) -> List[float]:
        """由光伏项目参数生成股权现金流（复用 build_solar_cashflows）。"""
        capacity_mw = params.get("capacity_mw")
        if capacity_mw is None:
            raise ValueError("FM-002 需要 cashflows，或 capacity_mw 等项目参数")
        return build_solar_cashflows(
            capacity_mw=float(capacity_mw),
            capex_per_w=float(params.get("capex_per_w", 1.0)),
            opex_per_kw_yr=float(params.get("opex_per_kw_yr", 15.0)),
            electricity_price=float(params.get("electricity_price", 0.08)),
            itc_rate=float(params.get("itc_rate", 0.0)),
            capacity_factor=float(params.get("capacity_factor", 0.2)),
            degradation_rate=float(params.get("degradation_rate", 0.005)),
            debt_ratio=float(params.get("debt_ratio", 0.0)),
            interest_rate=float(params.get("interest_rate", 0.05)),
            tax_rate=float(params.get("tax_rate", 0.25)),
            project_life=int(params.get("project_life", 25)),
        )
