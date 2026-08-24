"""V3 技能准确度回归（恢复重建版）。

原文件引用已丢失的外部技能库目录（energy-intelligence-skills-v2-FINAL-405）。
本版本对现存真实分类逻辑做已知值回归：GHI/WPD 分级阈值。
"""

from app.services.resource_service import _classify_solar, _classify_wind


# (ghi, expected_class) — 分级阈值: I>2000, II 1600-2000, III 1200-1600, IV<1200
SOLAR_REGRESSION_CASES = [
    (2200, "I"),
    (2000, "I"),
    (1800, "II"),
    (1600, "II"),
    (1400, "III"),
    (1200, "III"),
    (800, "IV"),
]

# (wpd, expected_class) — 分级阈值: I>=400, II 300-400, III 200-300, IV<200
WIND_REGRESSION_CASES = [
    (500, "I"),
    (400, "I"),
    (350, "II"),
    (250, "III"),
    (100, "IV"),
]


def test_solar_classification_regression():
    for ghi, expected in SOLAR_REGRESSION_CASES:
        cls, score = _classify_solar(ghi)
        assert cls == expected, f"GHI {ghi} 分级错误: {cls} != {expected}"
        assert 0 <= score <= 100


def test_wind_classification_regression():
    for wpd, expected in WIND_REGRESSION_CASES:
        cls, score = _classify_wind(wpd)
        assert cls == expected, f"WPD {wpd} 分级错误: {cls} != {expected}"
        assert 0 <= score <= 100
