"""GS-050（F-050）发电量模拟技能（恢复重建版）。

纯参数化计算，无外部依赖：

1. 光伏（project_type=solar_pv，默认）：GHI × PR 模型
   月发电量 MWh = 装机 MW × 月总辐射 GHI_m (kWh/m²) × PR
   - 优先使用调用方提供的逐月 GHI（ghi_monthly_kwh_m2，12 个值）；
   - 仅给年总辐射（ghi_annual_kwh_m2）时，按「逐日均匀分布」拆分：
     GHI_m = 年 GHI × 当月天数 / 365——这是简化假设而非实测数据，
     生产环境 fail-closed（要求逐月数据），开发环境标注 estimated。
   - PR（performance_ratio）缺省 0.82 属内置假设：
     生产环境必须显式提供（fail-closed），开发环境用内置值并标注 estimated。
   若提供 system_loss（系统损耗率 0-1），则 PR = 1 − system_loss。

2. 风电（project_type=wind）：风速 → 简化功率曲线
   P(v) = 0                                  v < cut_in 或 v > cut_out
   P(v) = 额定功率 × (v − cut_in)/(rated − cut_in)   cut_in ≤ v < rated
   P(v) = 额定功率                            rated ≤ v ≤ cut_out
   月发电量 MWh = P(月均风速) × 当月小时数；仅给年均风速时各月同用该均值。
   切入/额定/切出风速默认 3/12/25 m/s（IEC 61400-12-1 典型机组区间，
   属机组固有参数，不算合成数据假设）。

容量系数 = 年发电量 / (装机 MW × 8760 h)。
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

HOURS_PER_YEAR = 8760.0
DAYS_IN_MONTH: List[int] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

# IEC 61724-1 典型 PR 中值（开发环境内置假设，生产禁止缺省）
DEV_DEFAULT_PR = 0.82

# 风电机组默认功率曲线参数（m/s）
DEFAULT_CUT_IN = 3.0
DEFAULT_RATED_SPEED = 12.0
DEFAULT_CUT_OUT = 25.0

_SOLAR_TYPES = {"solar_pv", "solar", "pv"}
_WIND_TYPES = {"wind", "wind_onshore", "wind_offshore"}


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


def wind_power_mw(
    wind_speed_ms: float,
    rated_power_mw: float,
    cut_in: float = DEFAULT_CUT_IN,
    rated_speed: float = DEFAULT_RATED_SPEED,
    cut_out: float = DEFAULT_CUT_OUT,
) -> float:
    """简化功率曲线：切入以下/切出以上为 0，切入-额定间线性爬坡，额定-切出满发。"""
    if wind_speed_ms < cut_in or wind_speed_ms > cut_out:
        return 0.0
    if wind_speed_ms >= rated_speed:
        return rated_power_mw
    return rated_power_mw * (wind_speed_ms - cut_in) / (rated_speed - cut_in)


class GenerationSimulationSkill:
    """GS-050（F-050）发电量模拟：光伏 GHI×PR / 风电功率曲线。"""

    skill_id = "GS-050"
    aliases = ["F-050"]  # 运营规格首发编号：F-050 发电模拟
    name = "发电量模拟"
    description = (
        "按 GHI×PR 模型（光伏）或风速功率曲线（风电）计算逐月与全年发电量、"
        "容量系数；缺关键参数时生产环境 fail-closed，开发降级结果带 engine/estimated 标注。"
    )
    category = "GS"
    references = [
        "IEC 61724-1:2021 光伏系统性能分类（PR / 系统损耗定义）",
        "IEC 61400-12-1 风电机组功率特性测试（切入/额定/切出功率曲线）",
        "NREL PVWatts 简化发电模型（GHI × PR 近似）",
    ]

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        capacity_mw = params.get("capacity_mw")
        if capacity_mw is None:
            raise ValueError("GS-050 需要 capacity_mw 参数")
        capacity_mw = float(capacity_mw)
        if capacity_mw <= 0:
            raise ValueError("GS-050 capacity_mw 必须为正数")

        project_type = str(params.get("project_type", "solar_pv")).lower()
        if project_type in _WIND_TYPES:
            monthly, engine_notes, estimated = self._simulate_wind(params, capacity_mw)
        elif project_type in _SOLAR_TYPES:
            monthly, engine_notes, estimated = self._simulate_solar(params, capacity_mw)
        else:
            raise ValueError(f"GS-050 不支持的 project_type: {project_type}")

        annual = sum(monthly)
        capacity_factor = annual / (capacity_mw * HOURS_PER_YEAR)

        result: Dict[str, Any] = {
            "skill_id": self.skill_id,
            "project_type": project_type,
            "capacity_mw": capacity_mw,
            "monthly_generation_mwh": [round(v, 3) for v in monthly],
            "annual_generation_mwh": round(annual, 3),
            "capacity_factor": round(capacity_factor, 4),
            "engine": engine_notes,
            "estimated": estimated,
            "references": list(self.references),
        }
        if estimated:
            result["warning"] = (
                "含内置假设的降级结果——非完整实测输入，仅供开发环境演示"
            )
        return result

    # ── 光伏 ──────────────────────────────────────────────────────────────
    def _simulate_solar(self, params: Dict[str, Any], capacity_mw: float):
        estimated = False
        engine = "ghi_pr_model"

        # PR：显式 performance_ratio 优先；其次 1 − system_loss；最后内置默认
        pr = params.get("performance_ratio")
        if pr is not None:
            pr = float(pr)
        else:
            system_loss = params.get("system_loss")
            if system_loss is not None:
                pr = 1.0 - float(system_loss)
                engine += "+system_loss"
            else:
                if _is_production():
                    raise RuntimeError(
                        "GS-050 生产环境拒绝使用内置 PR 假设，"
                        "请显式提供 performance_ratio 或 system_loss"
                    )
                pr = DEV_DEFAULT_PR
                estimated = True
                engine += "+default_pr"
        if not 0.0 < pr <= 1.0:
            raise ValueError(f"GS-050 PR 超出合理区间 (0,1]: {pr}")

        # 逐月 GHI：优先实测逐月，否则年值按天数均匀拆分（简化假设）
        ghi_monthly = params.get("ghi_monthly_kwh_m2")
        if ghi_monthly is not None:
            ghi_monthly = [float(v) for v in ghi_monthly]
            if len(ghi_monthly) != 12:
                raise ValueError("GS-050 ghi_monthly_kwh_m2 必须为 12 个月值")
        else:
            ghi_annual = params.get("ghi_annual_kwh_m2")
            if ghi_annual is None:
                raise ValueError(
                    "GS-050 光伏需要 ghi_monthly_kwh_m2 或 ghi_annual_kwh_m2 参数"
                )
            if _is_production():
                raise RuntimeError(
                    "GS-050 生产环境要求逐月 GHI 数据，"
                    "拒绝用年值均匀拆分的简化分布冒充实测月尺度结果"
                )
            ghi_annual = float(ghi_annual)
            ghi_monthly = [ghi_annual * d / 365.0 for d in DAYS_IN_MONTH]
            estimated = True
            engine += "+uniform_annual_split"

        monthly = [capacity_mw * ghi_m * pr for ghi_m in ghi_monthly]
        return monthly, engine, estimated

    # ── 风电 ──────────────────────────────────────────────────────────────
    def _simulate_wind(self, params: Dict[str, Any], capacity_mw: float):
        cut_in = float(params.get("cut_in_speed_ms", DEFAULT_CUT_IN))
        rated_speed = float(params.get("rated_speed_ms", DEFAULT_RATED_SPEED))
        cut_out = float(params.get("cut_out_speed_ms", DEFAULT_CUT_OUT))
        if not 0 < cut_in < rated_speed <= cut_out:
            raise ValueError(
                "GS-050 风速参数需满足 0 < cut_in < rated_speed ≤ cut_out"
            )

        speeds = params.get("wind_speed_monthly_ms")
        engine = "power_curve"
        if speeds is not None:
            speeds = [float(v) for v in speeds]
            if len(speeds) != 12:
                raise ValueError("GS-050 wind_speed_monthly_ms 必须为 12 个月值")
        else:
            mean_speed = params.get("wind_speed_ms")
            if mean_speed is None:
                raise ValueError(
                    "GS-050 风电需要 wind_speed_monthly_ms 或 wind_speed_ms 参数"
                )
            speeds = [float(mean_speed)] * 12
            engine = "power_curve_annual_mean"

        monthly = [
            wind_power_mw(v, capacity_mw, cut_in, rated_speed, cut_out) * days * 24.0
            for v, days in zip(speeds, DAYS_IN_MONTH)
        ]
        return monthly, engine, False
