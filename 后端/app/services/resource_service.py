import httpx
from app.schemas.resource import SolarResourceRequest, SolarResourceResponse, WindResourceRequest, WindResourceResponse
from collections import defaultdict
import math


def _classify_solar(ghi: float) -> tuple[str, float]:
    if ghi >= 2000:
        return "I", min(100, 60 + (ghi - 2000) / 50)
    elif ghi >= 1600:
        return "II", 40 + (ghi - 1600) / 20
    elif ghi >= 1200:
        return "III", 20 + (ghi - 1200) / 20
    else:
        return "IV", max(0, (ghi / 1200) * 20)


def _classify_wind(wpd: float) -> tuple[str, float]:
    if wpd >= 400:
        return "I", min(100, 70 + (wpd - 400) / 10)
    elif wpd >= 300:
        return "II", 50 + (wpd - 300)
    elif wpd >= 200:
        return "III", 30 + (wpd - 200)
    else:
        return "IV", max(0, (wpd / 200) * 30)


def _aggregate_monthly(daily_data: list, dates: list) -> list:
    monthly = defaultdict(float)
    counts = defaultdict(int)
    for val, date_str in zip(daily_data, dates):
        if val is not None and val > 0:
            month = int(date_str[5:7])
            monthly[month] += val
            counts[month] += 1
    return [monthly.get(m, 0.0) for m in range(1, 13)]


def _aggregate_monthly_avg(daily_data: list, dates: list) -> list:
    monthly = defaultdict(float)
    counts = defaultdict(int)
    for val, date_str in zip(daily_data, dates):
        if val is not None and val > 0:
            month = int(date_str[5:7])
            monthly[month] += val
            counts[month] += 1
    return [monthly.get(m, 0.0) / counts.get(m, 1) if counts.get(m, 0) > 0 else 0.0 for m in range(1, 13)]


def _diffuse_fraction(kt: float) -> float:
    """Orgill-Hollands diffuse fraction correlation."""
    if kt <= 0:
        return 0.95
    elif kt < 0.21:
        return 1.0 - 0.09 * kt
    elif kt < 0.80:
        return 1.39 - 1.64 * kt
    else:
        return 0.17


def _extraterrestrial_monthly(lat: float, month: int) -> float:
    """Monthly average daily extraterrestrial radiation in MJ/m²/day."""
    lat_rad = math.radians(lat)
    # Solar constant
    Gsc = 4.921
    # Day of year for mid-month (rough approximation)
    dom = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]
    J = dom[month - 1]
    # Solar declination
    delta = 23.45 * math.sin(math.radians(360 * (284 + J) / 365))
    delta_rad = math.radians(delta)
    # Sunset hour angle
    cos_ws = -math.tan(lat_rad) * math.tan(delta_rad)
    cos_ws = max(-1, min(1, cos_ws))
    ws = math.acos(cos_ws)
    # Extraterrestrial radiation (daily, MJ/m²/day)
    H0 = (24 / math.pi) * Gsc * (1 + 0.033 * math.cos(2 * math.pi * J / 365)) * (
        cos_ws * math.sin(lat_rad) * math.sin(delta_rad) +
        math.sin(lat_rad) * math.cos(delta_rad) * math.sin(ws)
    )
    return max(H0, 0.1)


