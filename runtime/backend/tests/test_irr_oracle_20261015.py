"""1-4：calc_irr 与 numpy-financial 外部基准一致；多解/无解返回 None。"""
import json
from pathlib import Path

import pytest

from app.utils.financial_utils import calc_irr

ORACLE = json.loads((Path(__file__).parent / "fixtures" / "irr_oracle_numpy_financial.json").read_text())


@pytest.mark.parametrize("case", ORACLE["cases"])
def test_matches_numpy_financial(case):
    assert abs(calc_irr(case["cashFlows"]) / 100 - case["irr"]) < 1e-6


@pytest.mark.parametrize("flows", ORACLE["noUniqueIrr"])
def test_no_unique_irr_returns_none(flows):
    assert calc_irr(flows) is None
