"""智8：国际版风功率密度复算。P = ½ ρ c³ Γ(1+3/k)。"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.wind_calculations import weibull_power_density

mean, k, c, rho = 7.39, 2.0, 8.34, 1.225
old = 0.5 * rho * mean ** 3
hand = 0.5 * rho * c ** 3 * math.gamma(1 + 3 / k)
new = weibull_power_density(mean, k=k, rho=rho)
print("输入: mean_speed 7.39 m/s, weibull_k 2, weibull_c 8.34, rho 1.225")
print(f"旧结果（½ρ·平均风速³，忽略分布）: {old:.1f} W/m²")
print(f"手算 ½ρc³Γ(1+3/k): {hand:.1f} W/m²")
print(f"新函数（用平均风速和 k 反推 c）: {new:.1f} W/m²")
print("正确值约 472 W/m²。依据：威布尔分布的三阶矩，不是平均风速的立方。")
print("等级：IEC 61400-1:2019 按年平均风速分 I/II/III/S，7.39 m/s 低于 7.5，为 S 级。")
assert abs(hand - 472) < 2
