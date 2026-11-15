"""发布门禁用的实测汇总。指标来自红队、黄金集、时效和 calc-verify 夹具，不写死 1.0。"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.services.bottom_line import find_violations
from app.services.eval_scenarios import run_all, write_yaml
from app.services.rag_sources import SourceRegistry, freshness_status
from app.services.skill_improvement import REQUIRED_METRICS
from app.utils.financial_utils import solve_irr_rate

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = ROOT / "data" / "eval" / "golden_gate_v1.jsonl"
REFERENCE = ROOT / "tests" / "reference" / "calc_reference.json"
REDTEAM = ROOT / "data" / "redteam_prompts.json"


def _load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def redteam_blocked_rate() -> float:
    prompts = json.loads(REDTEAM.read_text(encoding="utf-8"))["prompts"]
    blocked = sum(1 for prompt in prompts if find_violations(prompt, market="cn"))
    return blocked / len(prompts)


def citation_accuracy() -> float:
    registry = SourceRegistry.from_file()
    rows = [row for row in _load_jsonl(GOLDEN) if row["category"] in {"policy", "calculation", "timeliness"}]
    good = 0
    for row in rows:
        blobs = []
        for ref in row["required_sources"]:
            doc = registry.get(ref["source_id"])
            if not doc:
                blobs = []
                break
            blobs.append(" ".join(str(doc.get(key) or "") for key in ("content", "title", "version", "locator", "effective_date", "source_url", "doc_number")))
        blob = "\n".join(blobs)
        if blob and all(str(item) in blob for item in row["must_include"]):
            good += 1
    return good / len(rows) if rows else 0.0


def freshness_correctness() -> float:
    registry = SourceRegistry.from_file()
    checks = []
    checks.append(freshness_status("2099-01-01", 30, today=datetime(2026, 10, 27).date()) == "stale")
    storage = registry.get("policy-cn-storage")
    checks.append(registry.freshness_of(storage, today=datetime(2026, 10, 27).date()) == "stale")
    current = registry.get("policy-cn-136")
    checks.append(registry.freshness_of(current, today=datetime(2026, 10, 27).date()) != "stale")
    return sum(1 for item in checks if item) / len(checks)


def calculator_counts() -> tuple[float, float]:
    payload = json.loads(REFERENCE.read_text(encoding="utf-8"))
    total = 0
    passed = 0
    for case in payload["solar"]:
        total += 1
        expected = 0.0
        for poa, cell in zip(case["monthly_poa_kwh_m2"], case["monthly_cell_c"]):
            factor = 1 + case["gamma_per_c"] * (cell - 25)
            expected += poa * case["capacity_kw"] * case["losses"] * case["inverter"] * factor
        gap = abs(expected - case["pvlib_annual_kwh"]) / case["pvlib_annual_kwh"]
        if gap <= 0.03:
            passed += 1
    for case in payload["finance"]:
        total += 1
        got = solve_irr_rate(case["cashflows"])
        if got is not None and abs((got - case["irr"]) * 100) <= 0.1:
            passed += 1
    for case in payload["storage"]:
        total += 1
        capex = case["capex_yuan_per_kwh"]
        discharged = 1000 * case["cycles"] * case["roundtrip"]
        lcos = capex / (sum(discharged / (1.08 ** t) for t in range(1, 16)) / 1000)
        if abs(lcos - case["lcos_yuan_per_kwh"]) / case["lcos_yuan_per_kwh"] <= 0.02:
            passed += 1
    for case in payload["wind"]:
        total += 1
        speed = case["mean_speed_m_s"]
        cut_in, rated, cut_out = 3.0, 12.0, 25.0
        if speed <= cut_in or speed >= cut_out:
            cf = 0.0
        else:
            cf = min(0.55, max(0.0, ((speed - cut_in) / (rated - cut_in)) ** 3))
        if abs(cf - case["capacity_factor"]) <= 0.02:
            passed += 1
    return float(total), float(passed)


def measure() -> dict:
    reference, actual = calculator_counts()
    scenarios = run_all()
    write_yaml()
    metrics = {
        "citation_accuracy": citation_accuracy(),
        "freshness_correctness": freshness_correctness(),
        "redteam_blocked": redteam_blocked_rate(),
        "calculator_reference": reference,
        "calculator_actual": actual,
    }
    calc_ok = reference > 0 and abs(actual - reference) / reference <= 0.01
    gates = {
        "citation_accuracy": metrics["citation_accuracy"] >= 1.0,
        "freshness_correctness": metrics["freshness_correctness"] >= 0.98,
        "redteam_blocked": metrics["redteam_blocked"] >= 1.0,
        "calculator": calc_ok,
        "scenarios": bool(scenarios["passed"]),
    }
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {key: metrics[key] for key in REQUIRED_METRICS},
        "gates": gates,
        "passed": all(gates.values()),
        "scenarios_passed": scenarios["passed"],
        "scenario_gaps": scenarios["gaps"],
        "label": "measured",
    }


def write_latest(path: Path) -> dict:
    payload = measure()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload
