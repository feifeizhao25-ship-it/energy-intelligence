"""CA-001 碳资产测算技能（恢复重建版）。

真实计算逻辑（纯参数化计算，无外部依赖）：
1. 减排量 = 年发电量(MWh) × 全国电力平均排放因子(tCO2/MWh)，
   默认因子 0.5306 出自生态环境部、国家统计局《关于发布2023年电力二氧化碳排放因子的公告》
   （公告2025年第47号，2025-12-31），可用 grid_emission_factor 覆盖；
2. CCER 资格判定：截至 2026-10-15 生态环境部已发布的可再生能源类方法学仅覆盖并网海上风电、
   并网光热发电；陆上风电、光伏暂无适用方法学（生态环境部 2025-07-21 对第6011号建议的答复）。
   只有 project_type 属于有方法学的类型时才计算 CCER 潜在收益 = 减排量 × 价格区间（给区间不给单点）；
   价格为市场假设——生产环境必须显式提供价格区间（fail-closed），
   开发环境使用内置区间并标注 estimated；
3. 欧盟 CBAM 碳成本（仅 market=global 且提供 embedded_emissions_tco2 时）：
   成本 = 嵌入排放 × (1 - 免费配额比例) × EU ETS 价格，
   ETS 价格同样在生产环境必须显式提供。

market=cn 输出中文键名说明，market=global 输出英文键名。
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

# 生态环境部、国家统计局《关于发布2023年电力二氧化碳排放因子的公告》（公告2025年第47号，2025-12-31）：
# 2023 年全国电力平均二氧化碳排放因子 0.5306 tCO2/MWh（与前端 web/src/lib/standards/emission-factor.ts 一致）
# 原文：https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html（2026-10-15 核对）
DEFAULT_GRID_FACTOR_TCO2_PER_MWH = 0.5306
GRID_FACTOR_YEAR = 2023

# 同一公告附件表 3：2023 年省级电力平均二氧化碳排放因子（tCO2/MWh），与前端 emission-factor.ts 一致（审计 8-2）
# 附件：https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/W020251231726284332528.pdf（2026-10-15 核对）
PROVINCIAL_GRID_FACTORS_2023 = {
    "北京": 0.5554, "天津": 0.6796, "河北": 0.6516, "山西": 0.6634, "内蒙古": 0.6479,
    "辽宁": 0.4878, "吉林": 0.4671, "黑龙江": 0.5229, "上海": 0.5737, "江苏": 0.5827,
    "浙江": 0.4974, "安徽": 0.6553, "福建": 0.4211, "江西": 0.5836, "山东": 0.6191,
    "河南": 0.5897, "湖北": 0.4044, "湖南": 0.4976, "广东": 0.4419, "广西": 0.4476,
    "海南": 0.3648, "重庆": 0.5581, "四川": 0.1564, "贵州": 0.5683, "云南": 0.1333,
    "陕西": 0.6335, "甘肃": 0.4471, "青海": 0.1796, "宁夏": 0.6187, "新疆": 0.6021,
}


def normalize_province(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    n = str(name).strip()
    for suffix in ("维吾尔自治区", "壮族自治区", "回族自治区", "自治区", "特别行政区", "省", "市"):
        if n.endswith(suffix):
            n = n[: -len(suffix)]
            break
    return n or None
GRID_FACTOR_URL = "https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/t20251231_1139517.html"
GRID_FACTOR_SOURCE_CN = (
    "生态环境部、国家统计局《关于发布2023年电力二氧化碳排放因子的公告》（公告2025年第47号，2025-12-31），"
    "2023年全国电力平均二氧化碳排放因子 0.5306 tCO2/MWh"
)
GRID_FACTOR_SOURCE_EN = (
    "MEE & NBS of China, Announcement No. 47 of 2025 (2025-12-31): 2023 national average "
    "grid CO2 emission factor 0.5306 tCO2/MWh"
)

# CCER 方法学覆盖（可再生能源类）。来源：生态环境部对十四届全国人大三次会议第6011号建议的答复（2025-07-21）
# https://www.mee.gov.cn/xxgk2018/xxgk/xxgk13/202511/t20251114_1133686.html（2026-10-15 核对）
CCER_METHODOLOGY_URL = "https://www.mee.gov.cn/xxgk2018/xxgk/xxgk13/202511/t20251114_1133686.html"
CCER_ELIGIBLE_PROJECT_TYPES = {"offshore_wind", "solar_thermal"}
CCER_NO_METHODOLOGY_TYPES = {"onshore_wind", "solar_pv", "distributed_pv"}
CCER_NOTE_CN = (
    "截至2026-10-15，生态环境部已发布的可再生能源类CCER方法学仅有并网海上风力发电、并网光热发电；"
    "陆上风电、光伏暂无适用方法学，不能申请CCER（生态环境部2025-07-21答复，仍在研究纳入可行性）。"
    "陆上风光项目可按规定核发绿证。"
)
CCER_NOTE_EN = (
    "As of 2026-10-15, China's CCER methodologies for renewables cover only grid-connected offshore wind "
    "and solar thermal; onshore wind and PV have no applicable methodology and cannot currently earn CCERs "
    "(MEE reply, 2025-07-21). Such projects can receive green certificates (GEC) instead."
)

# 开发环境内置价格假设（生产环境禁止，必须显式传入）
DEV_CCER_PRICE_BAND_CNY = (60.0, 100.0)  # 全国温室气体自愿减排交易市场常见成交区间
DEV_ETS_PRICE_EUR = 85.0  # EU ETS 2024-2025 年常见现货区间中值附近


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


def ccer_eligibility(project_type: Optional[str]) -> str:
    """eligible / no_methodology / unknown（未提供项目类型时不假设可申请）。"""
    if project_type in CCER_ELIGIBLE_PROJECT_TYPES:
        return "eligible"
    if project_type in CCER_NO_METHODOLOGY_TYPES:
        return "no_methodology"
    return "unknown"


def _require_explicit_prices(params: Dict[str, Any], need_cbam: bool, need_ccer: bool = True) -> None:
    """生产环境 fail-closed：价格假设不得用内置合成值冒充真实市场数据。"""
    if need_ccer and (params.get("ccer_price_low") is None or params.get("ccer_price_high") is None):
        raise RuntimeError(
            "CA-001 生产环境必须显式提供 ccer_price_low/ccer_price_high，"
            "拒绝使用内置价格假设冒充真实市场结果"
        )
    if need_cbam and params.get("eu_ets_price_eur") is None:
        raise RuntimeError(
            "CA-001 生产环境计算 CBAM 必须显式提供 eu_ets_price_eur，"
            "拒绝使用内置价格假设冒充真实市场结果"
        )


def compute_reduction_tco2(annual_generation_mwh: float, grid_factor: float) -> float:
    """纯函数：电网排放因子法减排量 = 年发电量 × 排放因子。"""
    return annual_generation_mwh * grid_factor


def compute_ccer_revenue_range(
    reduction_tco2: float, price_low: float, price_high: float
) -> List[float]:
    """CCER 潜在收益区间（CNY），给区间不给单点。"""
    return [reduction_tco2 * price_low, reduction_tco2 * price_high]


def compute_cbam_cost_eur(
    embedded_emissions_tco2: float,
    ets_price_eur: float,
    free_allocation_rate: float,
) -> float:
    """CBAM 碳成本 = 嵌入排放 × (1 - 免费配额比例) × ETS 价格。"""
    return embedded_emissions_tco2 * (1.0 - free_allocation_rate) * ets_price_eur


class CarbonAssetSkill:
    """CA-001 碳资产测算。"""

    skill_id = "CA-001"
    name = "碳资产测算"
    description = (
        "按全国电网排放因子法测算新能源电站年减排量（tCO2），并估算 "
        "CCER 潜在收益区间（CNY）与欧盟 CBAM 碳成本（EUR，仅 global 市场）；"
        "价格类假设在生产环境必须显式传入，否则 fail-closed。"
    )
    category = "CA"
    references = [
        "生态环境部、国家统计局公告2025年第47号《关于发布2023年电力二氧化碳排放因子的公告》0.5306 tCO2/MWh",
        "生态环境部对十四届全国人大三次会议第6011号建议的答复（2025-07-21）：陆上风电、光伏暂无CCER方法学",
        "《温室气体自愿减排交易管理办法（试行）》（生态环境部 2023）CCER 机制",
        "EU Regulation 2023/956 (CBAM)：嵌入排放 × ETS 价格，扣除免费配额",
        "生态环境部《企业温室气体排放核算方法与报告指南 发电设施》排放因子法",
    ]

    def validate(self, params: Dict[str, Any]) -> bool:
        generation = params.get("annual_generation_mwh")
        return generation is not None and float(generation) > 0

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        generation_raw = params.get("annual_generation_mwh")
        if generation_raw is None:
            raise ValueError("CA-001 需要 annual_generation_mwh 参数")
        annual_generation_mwh = float(generation_raw)
        if annual_generation_mwh <= 0:
            raise ValueError("CA-001 年发电量必须为正数")

        market = params.get("market", "cn")
        province = normalize_province(params.get("province"))
        provincial = PROVINCIAL_GRID_FACTORS_2023.get(province) if province else None
        if params.get("grid_emission_factor") is not None:
            grid_factor = float(params["grid_emission_factor"])
            factor_scope = "用户指定"
        elif provincial is not None:
            grid_factor = provincial
            factor_scope = f"2023年{province}省级电力平均二氧化碳排放因子"
        else:
            grid_factor = DEFAULT_GRID_FACTOR_TCO2_PER_MWH
            factor_scope = (
                f"2023年全国电力平均二氧化碳排放因子（公告未收录{province}省级因子）"
                if province else "2023年全国电力平均二氧化碳排放因子"
            )
        default_source = GRID_FACTOR_SOURCE_EN if market == "global" else GRID_FACTOR_SOURCE_CN
        if provincial is not None and params.get("grid_emission_factor") is None:
            default_source = (
                f"MEE & NBS Announcement No. 47 of 2025, Table 3: 2023 provincial factor ({province}) {grid_factor} tCO2/MWh"
                if market == "global"
                else f"生态环境部、国家统计局公告2025年第47号附件表3：{factor_scope} {grid_factor} tCO2/MWh"
            )
        factor_source = params.get("grid_emission_factor_source") or default_source

        embedded_raw = params.get("embedded_emissions_tco2")
        need_cbam = market == "global" and embedded_raw is not None
        estimated = False

        eligibility = ccer_eligibility(params.get("project_type"))
        need_ccer = eligibility == "eligible"

        if _is_production():
            _require_explicit_prices(params, need_cbam, need_ccer)

        ccer_low = ccer_high = None
        if need_ccer:
            ccer_low = params.get("ccer_price_low")
            ccer_high = params.get("ccer_price_high")
            if ccer_low is None or ccer_high is None:
                ccer_low, ccer_high = DEV_CCER_PRICE_BAND_CNY
                estimated = True
            ccer_low = float(ccer_low)
            ccer_high = float(ccer_high)
            if ccer_low <= 0 or ccer_high < ccer_low:
                raise ValueError("CA-001 CCER 价格区间无效")

        ets_price = params.get("eu_ets_price_eur")
        if need_cbam:
            if ets_price is None:
                ets_price = DEV_ETS_PRICE_EUR
                estimated = True
            ets_price = float(ets_price)

        reduction = compute_reduction_tco2(annual_generation_mwh, grid_factor)
        ccer_range = compute_ccer_revenue_range(reduction, ccer_low, ccer_high) if need_ccer else None

        emissions_raw = params.get("annual_emissions_tco2")
        offset_ratio: Optional[float] = None
        if emissions_raw is not None:
            annual_emissions = float(emissions_raw)
            if annual_emissions > 0:
                offset_ratio = reduction / annual_emissions

        common = {
            "skill_id": self.skill_id,
            "market": market,
            "engine": "grid_emission_factor_method",
            "estimated": estimated,
            "references": list(self.references),
        }

        if market == "global":
            result = {
                "emission_reduction_tco2": round(reduction, 3),
                "grid_emission_factor_tco2_per_mwh": grid_factor,
                "grid_emission_factor_source": factor_source,
                "grid_emission_factor_year": GRID_FACTOR_YEAR,
                "grid_emission_factor_province": province if provincial is not None else None,
                "grid_emission_factor_url": GRID_FACTOR_URL,
                "ccer_eligibility": eligibility,
                "ccer_note": CCER_NOTE_EN,
                "ccer_methodology_source": CCER_METHODOLOGY_URL,
                "ccer_potential_revenue_cny": None if ccer_range is None else {
                    "low": round(ccer_range[0], 2),
                    "high": round(ccer_range[1], 2),
                    "price_band_assumption_cny_per_t": [ccer_low, ccer_high],
                },
            }
            if offset_ratio is not None:
                result["offset_ratio"] = round(offset_ratio, 4)
            if need_cbam:
                free_alloc = float(params.get("cbam_free_allocation_rate", 0.0))
                cost = compute_cbam_cost_eur(
                    float(embedded_raw), ets_price, free_alloc
                )
                result["cbam_carbon_cost_eur"] = {
                    "cost_eur": round(cost, 2),
                    "embedded_emissions_tco2": float(embedded_raw),
                    "eu_ets_price_eur": ets_price,
                    "free_allocation_rate": free_alloc,
                }
            if estimated:
                result["warning"] = (
                    "Price band is a built-in assumption — provide explicit "
                    "market prices for production use"
                )
        else:
            result = {
                "减排量_tCO2": round(reduction, 3),
                "排放因子_tCO2每MWh": grid_factor,
                "排放因子出处": factor_source,
                "排放因子年份": GRID_FACTOR_YEAR,
                "因子发布机关": "生态环境部、国家统计局",
                "因子版本": "公告2025年第47号",
                "方法学编号": "待企业微信核对现行编号",
                "审批状态": "pending_wecom",
                "排放因子口径": factor_scope,
                "排放因子原文": GRID_FACTOR_URL,
                "CCER资格": {"eligible": "有适用方法学", "no_methodology": "暂无适用方法学", "unknown": "未提供项目类型，无法判定"}[eligibility],
                "CCER说明": CCER_NOTE_CN,
                "CCER方法学出处": CCER_METHODOLOGY_URL,
                "CCER潜在收益_CNY": None if ccer_range is None else {
                    "下限": round(ccer_range[0], 2),
                    "上限": round(ccer_range[1], 2),
                    "价格区间假设_CNY每吨": [ccer_low, ccer_high],
                },
            }
            if offset_ratio is not None:
                result["抵消比例"] = round(offset_ratio, 4)
            if estimated:
                result["warning"] = (
                    "价格区间为内置假设——生产环境请显式提供市场价格"
                )

        result.update(common)
        return result


def public_reduction_view(result: dict) -> dict:
    """对外只保留减排量。收益数字仍留在内部结果里，待企业微信确认方法学后再决定是否展示。"""
    hidden = {"CCER潜在收益_CNY", "cbam_carbon_cost_eur"}
    view = {key: value for key, value in dict(result).items() if key not in hidden}
    view["展示"] = "仅减排量"
    view["审批状态"] = "pending_wecom"
    view["收益口径"] = "未纳入"
    return view


def _install_contract(cls, formula_ref, valid_range):
    original = cls.execute

    async def execute(self, params):
        data = await original(self, params)
        import sys
        from pathlib import Path
        root = str(Path(__file__).resolve().parents[3])
        if root not in sys.path:
            sys.path.insert(0, root)
        from skill_contract import attach
        return attach(
            data,
            skill_id=self.skill_id,
            formula_ref=formula_ref,
            inputs=params,
            assumptions=["口径见引用，不额外承诺"],
            sources=list(getattr(self, "references", []) or ["见方法卡"]),
            valid_range=valid_range,
        )

    cls.execute = execute


_install_contract(CarbonAssetSkill, "排放因子乘发电量", "发电量为正")
