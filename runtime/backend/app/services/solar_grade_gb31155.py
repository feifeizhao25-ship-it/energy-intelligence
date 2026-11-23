"""国内版太阳能资源分级：GB/T 31155-2014《太阳能资源等级 总辐射》。

年水平面总辐照量（kWh/m²）四档：A 最丰富 ≥1750；B 很丰富 1400–1750；C 丰富 1050–1400；D 一般 <1050。
同样的四档也写在中国气象局《2025年中国风能太阳能资源年景公报》脚注里。
resource_class 继续用 I/II/III/IV（I 对应 A），给老客户端用；分数是连续、单调、封顶 100 的展示分，不是标准内容。
国际版不走这里（仍用 resource_service._classify_solar）。
"""
from __future__ import annotations

STANDARD = "GB/T 31155-2014 太阳能资源等级 总辐射"
GRADES = (  # (下限, 等级, 名称, 罗马类)
    (1750.0, "A", "最丰富", "I"),
    (1400.0, "B", "很丰富", "II"),
    (1050.0, "C", "丰富", "III"),
    (0.0, "D", "一般", "IV"),
)


def grade(ghi_annual: float) -> dict:
    g = max(0.0, float(ghi_annual))
    for low, code, name, roman in GRADES:
        if g >= low:
            break
    if g >= 1750:
        score = min(100.0, 60.0 + (g - 1750.0) / 50.0)
    elif g >= 1400:
        score = 40.0 + (g - 1400.0) / 350.0 * 20.0
    elif g >= 1050:
        score = 20.0 + (g - 1050.0) / 350.0 * 20.0
    else:
        score = g / 1050.0 * 20.0
    return {"resource_class": roman, "score": round(score, 1), "gb_grade": code, "gb_grade_label": name, "grading_standard": STANDARD}
