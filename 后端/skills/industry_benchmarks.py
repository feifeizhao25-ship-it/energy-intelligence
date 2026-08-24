"""
新能源智库 — 行业基准参数 (2025-2026)
Industry Benchmark Parameters

数据来源:
- NREL ATB 2025
- IRENA Renewable Power Generation Costs 2024
- BNEF Energy Outlook 2025 Q1
- CPIA 中国光伏产业发展路线图 2024
- 中国电力联合会 2025
- S&P Battery Price Survey 2025

最后验证: 2026-06-26
"""

# ═══════════════════════════════════════════════
# 光伏 Solar PV
# ═══════════════════════════════════════════════

# CAPEX (总投资成本)
SOLAR_CAPEX_CN = 3200        # 元/kW (中国 utility-scale 2025)
SOLAR_CAPEX_CN_DISTRIBUTED = 4500  # 元/kW (分布式)
SOLAR_CAPEX_US = 0.85        # $/W (美国 utility-scale)
SOLAR_CAPEX_EU = 0.75        # €/W (欧洲 utility-scale)

# OPEX (年运维成本)
SOLAR_OPEX_CN = 120           # 元/kW/年
SOLAR_OPEX_US = 13            # $/kW/年
SOLAR_OPEX_EU = 12            # €/kW/年

# 电价
ELECTRICITY_CN = 0.28         # 元/kWh (平价上网后均值)
ELECTRICITY_CN_PEAK = 0.45    # 元/kWh (峰电)
ELECTRICITY_CN_VALLEY = 0.12  # 元/kWh (谷电)
ELECTRICITY_US = 0.05         # $/kWh (PPA)
ELECTRICITY_EU = 0.07         # €/kWh (PPA)

# 技术参数
SOLAR_DEGRADATION_Y1 = 0.010  # 首年衰减 1% (TOPCon)
SOLAR_DEGRADATION_ANN = 0.004 # 年衰减 0.4%
SOLAR_PR_BENCHMARK = 0.85     # Performance Ratio 基准
SOLAR_CAPACITY_FACTOR_CN = 0.17  # 中国平均容量因子
SOLAR_CAPACITY_FACTOR_US = 0.24  # 美国平均容量因子

# 组件效率 (2025 主流)
MODULE_EFF_PERC = 0.225       # PERC 量产
MODULE_EFF_TOPCON = 0.255     # TOPCon 量产
MODULE_EFF_HJT = 0.250        # HJT 量产
MODULE_EFF_PEROVSKITE_LAB = 0.267  # 钙钛矿单结实验室
MODULE_EFF_TANDEM_LAB = 0.339      # 钙钛矿叠层实验室

# ═══════════════════════════════════════════════
# 储能 Battery Energy Storage
# ═══════════════════════════════════════════════

BATTERY_CAPEX_CN = 750        # 元/kWh (LFP 2025)
BATTERY_CAPEX_US = 110        # $/kWh (LFP pack)
BATTERY_RTE = 0.90             # Round-trip efficiency
BATTERY_CYCLE_LIFE = 6000     # 80% DoD
BATTERY_DEGRADATION = 0.02    # 年衰减

# ═══════════════════════════════════════════════
# 风电 Wind
# ═══════════════════════════════════════════════

WIND_CAPEX_ONSHORE_CN = 6500  # 元/kW
WIND_CAPEX_OFFSHORE_CN = 12000  # 元/kW
WIND_OPEX_ONSHORE_CN = 200    # 元/kW/年
WIND_CAPACITY_FACTOR_ONSHORE = 0.28
WIND_CAPACITY_FACTOR_OFFSHORE = 0.42

# ═══════════════════════════════════════════════
# 财务参数 Financial
# ═══════════════════════════════════════════════

DISCOUNT_RATE = 0.08
PROJECT_LIFE = 25              # 光伏
PROJECT_LIFE_WIND = 20
PROJECT_LIFE_BATTERY = 10
TAX_RATE_CN = 0.25             # 企业所得税
VAT_RATE_CN = 0.13             # 增值税
DEBT_RATIO = 0.70              # 贷款比例
INTEREST_RATE = 0.05           # 贷款利率 (LPR 4.3% + margin)
INFLATION = 0.02               # 通胀率

