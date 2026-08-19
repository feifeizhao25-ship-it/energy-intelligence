"""ST-001 储能容量配置技能（恢复重建版）。

真实计算逻辑（纯参数化计算，无外部依赖）：
1. 按日发电曲线类型生成 24 小时光伏出力（装机容量的分数曲线）：
   - "clear"  晴天钟形曲线，等效满发 3.5 h/日；
   - "cloudy" 多云曲线 = clear × 0.6，等效满发 2.1 h/日；
2. 目标 self_consumption（自发自用）：
   直接消纳 = Σ min(pv_h, load_h)，负荷默认全天平坦；
   需由储能转移的放电量 Δ = target×日发电量 − 直接消纳；
   充电量 = Δ / 往返效率（不超过总富余电量），容量 = 充电量 / DoD，
   功率 = 最大小时富余功率（须能吸收富余出力峰值）；
3. 目标 peak_shaving（削峰）：
   功率 = 峰值负荷 − 并网限额；放电量 = 功率 × 高峰小时数；
   充电量 = 放电量 / 往返效率；容量 = 充电量 / DoD；
4. 简单日调度模拟：单日一充一放，充电量/放电量 = 充电量 × 往返效率。

经济性投资估算使用 storage_cost_cny_per_kwh——属成本假设：
生产环境必须显式提供（fail-closed），开发环境用内置值并标注 estimated。

往返效率默认 0.88、DoD 默认 0.90（磷酸铁锂储能典型值，见 references）。
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Tuple

# 24h 出力曲线（占装机容量分数），索引 = 小时 0..23
_CLEAR_FRACTIONS: List[float] = [0.0] * 7 + [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.5, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0,
] + [0.0] * 5  # 小时 7..18，合计 3.5（等效满发小时）

PROFILE_CURVES: Dict[str, List[float]] = {
    "clear": _CLEAR_FRACTIONS,
    "cloudy": [round(f * 0.6, 4) for f in _CLEAR_FRACTIONS],  # 合计 2.1
}

DEFAULT_RTE = 0.88  # 磷酸铁锂储能系统往返效率典型值
DEFAULT_DOD = 0.90  # 可用放电深度
DEV_STORAGE_COST_CNY_PER_KWH = 1200.0  # 开发环境内置成本假设（生产禁止）


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


def hourly_profiles(
    pv_capacity_mw: float, profile: str, daily_load_mwh: float
) -> Tuple[List[float], List[float]]:
    """生成 24h 光伏出力（MW）与平坦负荷（MW/h）序列。"""
    curve = PROFILE_CURVES[profile]
    pv = [pv_capacity_mw * f for f in curve]
    load = [daily_load_mwh / 24.0] * 24
    return pv, load


def direct_use_and_surplus(
    pv: List[float], load: List[float]
) -> Tuple[float, float, float]:
    """返回 (直接消纳 MWh, 总富余电量 MWh, 最大小时富余功率 MW)。"""
    direct = 0.0
    surplus = 0.0
    max_surplus_mw = 0.0
    for pv_h, load_h in zip(pv, load):
        surplus_h = max(0.0, pv_h - load_h)
        direct += pv_h - surplus_h
        surplus += surplus_h
        max_surplus_mw = max(max_surplus_mw, surplus_h)
    return direct, surplus, max_surplus_mw


def size_for_self_consumption(
    daily_generation_mwh: float,
    direct_mwh: float,
    surplus_mwh: float,
    max_surplus_mw: float,
    target_ratio: float,
    rte: float,
    dod: float,
) -> Dict[str, float]:
    """自发自用目标定容：Δ 放电量需由储能提供，充电量受富余电量约束。"""
    need_discharge = max(0.0, target_ratio * daily_generation_mwh - direct_mwh)
    charge_needed = need_discharge / rte
    charge_mwh = min(charge_needed, surplus_mwh)
    discharge_mwh = charge_mwh * rte
    capacity_mwh = charge_mwh / dod
    achieved = (
        (direct_mwh + discharge_mwh) / daily_generation_mwh
        if daily_generation_mwh > 0
        else 0.0
    )
    return {
        "power_mw": max_surplus_mw,
        "capacity_mwh": capacity_mwh,
        "charge_mwh": charge_mwh,
        "discharge_mwh": discharge_mwh,
        "achieved_self_consumption": achieved,
    }


def size_for_peak_shaving(
    peak_load_mw: float,
    grid_limit_mw: float,
    peak_hours: int,
    rte: float,
    dod: float,
) -> Dict[str, float]:
    """削峰目标定容：功率 = 峰值 − 限额，能量 = 功率 × 高峰小时数。"""
    power_mw = max(0.0, peak_load_mw - grid_limit_mw)
    discharge_mwh = power_mw * peak_hours
    charge_mwh = discharge_mwh / rte
    capacity_mwh = charge_mwh / dod
    return {
        "power_mw": power_mw,
        "capacity_mwh": capacity_mwh,
        "charge_mwh": charge_mwh,
        "discharge_mwh": discharge_mwh,
        "achieved_self_consumption": None,
    }


class StorageSizingSkill:
    """ST-001 储能容量配置。"""

    skill_id = "ST-001"
    name = "储能容量配置"
    description = (
        "按光伏电站容量、日发电曲线类型与目标（自发自用比例/削峰）推荐储能功率 "
        "MW 与容量 MWh，给出往返效率假设并做单日充放调度模拟；"
        "投资估算的成本假设在生产环境必须显式传入，否则 fail-closed。"
    )
    category = "ST"
    references = [
        "GB/T 36276-2018 电力储能用锂离子电池（磷酸铁锂效率/DoD 典型值）",
        "CNESA《储能产业研究白皮书》：锂电储能往返效率 85%–90%、DoD 90%",
        "NREL Storage Futures Study: diurnal storage sizing（日间移峰定容方法）",
        "IEC 61724-1:2021 光伏日发电曲线（晴天钟形/多云折减模型）",
    ]

    def validate(self, params: Dict[str, Any]) -> bool:
        capacity = params.get("pv_capacity_mw")
        return capacity is not None and float(capacity) > 0

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        capacity_raw = params.get("pv_capacity_mw")
        if capacity_raw is None:
            raise ValueError("ST-001 需要 pv_capacity_mw 参数")
        pv_capacity_mw = float(capacity_raw)
        if pv_capacity_mw <= 0:
            raise ValueError("ST-001 光伏容量必须为正数")

        market = params.get("market", "cn")
        profile = params.get("daily_profile", "clear")
        if profile not in PROFILE_CURVES:
            raise ValueError(
                f"ST-001 未知日发电曲线类型 {profile!r}，"
                f"可选: {sorted(PROFILE_CURVES)}"
            )
        target = params.get("target", "self_consumption")
        rte = float(params.get("round_trip_efficiency", DEFAULT_RTE))
        dod = float(params.get("depth_of_discharge", DEFAULT_DOD))
        if not 0 < rte <= 1 or not 0 < dod <= 1:
            raise ValueError("ST-001 往返效率与 DoD 必须在 (0, 1] 区间")

        estimated = False
        cost_per_kwh = params.get("storage_cost_cny_per_kwh")
        if cost_per_kwh is None:
            if _is_production():
                raise RuntimeError(
                    "ST-001 生产环境必须显式提供 storage_cost_cny_per_kwh，"
                    "拒绝使用内置成本假设冒充真实投资估算"
                )
            cost_per_kwh = DEV_STORAGE_COST_CNY_PER_KWH
            estimated = True
        cost_per_kwh = float(cost_per_kwh)

        pv, load = hourly_profiles(pv_capacity_mw, profile, 0.0)  # 先取曲线
        daily_generation_mwh = sum(pv)

        if target == "self_consumption":
            daily_load_mwh = params.get("daily_load_mwh")
            if daily_load_mwh is None:
                daily_load_mwh = daily_generation_mwh * 0.6
            daily_load_mwh = float(daily_load_mwh)
            _, load = hourly_profiles(pv_capacity_mw, profile, daily_load_mwh)
            direct, surplus, max_surplus_mw = direct_use_and_surplus(pv, load)
            target_ratio = float(params.get("target_self_consumption", 0.8))
            sizing = size_for_self_consumption(
                daily_generation_mwh, direct, surplus, max_surplus_mw,
                target_ratio, rte, dod,
            )
            sizing["direct_use_mwh"] = direct
            sizing["target_self_consumption"] = target_ratio
        elif target == "peak_shaving":
            peak_load_mw = params.get("peak_load_mw")
            grid_limit_mw = params.get("grid_limit_mw")
            if peak_load_mw is None or grid_limit_mw is None:
                raise ValueError(
                    "ST-001 削峰目标需要 peak_load_mw 与 grid_limit_mw 参数"
                )
            peak_hours = int(params.get("peak_hours", 2))
            sizing = size_for_peak_shaving(
                float(peak_load_mw), float(grid_limit_mw), peak_hours, rte, dod
            )
            sizing["peak_hours"] = peak_hours
        else:
            raise ValueError(
                f"ST-001 未知目标 {target!r}，可选: self_consumption / peak_shaving"
            )

        investment_cny = sizing["capacity_mwh"] * 1000.0 * cost_per_kwh

        sizing_block = {
            "power_mw": round(sizing["power_mw"], 3),
            "capacity_mwh": round(sizing["capacity_mwh"], 3),
            "round_trip_efficiency": rte,
            "depth_of_discharge": dod,
        }
        dispatch_block = {
            "charge_mwh": round(sizing["charge_mwh"], 3),
            "discharge_mwh": round(sizing["discharge_mwh"], 3),
            "cycles_per_day": 1,
        }
        economics_block = {
            "cost_assumption_cny_per_kwh": cost_per_kwh,
            "estimated_investment_cny": round(investment_cny, 2),
        }
        if target == "self_consumption":
            sizing_block["achieved_self_consumption"] = round(
                sizing["achieved_self_consumption"], 4
            )
            sizing_block["direct_use_mwh"] = round(sizing["direct_use_mwh"], 3)

        common = {
            "skill_id": self.skill_id,
            "market": market,
            "engine": "parametric_dispatch_sizing",
            "estimated": estimated,
            "daily_generation_mwh": round(daily_generation_mwh, 3),
            "daily_profile": profile,
            "target": target,
            "references": list(self.references),
        }

        if market == "global":
            result = {
                "recommended_storage": sizing_block,
                "daily_dispatch_simulation": dispatch_block,
                "investment_estimate": economics_block,
            }
            if estimated:
                result["warning"] = (
                    "Storage cost is a built-in assumption — provide explicit "
                    "storage_cost_cny_per_kwh for production use"
                )
        else:
            result = {
                "推荐储能": {
                    "功率_MW": sizing_block["power_mw"],
                    "容量_MWh": sizing_block["capacity_mwh"],
                    "往返效率假设": sizing_block["round_trip_efficiency"],
                    "放电深度假设": sizing_block["depth_of_discharge"],
                },
                "日调度模拟": {
                    "充电量_MWh": dispatch_block["charge_mwh"],
                    "放电量_MWh": dispatch_block["discharge_mwh"],
                    "日循环次数": dispatch_block["cycles_per_day"],
                },
                "投资估算": {
                    "成本假设_CNY每kWh": economics_block["cost_assumption_cny_per_kwh"],
                    "估算投资_CNY": economics_block["estimated_investment_cny"],
                },
            }
            if target == "self_consumption":
                result["推荐储能"]["达成自发自用比例"] = sizing_block[
                    "achieved_self_consumption"
                ]
                result["推荐储能"]["直接消纳_MWh"] = sizing_block["direct_use_mwh"]
            if estimated:
                result["warning"] = (
                    "储能成本为内置假设——生产环境请显式提供 storage_cost_cny_per_kwh"
                )

        result.update(common)
        return result
