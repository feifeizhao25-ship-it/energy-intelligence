"""国内版风功率密度与分级：GB/T 18710-2002《风电场风能资源评估方法》。

- 附录 B：平均风功率密度是设定时段内逐小时风功率密度的平均值，「不可用年（或月）平均风速计算」。
  手里只有月平均风速时，按每月风速服从瑞利分布（威布尔 k=2）求 v³ 的期望：
  E[v³] = Γ(1+3/k) / Γ(1+1/k)³ × v̄³ = 6/π × v̄³ ≈ 1.91 × v̄³，再对 12 个月取平均。
- 表 4（50 m 高度）七级：1 <200，2 200–300，3 300–400（较好），4 400–500（好），5 500–600、6 600–800、7 800–2000（很好），W/m²。
  其他高度的数据先按对数律（z0=0.03 m，和网页 wind-shear.ts 同一口径）换算到 50 m 再分级。
- resource_class 继续给老客户端 I/II/III/IV，阈值仍是 50 m 风功率密度 400/300/200（与表 4 的 4/3/2 级下限一致）。
- 分数是连续、单调、封顶 100 的展示分，不是标准内容。
国际版不走这里。改成这套算法后，同样的风速算出的风功率密度约为原来的 1.9 倍，等级会跟着变（待主人/专家确认）。
"""
from __future__ import annotations

import math
from typing import Iterable

STANDARD = "GB/T 18710-2002 风电场风能资源评估方法（附录 B、表 4）"
AIR_DENSITY = 1.225
WEIBULL_K = 2.0
ROUGHNESS_M = 0.03
TABLE4_50M = (  # (下限 W/m², 等级, 表4「应用于并网风力发电」列)
    (800.0, 7, "很好"), (600.0, 6, "很好"), (500.0, 5, "很好"), (400.0, 4, "好"),
    (300.0, 3, "较好"), (200.0, 2, "表4未标注并网适用"), (0.0, 1, "表4未标注并网适用"),
)


def cube_factor(k: float = WEIBULL_K) -> float:
    return math.gamma(1 + 3 / k) / math.gamma(1 + 1 / k) ** 3


def height_ratio(h_from: float, h_to: float, z0: float = ROUGHNESS_M) -> float:
    return math.log(h_to / z0) / math.log(h_from / z0)


def wpd_from_mean_speeds(mean_speeds: Iterable[float], rho: float = AIR_DENSITY, k: float = WEIBULL_K) -> float:
    vs = [max(0.0, float(v)) for v in mean_speeds]
    if not vs:
        return 0.0
    f = cube_factor(k)
    return 0.5 * rho * sum(f * v ** 3 for v in vs) / len(vs)


def score_50m(wpd50: float) -> float:
    w = max(0.0, wpd50)
    if w < 200:
        s = w / 200 * 30
    elif w < 300:
        s = 30 + (w - 200) / 100 * 20
    elif w < 400:
        s = 50 + (w - 300) / 100 * 20
    else:
        s = 70 + (w - 400) / 400 * 30
    return round(min(100.0, s), 1)


def assess(mean_speeds: Iterable[float], height_m: float = 50.0, rho: float = AIR_DENSITY) -> dict:
    vs = [float(v) for v in mean_speeds]
    wpd_h = wpd_from_mean_speeds(vs, rho)
    r = height_ratio(height_m, 50.0) if height_m != 50 else 1.0
    wpd50 = wpd_from_mean_speeds([v * r for v in vs], rho)
    for low, g, label in TABLE4_50M:
        if wpd50 >= low:
            break
    roman = "I" if wpd50 >= 400 else "II" if wpd50 >= 300 else "III" if wpd50 >= 200 else "IV"
    return {
        "wind_power_density": round(wpd_h, 1),
        "wind_power_density_50m": round(wpd50, 1),
        "gb_grade": g,
        "gb_grade_label": f"{g} 级（{label}）",
        "resource_class": roman,
        "score": score_50m(wpd50),
        "grading_standard": STANDARD,
        "wpd_method": (f"按 {len(vs)} 个月平均风速，假设每月瑞利分布（k=2）求 v³ 期望（×{cube_factor():.3f}）后取平均" if len(vs) > 1
                       else f"只有年平均风速，假设瑞利分布（k=2）求 v³ 期望（×{cube_factor():.3f}）")
        + "；有逐小时测风数据时应按附录 B 式（B1）直接计算",
    }
