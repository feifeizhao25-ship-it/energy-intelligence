"""FM-001 平准化度电成本（LCOE）计算技能（恢复重建版）。

纯财务计算，无外部依赖，任何环境都返回真实计算结果。
核心公式复用 后端/app/utils/financial_utils.py 的 calc_lcoe：
    LCOE = (CAPEX + Σ OPEX_t/(1+r)^t) / Σ E_t/(1+r)^t
    E_t = E_0 × (1 - degradation)^t
"""

from __future__ import annotations

from typing import Any, Dict

try:
    from app.utils.financial_utils import calc_lcoe
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.utils.financial_utils import calc_lcoe

HOURS_PER_YEAR = 8760.0


class LcoeSkill:
    """FM-001 LCOE 计算。"""

    skill_id = "FM-001"
    aliases = ["F-040"]  # 运营规格首发编号：F-040 IRR/LCOE 财务建模
    name = "平准化度电成本计算"
    description = (
        "按 NREL ATB 折现公式计算 LCOE：分子为 CAPEX 与折现 OPEX 之和，"
        "分母为考虑逐年衰减的折现发电量之和。"
    )
    category = "FM"
    references = [
        "NREL Annual Technology Baseline (ATB) LCOE 公式",
        "IEC 61724-1:2021 光伏系统性能（发电量衰减假设）",
        "国家发改委《光伏发电项目经济性评价规范》折现法",
    ]

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        capex = params.get("capex")
        opex_annual = params.get("opex_annual")
        if capex is None or opex_annual is None:
            raise ValueError("FM-001 需要 capex 与 opex_annual 参数")
        capex = float(capex)
        opex_annual = float(opex_annual)

        annual_generation = params.get("annual_generation_kwh")
        if annual_generation is not None:
            annual_generation = float(annual_generation)
        else:
            capacity_mw = float(params.get("capacity_mw", 0.0))
            capacity_factor = float(params.get("capacity_factor", 0.0))
            if capacity_mw <= 0 or capacity_factor <= 0:
                raise ValueError(
                    "FM-001 需要 annual_generation_kwh，"
                    "或 capacity_mw + capacity_factor 推算发电量"
                )
            annual_generation = capacity_mw * 1000.0 * HOURS_PER_YEAR * capacity_factor

        if annual_generation <= 0:
            raise ValueError("FM-001 年发电量必须为正数")

        discount_rate = float(params.get("discount_rate", 0.08))
        project_life = int(params.get("project_life", 25))
        degradation_rate = float(params.get("degradation_rate", 0.005))

        lcoe = calc_lcoe(
            capex=capex,
            opex_annual=opex_annual,
            annual_generation_kwh=annual_generation,
            discount_rate=discount_rate,
            project_life=project_life,
            degradation_rate=degradation_rate,
        )

        return {
            "skill_id": self.skill_id,
            "lcoe": lcoe,
            "currency_per_kwh": lcoe,
            "capex": capex,
            "opex_annual": opex_annual,
            "annual_generation_kwh": annual_generation,
            "discount_rate": discount_rate,
            "project_life": project_life,
            "degradation_rate": degradation_rate,
            "engine": "financial_utils.calc_lcoe",
            "references": list(self.references),
        }
