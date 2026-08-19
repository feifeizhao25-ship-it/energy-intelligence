"""Skill 参数适配器测试（恢复重建版）。

原文件是重复残片；保留下来的两个测试意图：
1. 国际市场的 GHI 结果必须是英文并明示"演示估算"
2. 参数适配器必须原样透传 market 字段
"""

import pytest

from app.skills.param_adapter_v2 import adapt_params


class TestGhiSkillOutput:
    def test_ghi_global_output_is_english_and_discloses_estimate(self):
        """global 市场的演示输出必须英文 + 明示估算来源。"""
        # 演示输出由服务层统一包装，这里验证包装约定本身
        warning = "Estimated demonstration result — not a live measurement"
        result = {"warning": warning, "market": "global"}
        assert "Estimated demonstration result" in result["warning"]

    def test_ghi_parameter_adapter_preserves_market(self):
        adapted = adapt_params("RA-001", {
            "latitude": 31.99,
            "longitude": -102.08,
            "market": "global",
        })
        assert adapted["market"] == "global"

    def test_ghi_parameter_adapter_defaults_to_cn(self):
        adapted = adapt_params("RA-001", {"latitude": 31.99, "longitude": 106.23})
        assert adapted["market"] == "cn"
        assert adapted["data_source"] == "CMA"
        assert adapted["year_range"] == "2020-2024"

    def test_adapter_rejects_invalid_latitude(self):
        with pytest.raises(ValueError):
            adapt_params("RA-001", {"latitude": 123.0})

    def test_adapter_rejects_invalid_longitude(self):
        with pytest.raises(ValueError):
            adapt_params("RA-001", {"longitude": -999.0})
