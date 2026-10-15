"""审计 1-5：风能利用系数不得使用贝茨极限 0.59；空气密度按海拔修正。"""
import pytest

from app.utils.wind_calculations import BETZ_LIMIT, air_density_at, wind_power


def test_default_cp_is_realistic():
    p = wind_power(10, rotor_area=1000, air_density=1.225)
    assert p == pytest.approx(0.5 * 1.225 * 1000 * 1000 * 0.45 / 1000)


def test_cp_capped_at_betz():
    assert wind_power(10, 1000, 1.225, power_coefficient=0.9) == pytest.approx(
        0.5 * 1.225 * 1000 * 1000 * BETZ_LIMIT / 1000
    )


def test_air_density_by_elevation():
    assert air_density_at(0, 15) == pytest.approx(1.225)
    assert air_density_at(3000, 15) == pytest.approx(0.86, abs=0.01)