# IRR 行业基准
IRR_BENCHMARK_CN_SOLAR = 0.08   # 中国光伏基准 IRR
IRR_BENCHMARK_US_SOLAR = 0.10   # 美国光伏基准 IRR (含 ITC)
IRR_BENCHMARK_STORAGE = 0.09    # 储能基准 IRR

# 碳交易
CARBON_PRICE_CN = 70           # 元/吨CO2 (2025 全国碳市场)
CARBON_PRICE_EU = 75           # €/吨CO2 (EU ETS)
CARBON_FACTOR_GRID_CN = 0.581  # kgCO2/kWh (中国电网)

# 绿证
GREEN_CERT_CN = 50             # 元/个 (2025 均价)


# ═══════════════════════════════════════════════
# LCOE 行业基准 (用于对比)
# ═══════════════════════════════════════════════

LCOE_BENCHMARK = {
    "solar_cn": 0.20,          # 元/kWh
    "solar_us": 0.04,          # $/kWh
    "solar_eu": 0.05,          # €/kWh
    "wind_onshore_cn": 0.25,   # 元/kWh
    "wind_offshore_cn": 0.40,  # 元/kWh
    "storage_cn": 0.50,        # 元/kWh (LCOS)
}


# ═══════════════════════════════════════════════
# Newton-Raphson IRR 计算
# ═══════════════════════════════════════════════

def calculate_irr(cash_flows: list, max_iter: int = 100, tol: float = 1e-6) -> float:
    """
    Newton-Raphson 迭代法计算 IRR
    
    Args:
        cash_flows: 现金流列表，第一个为负（投资）
        max_iter: 最大迭代次数
        tol: 收敛容差
    
    Returns:
        IRR (小数形式，如 0.082 = 8.2%)
    """
    if len(cash_flows) < 2:
        return 0.0
    if sum(cf for cf in cash_flows if cf > 0) <= 0:
        return -1.0  # 无法回本
    
    rate = 0.10  # 初始猜测 10%
    for _ in range(max_iter):
        npv = sum(cf / (1 + rate) ** t for t, cf in enumerate(cash_flows))
        dnpv = sum(-t * cf / (1 + rate) ** (t + 1) 
                   for t, cf in enumerate(cash_flows) if t > 0)
        if abs(dnpv) < 1e-12:
            break
        new_rate = rate - npv / dnpv
        new_rate = max(-0.99, min(0.99, new_rate))  # clamp
        if abs(new_rate - rate) < tol:
            return new_rate
        rate = new_rate
    return rate


def calculate_npv(cash_flows: list, discount_rate: float) -> float:
    """计算 NPV"""
    return sum(cf / (1 + discount_rate) ** t 
               for t, cf in enumerate(cash_flows))


def calculate_payback(cash_flows: list) -> float:
    """
    计算回收期（线性插值）
    Returns: 年数 (如 6.5 = 6年6个月)
    """
    cumulative = 0
    for t, cf in enumerate(cash_flows):
        prev = cumulative
        cumulative += cf
        if cumulative >= 0 and prev < 0:
            # 线性插值
            return (t - 1) + abs(prev) / cf
    return float(len(cash_flows))  # 未回收


def calculate_lcoe(
    capex: float,
    opex_annual: float,
    annual_generation: float,
    project_life: int = 25,
    discount_rate: float = 0.08,
    degradation: float = 0.004,
    degradation_y1: float = 0.01,
) -> float:
    """
    计算 LCOE (Levelized Cost of Energy)
    
    LCOE = 总生命周期成本(现值) / 总生命周期发电量(现值)
    """
    total_cost_pv = capex
    total_gen_pv = 0
    for t in range(project_life):
        df = 1 / (1 + discount_rate) ** t
        if t == 0:
            gen = annual_generation  # 第一年
        else:
            deg = degradation_y1 if t == 1 else degradation
            gen = annual_generation * (1 - degradation_y1) * (1 - degradation) ** (t - 1)
        total_cost_pv += opex_annual * df
        total_gen_pv += gen * df
    return total_cost_pv / total_gen_pv if total_gen_pv > 0 else 0
