"""
Wind energy calculation utilities.
"""

import math


def wind_power(wind_speed: float, rotor_area: float = 12000, air_density: float = 1.225) -> float:
    """
    Calculate wind power using Betz limit.

    Args:
        wind_speed: Wind speed in m/s
        rotor_area: Rotor swept area in m² (default 12MW turbine ~120m diameter)
        air_density: Air density in kg/m³ (default sea level)

    Returns:
        Power in kW
    """
    power_w = 0.5 * air_density * rotor_area * (wind_speed ** 3) * 0.59  # Betz limit
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
