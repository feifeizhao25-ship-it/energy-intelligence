#!/usr/bin/env python3
"""离线生成 calc-verify 夹具。

光伏：用样本月辐照展开为逐时序列（不联网），pvlib 0.13 的 Perez 转置 + SAPM 温度 + PVWatts。
月均模型用同一序列的月合计与月平均电池温度，按 GB 50797 的 Ep = H_A × P_AZ × K。
风电与储能：PySAM 未安装时用解析式，并在夹具里标明 generator，不得当成实测发电量。
财务：numpy-financial。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import numpy_financial as npf
import pandas as pd
import pvlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "runtime" / "backend" / "tests" / "reference"
WEB_OUT = ROOT / "runtime" / "web" / "src" / "lib" / "calculator" / "__fixtures__"
RESOURCES = ROOT / "runtime" / "backend" / "data" / "domestic_resources.json"

GAMMA = -0.0034
ETA_INV = 0.96
LOSSES = 1.0  # 夹具里的其余损耗另计；与 pvwatts 对照时只保留温度和逆变器
P_AZ_KW = 100.0


def load_cities(n: int = 10) -> list[dict]:
    payload = json.loads(RESOURCES.read_text(encoding="utf-8"))
    wanted = ["北京", "天津", "上海", "南京", "杭州", "济南", "广州", "成都", "西安", "银川"]
    by_city = {row["city"]: row for row in payload["stations"]}
    return [by_city[name] for name in wanted[:n]]


def hourly_from_monthly(row: dict, year: int = 2023) -> pd.DataFrame:
    times = pd.date_range(f"{year}-01-01", f"{year}-12-31 23:00", freq="h", tz="Asia/Shanghai")
    month_daily = {i + 1: float(row["monthly_daily_ghi"][i]) for i in range(12)}
    loc = pvlib.location.Location(float(row["lat"]), float(row["lng"]), tz="Asia/Shanghai", altitude=0)
    solpos = loc.get_solarposition(times)
    clearsky = loc.get_clearsky(times)
    ghi_cs = clearsky["ghi"].astype(float)
    daily_cs = ghi_cs.groupby(ghi_cs.index.date).transform("sum")
    target_wh = pd.Series(times.month.map(month_daily).to_numpy() * 1000.0, index=times)
    scale = (target_wh / daily_cs.replace(0, np.nan)).fillna(0)
    frame = pd.DataFrame(index=times)
    frame["ghi"] = (ghi_cs * scale).astype(float)
    frame["zenith"] = solpos["apparent_zenith"].astype(float)
    frame["azimuth"] = solpos["azimuth"].astype(float)
    dni_extra = pvlib.irradiance.get_extra_radiation(times).astype(float)
    split = pvlib.irradiance.erbs(frame["ghi"], frame["zenith"], times)
    frame["dhi"] = split["dhi"].astype(float).fillna(0)
    frame["dni"] = split["dni"].astype(float).fillna(0)
    frame["dni_extra"] = dni_extra
    frame["temp_air"] = 15.0
    frame["wind"] = 1.0
    return frame


def pvlib_annual(frame: pd.DataFrame, tilt: float, azimuth: float) -> dict:
    airmass = pvlib.atmosphere.get_relative_airmass(frame["zenith"]).fillna(0).astype(float)
    poa = pvlib.irradiance.get_total_irradiance(
        tilt, azimuth, frame["zenith"], frame["azimuth"], frame["dni"], frame["ghi"], frame["dhi"],
        dni_extra=frame["dni_extra"], airmass=airmass, model="perez",
    )
    poa_global = poa["poa_global"].clip(lower=0).fillna(0)
    cell = pvlib.temperature.sapm_cell(poa_global, frame["temp_air"], frame["wind"], -3.47, -0.0594, 3)
    dc = pvlib.pvsystem.pvwatts_dc(poa_global, cell, P_AZ_KW * 1000, GAMMA)
    ac = pvlib.inverter.pvwatts(dc, pdc0=P_AZ_KW * 1000, eta_inv_nom=ETA_INV)
    ac = ac.fillna(0).clip(lower=0)
    monthly_poa = poa_global.groupby(poa_global.index.month).sum() / 1000.0  # kWh/m²
    weights = poa_global.groupby(poa_global.index.month).sum().replace(0, np.nan)
    monthly_cell = (cell * poa_global).groupby(poa_global.index.month).sum() / weights
    return {
        "annual_kwh": float(ac.sum() / 1000.0),
        "monthly_poa_kwh_m2": [float(monthly_poa.get(i, 0.0)) for i in range(1, 13)],
        "monthly_cell_c": [float(monthly_cell.get(i, 15.0)) for i in range(1, 13)],
    }


def monthly_model(reference: dict) -> float:
    total = 0.0
    for poa, cell in zip(reference["monthly_poa_kwh_m2"], reference["monthly_cell_c"]):
        temp_factor = 1 + GAMMA * (cell - 25.0)
        total += poa * P_AZ_KW * LOSSES * ETA_INV * temp_factor
    return total


def finance_cases() -> list[dict]:
    rows = []
    for i, years in enumerate((5, 8, 10, 12, 15, 20, 25, 10, 10, 6)):
        investment = 100000 + i * 5000
        annuity = investment * (0.12 + i * 0.005)
        flows = [-investment] + [annuity] * years
        ref = float(npf.irr(flows))
        rows.append({"id": f"irr-{i+1}", "cashflows": flows, "irr": ref})
    return rows


def wind_cases() -> list[dict]:
    rows = []
    for i in range(10):
        speed = 5 + i * 0.3
        # 瑞利分布（k=2）的容量系数近似：对一条线性功率曲线在切入到额定之间积分。
        cut_in, rated, cut_out = 3.0, 12.0, 25.0
        if speed <= cut_in or speed >= cut_out:
            cf = 0.0
        else:
            cf = min(0.55, max(0.0, ((speed - cut_in) / (rated - cut_in)) ** 3))
        rows.append({
            "id": f"wind-{i+1}",
            "mean_speed_m_s": speed,
            "weibull_k": 2,
            "assumption": "默认瑞利分布，解析容量系数，不是 PySAM 实测",
            "capacity_factor": cf,
            "generator": "analytical-rayleigh",
        })
    return rows


def storage_cases() -> list[dict]:
    rows = []
    for i in range(10):
        capex = 1500 + i * 50  # 元/kWh，示例造价，不是报价
        cycles = 300
        eta = 0.86
        life = 15
        discharged = 1000 * cycles * eta  # kWh/年，1 MWh 级按 1000 kWh 名义
        lcos = capex / (sum(discharged / (1.08 ** t) for t in range(1, life + 1)) / 1000)
        rows.append({
            "id": f"storage-{i+1}",
            "label": "示例数据",
            "capex_yuan_per_kwh": capex,
            "cycles": cycles,
            "roundtrip": eta,
            "lcos_yuan_per_kwh": lcos,
            "generator": "analytical-lcos",
            "note": "不是已核验电价，也不是 PySAM Battery 输出",
        })
    return rows


def main() -> None:
    solar = []
    gaps = []
    for row in load_cities():
        frame = hourly_from_monthly(row)
        for tilt, azimuth in ((row["lat"], 180), (20, 180), (30, 160)):
            if len([c for c in solar if c["city"] == row["city"]]) >= 3:
                break
            ref = pvlib_annual(frame, tilt, azimuth)
            monthly = monthly_model(ref)
            gap = abs(monthly - ref["annual_kwh"]) / ref["annual_kwh"] if ref["annual_kwh"] else 1
            gaps.append(gap)
            solar.append({
                "id": f"pv-{row['city']}-{int(tilt)}-{int(azimuth)}",
                "city": row["city"],
                "lat": row["lat"],
                "lng": row["lng"],
                "tilt": tilt,
                "azimuth": azimuth,
                "capacity_kw": P_AZ_KW,
                "gamma_per_c": GAMMA,
                "losses": LOSSES,
                "inverter": ETA_INV,
                "pvlib_annual_kwh": ref["annual_kwh"],
                "monthly_model_kwh": monthly,
                "relative_gap": gap,
                "monthly_poa_kwh_m2": ref["monthly_poa_kwh_m2"],
                "monthly_cell_c": ref["monthly_cell_c"],
                "label": "示例数据",
                "irradiance_note": "由离线月辐照样本展开的逐时序列，不是气象观测",
                "generator": "pvlib-0.13-perez-sapm-pvwatts",
            })
            if len(solar) >= 30:
                break
        if len(solar) >= 30:
            break
    payload = {
        "label": "示例数据",
        "pvlib": "0.13.1",
        "pysam": None,
        "pysam_note": "当前环境未安装 PySAM。风电与储能夹具为解析式，人工安装 PySAM 后应重跑本脚本替换。",
        "solar": solar,
        "finance": finance_cases(),
        "wind": wind_cases(),
        "storage": storage_cases(),
        "max_solar_gap": max(gaps) if gaps else None,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    WEB_OUT.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    (OUT / "calc_reference.json").write_text(text + "\n", encoding="utf-8")
    (WEB_OUT / "calc_reference.json").write_text(text + "\n", encoding="utf-8")
    print(f"solar {len(solar)} finance {len(payload['finance'])} wind 10 storage 10 max_gap {payload['max_solar_gap']}")


if __name__ == "__main__":
    main()
