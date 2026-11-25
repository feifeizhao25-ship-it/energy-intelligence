"""
Wind energy calculation utilities.
"""

import math


# 实际风机风能利用系数 Cp 一般约 0.40–0.48；贝茨极限 0.593 是理论上限，不能当作实际值（审计 1-5）
DEFAULT_POWER_COEFFICIENT = 0.45
BETZ_LIMIT = 16 / 27


def air_density_at(elevation_m: float = 0.0, temperature_c: float = 15.0) -> float:
    """按海拔与气温修正空气密度（kg/m³）：指数大气标高 8434 m + 理想气体温度修正。"""
    return 1.225 * math.exp(-max(0.0, elevation_m) / 8434) * (288.15 / (273.15 + temperature_c))


def wind_power(
    wind_speed: float,
    rotor_area: float = 12000,
    air_density: float = 1.225,
    power_coefficient: float = DEFAULT_POWER_COEFFICIENT,
) -> float:
    """
    Calculate wind power with a realistic power coefficient (Cp, capped at the Betz limit).

    Args:
        wind_speed: Wind speed in m/s
        rotor_area: Rotor swept area in m² (default 12MW turbine ~120m diameter)
        air_density: Air density in kg/m³ (default sea level)

    Returns:
        Power in kW
    """
    cp = min(max(power_coefficient, 0.0), BETZ_LIMIT)
    power_w = 0.5 * air_density * rotor_area * (wind_speed ** 3) * cp
    return power_w / 1000


def weibull_params(mean_speed: float, std_dev: float) -> tuple[float, float]:
    """
    Estimate Weibull k and c parameters from mean and std dev.

    Args:
        mean_speed: Mean wind speed (m/s)
        std_dev: Standard deviation of wind speed

    Returns:
        (k, c) Weibull parameters
    """
    k = (std_dev / mean_speed) ** -1.086
    c = mean_speed / math.gamma(1 + 1/k)
    return round(k, 3), round(c, 3)


def wind_shear_extrapolation(speed_ref: float, height_ref: float, height_new: float, alpha: float = 0.2) -> float:
    """
    Extrapolate wind speed to different height using power law.

    Args:
        speed_ref: Reference wind speed
        height_ref: Reference height
        height_new: Target height
        alpha: Surface roughness exponent (0.2 = rural, 0.3+ = urban)

    Returns:
        Extrapolated wind speed
    """
    return speed_ref * (height_new / height_ref) ** alpha


def turbulence_intensity(terrain: str = "complex") -> float:
    """
    Get typical turbulence intensity by terrain type.

    Args:
        terrain: 'open', 'complex', 'urban', 'forest'

    Returns:
        Turbulence intensity (fraction)
    """
    values = {
        "open": 0.12,
        "complex": 0.14,
        "urban": 0.20,
        "forest": 0.22,
    }
    return values.get(terrain, 0.14)


IEC_61400_1_2019 = (
    "IEC 61400-1:2019 wind turbine class by annual average wind speed "
    "(I at least 10 m/s, II at least 8.5 m/s, III at least 7.5 m/s, otherwise class S)"
)


def weibull_power_density(mean_speed: float, k: float = 2.0, rho: float = 1.225) -> float:
    """Mean wind power density for a Weibull wind-speed distribution, W/m².

    P = ½ ρ c³ Γ(1+3/k), with c = v̄ / Γ(1+1/k). Using v̄³ alone drops the distribution factor
    (about 1.91 for a Rayleigh distribution, k=2) and understates the density.
    """
    if mean_speed <= 0 or k <= 0:
        return 0.0
    scale = mean_speed / math.gamma(1 + 1 / k)
    return 0.5 * rho * scale ** 3 * math.gamma(1 + 3 / k)


def iec_wind_class(mean_speed: float) -> str:
    """IEC 61400-1:2019 class from the annual average wind speed. Not a power-density grade."""
    if mean_speed >= 10:
        return "I"
    if mean_speed >= 8.5:
        return "II"
    if mean_speed >= 7.5:
        return "III"
    return "S"


def capacity_factor_estimate(mean_speed: float, rated_power_mw: float = 12) -> float:
    """
    Estimate capacity factor based on mean wind speed.

    Args:
        mean_speed: Mean hub-height wind speed (m/s)
        rated_power_mw: Turbine rated power (MW)

    Returns:
        Estimated capacity factor (0-1)
    """
    if mean_speed < 5:
        return 0.05
    elif mean_speed < 7:
        return 0.15 + (mean_speed - 5) * 0.05
    elif mean_speed < 9:
        return 0.25 + (mean_speed - 7) * 0.05
    else:
        return min(0.45, 0.35 + (mean_speed - 9) * 0.025)
