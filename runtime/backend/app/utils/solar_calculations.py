"""
Solar PV calculation utilities.
"""

import math


def pv_output(ghi: float, temperature: float, efficiency: float = 0.18) -> float:
    """
    Calculate PV module output accounting for temperature losses.

    Args:
        ghi: Global Horizontal Irradiance (W/m²)
        temperature: Ambient temperature (°C)
        efficiency: Module efficiency at STC (default 18%)

    Returns:
        Power output normalized to 1 W/m² of panel area (W/m²)
    """
    temp_coeff = -0.004  # %/°C typical Si module
    stc_temp = 25
    temp_factor = 1 + temp_coeff * (temperature - stc_temp)
    return ghi * efficiency * temp_factor


def soiling_loss(days_since_cleaning: int, climate: str = "dry") -> float:
    """
    Estimate soiling loss based on days since cleaning.

    Args:
        days_since_cleaning: Days since last panel cleaning
        climate: 'dry', 'humid', 'coastal', 'tropical'

    Returns:
        Soiling loss fraction (0-1)
    """
    rates = {
        "dry": 0.003,
        "humid": 0.005,
        "coastal": 0.008,
        "tropical": 0.012,
    }
    rate = rates.get(climate, 0.005)
    return min(0.25, days_since_cleaning * rate)


def optimal_tilt(latitude: float) -> float:
    """
    Calculate optimal tilt angle for fixed-tilt PV systems.

    Args:
        latitude: Site latitude in degrees

    Returns:
        Optimal tilt angle in degrees
    """
    return abs(latitude) * 0.76 + 3.1


def sunbelt_factor(latitude: float) -> float:
    """Estimate resource quality factor based on latitude."""
    abs_lat = abs(latitude)
    if abs_lat <= 35:
        return 1.0 + (35 - abs_lat) / 350
    else:
        return 1.0 - (abs_lat - 35) / 350


def pv_degradation_annual(year: int, first_year_deg: float = 0.03, annual_deg: float = 0.005) -> float:
    """
    Calculate cumulative PV module degradation.

    Args:
        year: Year of operation (1 = first year)
        first_year_deg: Light-induced degradation in year 1
        annual_deg: Annual degradation rate

    Returns:
        Cumulative degradation factor (0-1)
    """
    if year == 1:
        return 1 - first_year_deg
    return (1 - first_year_deg) * (1 - annual_deg) ** (year - 1)
