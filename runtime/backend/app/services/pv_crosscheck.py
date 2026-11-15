"""Offline pvlib vs PySAM check on one synthetic year.

The hourly irradiance is a fixed formula. It is not a weather observation
and it is not a figure from the CMA bulletin. No network call.
"""
from __future__ import annotations

import math

import numpy as np

LAT = 31.23
LON = 121.47
TILT = 20.0
AZIMUTH = 180.0
CAPACITY_W = 1000.0
DC_AC_RATIO = 1.2
INV_EFF = 0.96
GAMMA = -0.0047
LIMIT = 0.05
NOTE = "合成逐时序列，只用于同一输入的模型对照，不是气象观测，也不是年景公报里的数字。"


def synthetic_hours() -> dict:
    """8760 local hours for 2021. Daytime values follow the hour angle only."""
    import pandas as pd

    times = pd.date_range("2021-01-01", periods=8760, freq="h", tz="Asia/Shanghai")
    hour = times.hour.to_numpy()
    day = np.clip(np.sin((hour - 6) / 12 * math.pi), 0, None)
    dni = 650.0 * day
    dhi = 250.0 * day
    ghi = dhi + dni * 0.5
    return {
        "times": times,
        "ghi": ghi,
        "dni": dni,
        "dhi": dhi,
        "temp_air": np.full(8760, 20.0),
        "wind": np.full(8760, 2.0),
    }


def _pvlib_kwh(hours: dict) -> float:
    import pvlib
    from pvlib.inverter import pvwatts
    from pvlib.pvsystem import pvwatts_dc
    from pvlib.temperature import faiman

    times = hours["times"]
    loc = pvlib.location.Location(LAT, LON, tz="Asia/Shanghai")
    solar = loc.get_solarposition(times)
    airmass = pvlib.atmosphere.get_relative_airmass(solar["apparent_zenith"]).fillna(0)
    poa = pvlib.irradiance.get_total_irradiance(
        TILT,
        AZIMUTH,
        solar["apparent_zenith"],
        solar["azimuth"],
        hours["dni"],
        hours["ghi"],
        hours["dhi"],
        dni_extra=pvlib.irradiance.get_extra_radiation(times),
        airmass=airmass,
        model="perez",
    )
    poa_global = poa["poa_global"].fillna(0).clip(lower=0).to_numpy()
    cell = faiman(poa_global, hours["temp_air"], hours["wind"])
    dc = pvwatts_dc(poa_global, cell, CAPACITY_W, GAMMA)
    ac = pvwatts(dc, pdc0=CAPACITY_W / DC_AC_RATIO, eta_inv_nom=INV_EFF)
    return float(np.nansum(ac)) / 1000.0


def _pysam_kwh(hours: dict) -> float:
    import PySAM.Pvwattsv8 as pv

    times = hours["times"]
    weather = {
        "tz": 8,
        "lat": LAT,
        "lon": LON,
        "elev": 4,
        "year": times.year.to_list(),
        "month": times.month.to_list(),
        "day": times.day.to_list(),
        "hour": times.hour.to_list(),
        "minute": [0] * len(times),
        "dn": hours["dni"].tolist(),
        "df": hours["dhi"].tolist(),
        "gh": hours["ghi"].tolist(),
        "wspd": hours["wind"].tolist(),
        "tdry": hours["temp_air"].tolist(),
    }
    model = pv.default("PVWattsNone")
    model.SolarResource.solar_resource_data = weather
    design = model.SystemDesign
    design.system_capacity = CAPACITY_W / 1000.0
    design.dc_ac_ratio = DC_AC_RATIO
    design.inv_eff = INV_EFF * 100.0
    design.losses = 0
    design.tilt = TILT
    design.azimuth = AZIMUTH
    design.array_type = 0
    design.module_type = 0
    design.gcr = 0.4
    design.en_snowloss = 0
    model.execute()
    return float(model.Outputs.annual_energy)


def compare() -> dict:
    try:
        import pvlib
        import PySAM
    except ImportError as exc:
        return {
            "compared": False,
            "within_5_percent": None,
            "reason": exc.__class__.__name__,
            "network": False,
            "note": NOTE,
        }
    hours = synthetic_hours()
    pvlib_kwh = _pvlib_kwh(hours)
    pysam_kwh = _pysam_kwh(hours)
    rel = abs(pvlib_kwh - pysam_kwh) / pysam_kwh if pysam_kwh else None
    return {
        "compared": True,
        "within_5_percent": rel is not None and rel <= LIMIT,
        "relative_abs_diff": rel,
        "limit": LIMIT,
        "pvlib_annual_kwh": pvlib_kwh,
        "pysam_annual_kwh": pysam_kwh,
        "pvlib_version": getattr(pvlib, "__version__", ""),
        "pysam_version": getattr(PySAM, "__version__", ""),
        "tilt": TILT,
        "azimuth": AZIMUTH,
        "capacity_w": CAPACITY_W,
        "losses": 0,
        "network": False,
        "observed_weather": False,
        "note": NOTE,
    }
