"""V30 技能边界与准确度测试（恢复重建版）。

原文件引用已丢失的 app.skills.v27_new_skills（SK-101 等 9 个技能）。
本版本对现存真实代码做等价验收：资源分级函数与参数适配器在
0 / 负值 / 极大值边界下不崩溃、不产出物理不可能值。
"""

import pytest

from app.services.resource_service import _classify_solar, _classify_wind
from app.skills.param_adapter_v2 import adapt_params


class TestClassificationEdgeCases:
    def test_solar_zero_ghi(self):
        cls, score = _classify_solar(0)
        assert cls == "IV"
        assert score == 0

    def test_solar_huge_ghi_capped(self):
        cls, score = _classify_solar(1e9)
        assert cls == "I"
        assert score <= 100

    def test_wind_zero_wpd(self):
        cls, score = _classify_wind(0)
        assert cls == "IV"
        assert score >= 0

    def test_wind_huge_wpd_capped(self):
        cls, score = _classify_wind(1e9)
        assert cls == "I"
        assert score <= 100


class TestAdapterEdgeCases:
    def test_zero_coordinates_accepted(self):
        adapted = adapt_params("RA-001", {"latitude": 0, "longitude": 0})
        assert adapted["latitude"] == 0

    def test_extreme_latitude_rejected(self):
        with pytest.raises(ValueError):
            adapt_params("RA-001", {"latitude": 1e9})

    def test_extreme_longitude_rejected(self):
        with pytest.raises(ValueError):
            adapt_params("RA-001", {"longitude": -1e9})

    def test_empty_params_get_defaults(self):
        adapted = adapt_params("RA-001", {})
        assert adapted["market"] == "cn"
        assert adapted["data_source"] == "CMA"