async def fetch_solar_resource(req: SolarResourceRequest) -> SolarResourceResponse:
    """Fetch solar resource from Open-Meteo Climate API.
    GHI + temperature from Open-Meteo; DNI/DHI estimated via Orgill-Hollands.
    Falls back to stub on any error."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r1 = await client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": req.lat, "longitude": req.lng,
                    "start_date": "2020-01-01", "end_date": "2020-12-31",
                    "daily": "shortwave_radiation_sum,temperature_2m_mean",
                    "timezone": "Asia/Shanghai",
                }
            )
            r1.raise_for_status()
            d1 = r1.json()
            daily = d1.get("daily", {})
            dates = daily.get("time", [])
            ghi_daily_mj = daily.get("shortwave_radiation_sum", [])
            temp_daily = daily.get("temperature_2m_mean", [])

            r2 = await client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": req.lat, "longitude": req.lng,
                    "start_date": "2020-01-01", "end_date": "2020-12-31",
                    "daily": "sunshine_duration",
                    "timezone": "Asia/Shanghai",
                }
            )
            r2.raise_for_status()
            d2 = r2.json()
            sunshine_daily = d2.get("daily", {}).get("sunshine_duration", [])

        # Monthly GHI in kWh/m²/month (Open-Meteo returns MJ/m²/day)
        ghi_monthly_mj = _aggregate_monthly(ghi_daily_mj, dates)
        ghi_monthly_kwh = [v / 3.6 for v in ghi_monthly_mj]
        ghi_annual = sum(ghi_monthly_kwh)

        temp_monthly = _aggregate_monthly_avg(temp_daily, dates)
        avg_temp = sum(temp_monthly) / 12
        peak_sun_hours = ghi_annual / 365

        # Sunshine to monthly
        sunshine_monthly_s = _aggregate_monthly(sunshine_daily, dates)

        # Estimate DNI, DHI per month using Orgill-Hollands
        dni_monthly, dhi_monthly = [], []
        for i, n_sec in enumerate(sunshine_monthly_s):
            ghi_m = ghi_monthly_kwh[i]
            # Daily average GHI this month
            ghi_daily_kwh = ghi_m / 30.0 if ghi_m > 0 else 0.1
            # Extraterrestrial daily radiation
            H0_daily = _extraterrestrial_monthly(req.lat, i + 1)
            # Convert MJ to kWh
            H0_kwh = H0_daily / 3.6
            # Clearness index kt
            kt = ghi_daily_kwh / H0_kwh if H0_kwh > 0 else 0.3
            kt = max(0.05, min(kt, 0.90))
            # Diffuse fraction
            df = _diffuse_fraction(kt)
            # DHI = GHI * df
            dhi_m = ghi_m * df
            # DNI from rearranged: GHI = DNI * cos(z) + DHI
            # cos(z) for monthly avg (approximation)
            cos_z = 0.65  # average cos(zenith) for mid-latitudes
            dni_m = (ghi_m - dhi_m) / cos_z if cos_z > 0 else dni_m
            dni_m = max(dni_m, 0)
            dni_monthly.append(round(dni_m, 1))
            dhi_monthly.append(round(dhi_m, 1))

        dni_annual = sum(dni_monthly)
        dhi_annual = sum(dhi_monthly)
        resource_class, score = _classify_solar(ghi_annual)
        optimal_tilt = round(abs(req.lat) * 0.76 + 3.1, 1)

        return SolarResourceResponse(
            lat=req.lat, lng=req.lng,
            ghi=round(ghi_annual, 1),
            dni=round(dni_annual, 1),
            dhi=round(dhi_annual, 1),
            peak_sun_hours=round(peak_sun_hours, 2),
            optimal_tilt=optimal_tilt,
            avg_temperature=round(avg_temp, 1),
            resource_class=resource_class,
            score=round(score, 1),
            data_source="open_meteo",
            monthly_ghi=[round(v, 1) for v in ghi_monthly_kwh],
        )

    except Exception:
        return SolarResourceResponse(
            lat=req.lat, lng=req.lng,
            ghi=1450.0, dni=1800.0, dhi=400.0,
            peak_sun_hours=3.97, optimal_tilt=round(abs(req.lat) * 0.76 + 3.1, 1),
            avg_temperature=15.0, resource_class="II", score=65.0,
            data_source="open_meteo_stub", monthly_ghi=[120.0] * 12,
        )


async def fetch_wind_resource(req: WindResourceRequest) -> WindResourceResponse:
    """Fetch wind resource from Open-Meteo. Falls back to stub on error."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Use 1-month sample for speed, extrapolate to annual
            resp = await client.get(
                "https://archive-api.open-meteo.com/v1/archive",
                params={
                    "latitude": req.lat, "longitude": req.lng,
                    "start_date": "2020-01-01", "end_date": "2020-12-31",
                    "daily": "wind_speed_100m_mean",
                    "timezone": "UTC",
                }
            )
            resp.raise_for_status()
            data = resp.json()

        daily = data.get("daily", {})
        dates = daily.get("time", [])
        wind_100m = daily.get("wind_speed_100m_mean", [])

        # Aggregate daily → monthly (km/h → m/s)
        monthly_kmh = _aggregate_monthly_avg(wind_100m, dates)
        monthly_speed_ms = [v / 3.6 for v in monthly_kmh]

        valid = [v for v in monthly_speed_ms if v > 0]
        mean_speed = sum(valid) / len(valid) if valid else 8.4

        k = 2.0
        c_weibull = mean_speed / 0.886
        rho = 1.225
        monthly_cubed = [v ** 3 for v in monthly_speed_ms]
        mean_cubed = sum(monthly_cubed) / 12 if monthly_cubed else mean_speed ** 3
        wpd = 0.5 * rho * mean_cubed

        resource_class, score = _classify_wind(wpd)

        return WindResourceResponse(
            lat=req.lat, lng=req.lng,
            mean_speed=round(mean_speed, 2),
            weibull_k=round(k, 2), weibull_c=round(c_weibull, 2),
            wind_power_density=round(wpd, 1),
            turbulence_intensity=0.11,
            resource_class=resource_class, score=round(score, 1),
            monthly_speed=[round(v, 1) for v in monthly_speed_ms],
        )
    except Exception:
        return WindResourceResponse(
            lat=req.lat, lng=req.lng,
            mean_speed=8.4, weibull_k=2.18, weibull_c=9.47,
            wind_power_density=432, turbulence_intensity=0.11,
            resource_class="I", score=88.6,
            monthly_speed=[9.1, 8.8, 8.9, 8.7, 8.2, 7.9, 7.8, 8.0, 8.3, 8.6, 9.0, 9.2],
        )
