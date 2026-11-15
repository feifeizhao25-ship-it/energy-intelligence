"""产品技能输出契约。缺字段不能当作完整技能结果。"""
from __future__ import annotations

FIELDS = ("skill_id", "version", "formula_ref", "inputs", "assumptions", "sources", "valid_range")


def attach(result, *, skill_id, formula_ref, inputs, assumptions, sources, valid_range, version="2026-10-27"):
    contract = {
        "skill_id": skill_id,
        "version": version,
        "formula_ref": formula_ref,
        "inputs": inputs,
        "assumptions": list(assumptions),
        "sources": list(sources),
        "valid_range": valid_range,
    }
    missing = [key for key in FIELDS if contract.get(key) in (None, "")]
    if missing:
        raise ValueError("skill contract missing: " + ",".join(missing))
    out = dict(result)
    out["contract"] = contract
    return out
