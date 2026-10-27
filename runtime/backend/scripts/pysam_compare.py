"""有 PySAM 时实测风电容量系数。没有安装或储能缺少调度曲线时不编造差值。"""
from __future__ import annotations

import json
import math
from pathlib import Path


def _gamma(z: float) -> float:
    g = 7
    p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
         -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
         1.5056327351493116e-7]
    if z < 0.5:
        return math.pi / (math.sin(math.pi * z) * _gamma(1 - z))
    z -= 1
    x = p[0]
    for i in range(1, g + 2):
        x += p[i] / (z + i)
    t = z + g + 0.5
    return math.sqrt(2 * math.pi) * (t ** (z + 0.5)) * math.exp(-t) * x


def _power(v: float, v_in: float, v_rated: float, v_out: float) -> float:
    if v < v_in or v >= v_out:
        return 0.0
    if v >= v_rated:
        return 1.0
    return min(1.0, max(0.0, (v ** 3 - v_in ** 3) / (v_rated ** 3 - v_in ** 3)))


def local_capacity_factor(v_avg=7.5, v_in=3.0, v_rated=12.0, v_out=25.0, k=2.0) -> float:
    c = v_avg / _gamma(1 + 1 / k)
    dv = 0.05
    total = 0.0
    speed = dv / 2
    while speed < 40:
        pdf = (k / c) * ((speed / c) ** (k - 1)) * math.exp(-((speed / c) ** k))
        total += _power(speed, v_in, v_rated, v_out) * pdf * dv
        speed += dv
    return total


def compare() -> dict:
    report = {
        "pysam_installed": False,
        "wind": None,
        "battery": {
            "compared": False,
            "reason": "未安装 PySAM，不给出放电量或平准化成本差值。",
        },
    }
    try:
        import PySAM.Windpower as windpower
    except ImportError:
        return report
    report["pysam_installed"] = True
    import PySAM
    rated_kw = 2000.0
    speeds = [index * 0.25 for index in range(0, 161)]
    power = [_power(speed, 3.0, 12.0, 25.0) * rated_kw for speed in speeds]
    model = windpower.default("WindPowerNone")
    model.Resource.wind_resource_model_choice = 1
    model.Resource.weibull_k_factor = 2
    model.Resource.weibull_reference_height = 80
    model.Resource.weibull_wind_speed = 7.5
    model.Turbine.wind_turbine_hub_ht = 80
    model.Turbine.wind_turbine_rotor_diameter = 90
    model.Turbine.wind_resource_shear = 0.0
    model.Turbine.wind_turbine_powercurve_windspeeds = speeds
    model.Turbine.wind_turbine_powercurve_powerout = power
    model.Farm.system_capacity = rated_kw
    model.Farm.wind_farm_xCoordinates = [0]
    model.Farm.wind_farm_yCoordinates = [0]
    model.Farm.wind_farm_wake_model = 0
    for key in list(model.Losses.export()):
        setattr(model.Losses, key, 0)
    model.execute()
    pysam_cf = float(model.Outputs.capacity_factor) / 100.0
    local_cf = local_capacity_factor()
    report["wind"] = {
        "pysam_version": getattr(PySAM, "__version__", ""),
        "config": "WindPowerNone",
        "weibull_k": 2,
        "weibull_mean_mps": 7.5,
        "hub_height_m": 80,
        "losses_zeroed": True,
        "local_capacity_factor": local_cf,
        "pysam_capacity_factor": pysam_cf,
        "relative_abs_diff": abs(pysam_cf - local_cf) / pysam_cf if pysam_cf else None,
    }
    report["battery"] = {
        "compared": False,
        "reason": "PySAM 储能默认算例在没有负荷和电价序列时放电量为 0。不为了凑差值编造调度曲线，因此不报告年放电量或平准化成本差。",
    }
    return report


def main():
    report = compare()
    target = Path(__file__).resolve().parents[1] / "data" / "eval" / "pysam_compare.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("pysam_installed", "wind", "battery")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
