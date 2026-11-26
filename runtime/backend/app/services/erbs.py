"""Monthly GHI to diffuse horizontal irradiance.

Erbs, Klein and Duffie, Solar Energy 28(4), 1982, the daily Kd-Kt relation.
Extraterrestrial H0 is the Duffie and Beckman daily horizontal formula, evaluated
on the recommended mid-month day. There is no measured direct-normal series in the
domestic monthly seed, so DNI is only a noon-cosine estimate of the horizontal beam
and is labelled as such. The old fixed 0.55/0.45 split is not used.
"""
from __future__ import annotations

import math
from typing import Optional

GSC_KW_M2 = 1.367
# Duffie & Beckman recommended day number for the monthly-average day.
_MONTH_DAY = (17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344)
_MONTH_DAYS = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
MODEL = "erbs-1982"
DNI_NOTE = (
    "DHI 用 Erbs–Klein–Duffie 1982 的日 Kt 关系从月水平面总辐射分解。"
    "没有法向实测时，DNI 只是该月代表日正午的水平直射除以 cos(天顶角)，不是实测法向直接辐射。"
)


def diffuse_fraction(kt: float) -> float:
    """Daily diffuse fraction Kd. kt is clamped to the interval the correlation covers."""
    kt = min(max(float(kt), 0.0), 1.0)
    if kt <= 0.22:
        return 1.0 - 0.09 * kt
    if kt <= 0.80:
        return (
            0.9511
            - 0.1604 * kt
            + 4.388 * kt ** 2
            - 16.638 * kt ** 3
            + 12.336 * kt ** 4
        )
    return 0.165


def _radians(degrees: float) -> float:
    return degrees * math.pi / 180.0


def daily_extraterrestrial(latitude_deg: float, day_of_year: int) -> float:
    """Daily extraterrestrial irradiation on a horizontal surface, kWh/m2/day."""
    decl = _radians(23.45) * math.sin(_radians(360.0 * (284 + day_of_year) / 365.0))
    lat = _radians(latitude_deg)
    argument = -math.tan(lat) * math.tan(decl)
    if argument <= -1:
        sunset = math.pi
    elif argument >= 1:
        sunset = 0.0
    else:
        sunset = math.acos(argument)
    eccentricity = 1.0 + 0.033 * math.cos(_radians(360.0 * day_of_year / 365.0))
    bracket = math.cos(lat) * math.cos(decl) * math.sin(sunset) + sunset * math.sin(lat) * math.sin(decl)
    return max(0.0, (24.0 / math.pi) * GSC_KW_M2 * eccentricity * bracket)


def noon_cosine(latitude_deg: float, day_of_year: int) -> Optional[float]:
    decl = _radians(23.45) * math.sin(_radians(360.0 * (284 + day_of_year) / 365.0))
    zenith = abs(_radians(latitude_deg) - decl)
    cosine = math.cos(zenith)
    if cosine < 0.15:
        return None
    return cosine


def split_month(ghi_kwh_m2: float, latitude_deg: float, month_index: int) -> dict:
    days = _MONTH_DAYS[month_index]
    day = _MONTH_DAY[month_index]
    h0 = daily_extraterrestrial(latitude_deg, day)
    daily_ghi = float(ghi_kwh_m2) / days
    kt = daily_ghi / h0 if h0 > 0 else 0.0
    kd = diffuse_fraction(kt)
    dhi = float(ghi_kwh_m2) * kd
    beam = float(ghi_kwh_m2) - dhi
    cosine = noon_cosine(latitude_deg, day)
    dni = beam / cosine if cosine else None
    return {
        "ghi": float(ghi_kwh_m2),
        "kt": kt,
        "kd": kd,
        "dhi": dhi,
        "beam_horizontal": beam,
        "dni_estimate": dni,
        "h0_daily": h0,
    }


def split_year(monthly_ghi: list[float], latitude_deg: float) -> dict:
    months = [split_month(value, latitude_deg, index) for index, value in enumerate(monthly_ghi)]
    estimated = [month["dni_estimate"] for month in months if month["dni_estimate"] is not None]
    return {
        "model": MODEL,
        "dhi": sum(month["dhi"] for month in months),
        "beam_horizontal": sum(month["beam_horizontal"] for month in months),
        "dni_estimate": sum(estimated) if estimated else None,
        "dni_months_estimated": len(estimated),
        "months": months,
        "note": DNI_NOTE,
    }
