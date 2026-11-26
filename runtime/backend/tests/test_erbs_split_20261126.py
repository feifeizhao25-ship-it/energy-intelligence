"""能13：没有法向实测时，用 Erbs 1982 分解水平面总辐射，不再用固定的 0.55/0.45。

复算（北京样本，月值来自 domestic_resources.json，单位 kWh/m2）：
- 输入：纬度 39.9，年水平面总辐射 1443.1，一月 72.4。
- 旧结果：DNI 1443.1*0.55=793.7，DHI 1443.1*0.45=649.4。
- 新结果：DHI 922.2，水平直射 520.8，正午余弦估算的 DNI 719.4。
- 正确值：DHI 以 Erbs–Klein–Duffie 1982 的 Kd(Kt) 为准。Kt=0.5 时 Kd=0.65915。
  一月 Kt=0.5505，Kd=0.5498，DHI=39.8，不是 72.4*0.45=32.6。
  DNI 没有实测序列，719.4 只是代表日正午的估算，不是法向实测。
- 依据：Erbs D.G., Klein S.A., Duffie J.A., Solar Energy 28(4):293-302, 1982；
  大气层外日辐射用 Duffie & Beckman 的水平面公式，取各月推荐代表日。
"""
import pytest

from app.services.domestic_resource import solar_response_fields
from app.services.erbs import diffuse_fraction, split_month


def test_kt_half_matches_the_published_polynomial():
    expected = 0.9511 - 0.1604 * 0.5 + 4.388 * 0.25 - 16.638 * 0.125 + 12.336 * 0.0625
    assert expected == pytest.approx(0.65915, abs=1e-4)
    assert diffuse_fraction(0.5) == pytest.approx(expected, abs=1e-6)


def test_beijing_january_is_not_the_fixed_split():
    month = split_month(72.4, 39.9, 0)
    assert month["kt"] == pytest.approx(0.5505, abs=1e-3)
    assert month["kd"] == pytest.approx(0.5498, abs=1e-3)
    assert month["dhi"] == pytest.approx(39.805, abs=0.02)
    assert month["dhi"] + month["beam_horizontal"] == pytest.approx(72.4, abs=1e-6)
    assert month["dhi"] != pytest.approx(72.4 * 0.45, abs=0.5)


def test_beijing_year_replaces_the_fixed_ratio():
    fields = solar_response_fields(39.9, 116.41)
    assert fields["ghi"] == pytest.approx(1443.1, abs=0.1)
    assert fields["dhi"] == pytest.approx(922.2, abs=0.2)
    assert fields["beam_horizontal"] == pytest.approx(520.8, abs=0.2)
    assert fields["dni"] == pytest.approx(719.4, abs=0.2)
    assert abs(fields["dni"] - 1443.1 * 0.55) > 10
    assert abs(fields["dhi"] - 1443.1 * 0.45) > 10
    assert fields["irradiance_model"] == "erbs-1982"
    assert "不是实测法向直接辐射" in fields["dni_note"]
