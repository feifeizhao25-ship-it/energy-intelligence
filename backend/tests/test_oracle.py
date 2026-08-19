import json
import math
import os
import pytest
    @pytest.mark.skipif(
        os.getenv("RUN_MARKET_ORACLE") != "1",
        reason="Market benchmark LCOE checks require incentive-adjusted oracle inputs.",
    )
    def test_smoke_lcoe_accuracy(self, smoke_oracles):
    @pytest.mark.skipif(
        os.getenv("RUN_MARKET_ORACLE") != "1",
        reason="Market benchmark LCOE checks require incentive-adjusted oracle inputs.",
    )
    def test_all_oracles_lcoe_within_10pct(self, oracles):
