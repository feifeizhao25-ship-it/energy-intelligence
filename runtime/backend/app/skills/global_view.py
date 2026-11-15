"""International (market=global) view of the skill catalogue and skill results.

Every Chinese string a skill returns has an English counterpart here, and references are limited to the
international sources the skill already cited (NREL, IEC, NASA POWER, IEA PVPS, ...). Chinese national
standards (GB/T), CNESA and NDRC documents are dropped from the international view. Skills that only make
sense for China (CA-001: national grid factor + CCER) are hidden from the international catalogue.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]")

CN_ONLY = {"CA-001"}

CATALOG: Dict[str, Dict[str, Any]] = {
    "FM-001": {
        "name": "Levelized Cost of Energy (LCOE)",
        "description": "Computes LCOE with the NREL ATB discounting formula: CAPEX plus discounted OPEX in the numerator, discounted energy output with yearly degradation in the denominator.",
        "references": ["NREL Annual Technology Baseline (ATB): LCOE formula"],
        "formula_ref": "Simplified NREL LCOE",
        "valid_range": "Annual generation must be positive",
    },
    "FM-002": {
        "name": "IRR, NPV and Payback",
        "description": "Computes IRR (Newton-Raphson), NPV and simple and discounted payback from yearly cash flows; cash flows can be supplied directly or generated from PV project parameters.",
        "references": [
            "NREL ATB financial assumptions (discount rate, project life)",
            "Brealey, Myers, Allen: Principles of Corporate Finance (discounted cash flow)",
        ],
        "formula_ref": "FM-002 cash flows",
        "valid_range": "At least two cash-flow periods",
    },
    "OM-001": {
        "name": "Module Cleaning Schedule",
        "description": "Estimates the best cleaning interval and next suggested cleaning date from dust level, last-30-day rainfall and current performance-ratio loss, with a confidence score. Cleaning cost and daily revenue must be supplied in production, otherwise the call fails closed.",
        "references": [
            "IEA PVPS Task 13: soiling losses in arid regions 0.1-0.5 %/day",
            "financial_utils.calc_optimal_cleaning_interval: N=sqrt(2C/(R*s/100)) optimal-interval model",
            "IEC 61724-1:2021 PV system performance monitoring (PR loss and soiling)",
            "NREL PV soiling studies: heavy rain (>=20 mm) approximates one natural cleaning (heuristic)",
        ],
        "formula_ref": "Optimal cleaning interval",
        "valid_range": "Soiling rate must be positive",
    },
    "RA-001": {
        "name": "Solar Resource Assessment",
        "description": "Grades the solar resource and estimates annual equivalent hours and a capacity-factor range from measured GHI or NASA POWER data. In production it fails closed when external data is unreachable.",
        "references": [
            "IEC 61724-1:2021 defines performance ratio. The 0.78-0.86 range is an engineering assumption, not a clause of the standard, and is still to be verified.",
            "NREL National Solar Radiation Database / NASA POWER climatology",
        ],
        "formula_ref": "RA-001 annual irradiation grading",
        "valid_range": "GHI must be positive",
    },
    "RA-002": {
        "name": "Wind Resource Assessment",
        "description": "Grades wind power density and estimates annual equivalent hours and a capacity-factor range from measured wind speed or NASA POWER data. In production it fails closed when external data is unreachable.",
        "references": [
            "IEC 61400-12-1 wind turbine power performance testing (standard air density 1.225 kg/m3)",
            "NREL Wind Toolkit / NASA POWER climatology",
        ],
        "formula_ref": "RA-002 wind-speed grading",
        "valid_range": "Wind speed must be positive",
    },
    "ST-001": {
        "name": "Storage Sizing",
        "description": "Recommends storage power (MW) and capacity (MWh) from PV capacity, daily generation profile and goal (self-consumption share or peak shaving), states the round-trip-efficiency assumption and runs a one-day dispatch simulation. Cost assumptions must be supplied in production, otherwise the call fails closed.",
        "references": [
            "NREL Storage Futures Study: diurnal storage sizing",
            "IEC 61724-1:2021 PV daily generation profile (clear-sky bell curve / cloudy scaling model)",
        ],
        "formula_ref": "ST-001 sizing",
        "valid_range": "Capacity must be positive",
    },
}

_KEYS = {
    "输入参数": "inputs",
    "积灰速率_百分比每天": "soiling_rate_pct_per_day",
    "沙尘等级": "dust_level",
    "当前PR衰减_pct": "current_pr_loss_pct",
    "近30天降雨_mm": "rainfall_30d_mm",
    "清洗排程": "cleaning_schedule",
    "最优清洗间隔_天": "optimal_interval_days",
    "下次清洗建议日期": "next_cleaning_date",
    "建议立即清洗": "clean_now",
    "估计已积灰天数": "days_since_clean_estimate",
    "有效累积损失_pct": "effective_loss_pct",
    "近期自然清洗": "recent_natural_cleaning",
    "预计挽回发电收益": "recovered_revenue_gross",
    "扣除成本净收益": "net_benefit_after_cost",
    "置信度": "confidence",
    "推荐储能": "recommended_storage",
    "功率_MW": "power_mw",
    "容量_MWh": "capacity_mwh",
    "往返效率假设": "round_trip_efficiency_assumption",
    "放电深度假设": "depth_of_discharge_assumption",
    "日调度模拟": "daily_dispatch_simulation",
    "充电量_MWh": "charge_mwh",
    "放电量_MWh": "discharge_mwh",
    "日循环次数": "cycles_per_day",
    "投资估算": "investment_estimate",
    "成本假设_CNY每kWh": "cost_assumption_per_kwh_as_supplied",
    "估算投资_CNY": "estimated_investment_in_supplied_currency",
    "达成自发自用比例": "achieved_self_consumption",
    "直接消纳_MWh": "direct_use_mwh",
}

_TEXT = {
    "成本/收益为内置假设——生产环境请显式提供 cleaning_cost 与 daily_revenue": "Cost and revenue are built-in assumptions. In production, supply cleaning_cost and daily_revenue explicitly.",
    "储能成本为内置假设——生产环境请显式提供 storage_cost_cny_per_kwh": "Storage cost is a built-in assumption. In production, supply storage_cost_cny_per_kwh explicitly.",
    "启发式估算结果——非实测数据，仅供开发环境演示": "Heuristic estimate, not measured data. For development demos only.",
}

GENERIC_ERROR = "The skill could not run with the supplied inputs. Check the required fields with GET /skills/{skill_id}/schema."


def has_cjk(value: Any) -> bool:
    if isinstance(value, str):
        return bool(_CJK.search(value))
    if isinstance(value, dict):
        return any(has_cjk(k) or has_cjk(v) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return any(has_cjk(v) for v in value)
    return False


def visible_in_global(skill_id: str) -> bool:
    return skill_id in CATALOG and skill_id not in CN_ONLY


def localize_meta(meta_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """English catalogue entry, or None when the skill has no international entry."""
    sid = meta_dict.get("skill_id")
    if not visible_in_global(sid):
        return None
    entry = CATALOG[sid]
    out = dict(meta_dict)
    out["name"] = entry["name"]
    out["description"] = entry["description"]
    out["references"] = list(entry["references"])
    if has_cjk(out.get("tags")):
        out["tags"] = []
    return out


def _walk(value: Any) -> Any:
    if isinstance(value, dict):
        return {_KEYS.get(k, k): _walk(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_walk(v) for v in value]
    if isinstance(value, str):
        return _TEXT.get(value, value)
    return value


def localize_result(skill_id: str, data: Any) -> Any:
    """English labels, English references and contract for the international market."""
    if not isinstance(data, dict):
        return data
    out = _walk(data)
    entry = CATALOG.get(skill_id)
    if entry:
        if "references" in out:
            out["references"] = list(entry["references"])
        contract = out.get("contract")
        if isinstance(contract, dict):
            contract = dict(contract)
            contract["sources"] = list(entry["references"])
            contract["formula_ref"] = entry["formula_ref"]
            contract["valid_range"] = entry["valid_range"]
            contract["assumptions"] = ["Scope is defined by the references; no further guarantee is given."]
            out["contract"] = contract
    return out


def localize_error(message: Any) -> str:
    text = str(message or "")
    return GENERIC_ERROR if has_cjk(text) or not text else text
