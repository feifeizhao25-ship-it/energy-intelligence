"""Oracle 已知值测试 — 资源（RA-001/RA-002）与财务（FM-001/FM-002）技能。

每个技能 ≥3 组「已知输入 → 已知输出」手算基准，容差在注释中写明；
另验证 SkillRegistry 能发现四个技能且 execute 返回 completed。

手算基准说明：
- GHI 分级阈值：I≥2000, II≥1600, III≥1200, IV<1200（resource_service._classify_solar）
- 年等效利用小时 = GHI × PR（PR 中值 0.82，区间 0.78–0.86，IEC 61724）
- 风功率密度 WPD = 0.5 × 1.225 × v³；分级 I≥400/II≥300/III≥200/IV<200
- IRR([-100,60,60])：令 x=1/(1+r)，60x²+60x-100=0 即 3x²+3x-5=0，
  x=(-3+√69)/6=0.884437 → r=13.0662%（精确根，与实现一致）
- NPV(10%, [-100,60,60]) = -100 + 60/1.1 + 60/1.21 = 4.13
- LCOE 基准值由手算年金现值核对（见各用例注释）
"""

import importlib.util
import os
import sys
from pathlib import Path

import pytest

from app.skills.registry import SkillRegistry

PROJECT_ROOT = Path(__file__).resolve().parents[2]

SKILL_FILES = {
    "RA-001": "services/resource-service/app/skills/solar_resource.py",
    "RA-002": "services/resource-service/app/skills/wind_resource.py",
    "FM-001": "services/financial-service/app/skills/lcoe.py",
    "FM-002": "services/financial-service/app/skills/irr_npv.py",
}


def _load_skill_module(skill_id: str):
    """与注册表相同的加载方式：按文件路径加载技能模块。"""
    module_name = f"_oracle_test.{skill_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(
        module_name, str(PROJECT_ROOT / SKILL_FILES[skill_id])
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


solar_mod = _load_skill_module("RA-001")
wind_mod = _load_skill_module("RA-002")
lcoe_mod = _load_skill_module("FM-001")
irr_mod = _load_skill_module("FM-002")


# ── RA-001 太阳能资源评估 ────────────────────────────────────────────────────
class TestSolarResourceOracle:
    # 容差：分级/分数为精确值；小时数取整到 0.1；容量系数保留 4 位小数
    CASES = [
        # (ghi, 等级, 分数, 等效小时中值, cf中值, cf区间)
        (2200.0, "I", 64.0, 1804.0, 0.2059, (0.1959, 0.2160)),    # score=60+200/50
        (1800.0, "II", 50.0, 1476.0, 0.1685, (0.1603, 0.1767)),   # score=40+200/20
        (1400.0, "III", 30.0, 1148.0, 0.1311, (0.1247, 0.1374)),  # score=20+200/20
        (1000.0, "IV", 16.7, 820.0, 0.0936, (0.0890, 0.0982)),    # score=(1000/1200)*20
    ]

    @pytest.mark.parametrize(
        "ghi,cls,score,hours,cf,cf_range", CASES, ids=[str(c[0]) for c in CASES]
    )
    def test_known_ghi(self, ghi, cls, score, hours, cf, cf_range):
        result = solar_mod.assess_solar_resource(ghi, capacity_mw=100.0)
        assert result["resource_class"] == cls
        assert result["score"] == pytest.approx(score, abs=0.05)
        assert result["equivalent_hours"] == pytest.approx(hours, abs=0.05)
        assert result["capacity_factor"] == pytest.approx(cf, abs=0.0001)
        assert result["capacity_factor_range"] == pytest.approx(cf_range, abs=0.0001)
        # 100MW × 等效小时 = 年发电量 MWh
        assert result["annual_generation_mwh"] == pytest.approx(hours * 100, abs=1.0)

    async def test_execute_with_measured_ghi(self):
        skill = solar_mod.SolarResourceSkill()
        result = await skill.execute(
            {
                "latitude": 38.4872,
                "longitude": 106.2309,
                "capacity_mw": 100,
                "market": "cn",
                "ghi_annual_kwh_m2": 2200.0,
            }
        )
        assert result["resource_class"] == "I"
        assert result["engine"] == "measured_input"
        assert result["estimated"] is False
        assert result["references"]

    async def test_dev_fallback_is_labeled_estimate(self):
        async def unreachable(lat, lng):
            raise ConnectionError("offline")

        skill = solar_mod.SolarResourceSkill(fetcher=unreachable)
        result = await skill.execute(
            {"latitude": 38.5, "longitude": 106.2, "market": "cn"}
        )
        assert result["estimated"] is True
        assert result["engine"] == "heuristic_latitude_estimate"
        assert result["data_source"] == "estimate"
        assert "估算" in result["warning"]

    async def test_dev_fallback_warning_english_for_global(self):
        async def unreachable(lat, lng):
            raise ConnectionError("offline")

        skill = solar_mod.SolarResourceSkill(fetcher=unreachable)
        result = await skill.execute(
            {"latitude": 31.99, "longitude": -102.08, "market": "global"}
        )
        assert "Estimated demonstration result" in result["warning"]

    async def test_production_fail_closed(self, monkeypatch):
        async def unreachable(lat, lng):
            raise ConnectionError("offline")

        monkeypatch.setenv("ENVIRONMENT", "production")
        skill = solar_mod.SolarResourceSkill(fetcher=unreachable)
        with pytest.raises(RuntimeError, match="生产环境拒绝返回合成"):
            await skill.execute({"latitude": 38.5, "longitude": 106.2})


# ── RA-002 风能资源评估 ──────────────────────────────────────────────────────
class TestWindResourceOracle:
    # 容差：WPD/小时取整到 0.1；分数精确到 0.05（round 银行家舍入）
    CASES = [
        # (风速, wpd, 等级, 分数, cf中值, 等效小时, cf区间)
        # v=8:  wpd=0.5*1.225*512=313.6 → II(50+13.6); cf=0.25+(8-7)*0.05=0.30
        (8.0, 313.6, "II", 63.6, 0.30, 2628.0, (0.28, 0.32)),
        # v=10: wpd=612.5 → I(min(100,70+21.25)=91.25→91.2); cf=0.35+0.025=0.375
        (10.0, 612.5, "I", 91.2, 0.375, 3285.0, (0.3625, 0.3875)),
        # v=6:  wpd=132.3 → IV((132.3/200)*30=19.845→19.8); cf=0.15+0.05=0.20
        (6.0, 132.3, "IV", 19.8, 0.20, 1752.0, (0.185, 0.215)),
    ]

    @pytest.mark.parametrize(
        "v,wpd,cls,score,cf,hours,cf_range", CASES, ids=[str(c[0]) for c in CASES]
    )
    def test_known_wind_speed(self, v, wpd, cls, score, cf, hours, cf_range):
        result = wind_mod.assess_wind_resource(v, capacity_mw=50.0)
        assert result["wind_power_density"] == pytest.approx(wpd, abs=0.05)
        assert result["resource_class"] == cls
        assert result["score"] == pytest.approx(score, abs=0.05)
        assert result["capacity_factor"] == pytest.approx(cf, abs=0.0001)
        assert result["equivalent_hours"] == pytest.approx(hours, abs=0.5)
        assert result["capacity_factor_range"] == pytest.approx(cf_range, abs=0.0001)
        assert result["annual_generation_mwh"] == pytest.approx(hours * 50, abs=1.0)

    async def test_execute_with_measured_speed(self):
        skill = wind_mod.WindResourceSkill()
        result = await skill.execute(
            {
                "latitude": 42.0,
                "longitude": 111.0,
                "capacity_mw": 50,
                "market": "cn",
                "mean_speed_ms": 8.0,
            }
        )
        assert result["resource_class"] == "II"
        assert result["engine"] == "measured_input"
        assert result["estimated"] is False

    async def test_dev_fallback_is_labeled_estimate(self):
        async def unreachable(lat, lng):
            raise ConnectionError("offline")

        skill = wind_mod.WindResourceSkill(fetcher=unreachable)
        result = await skill.execute(
            {"latitude": 42.0, "longitude": 111.0, "market": "cn"}
        )
        assert result["estimated"] is True
        assert result["engine"] == "heuristic_estimate"
        assert result["data_source"] == "estimate"
        assert "估算" in result["warning"]

    async def test_production_fail_closed(self, monkeypatch):
        async def unreachable(lat, lng):
            raise ConnectionError("offline")

        monkeypatch.setenv("ENVIRONMENT", "production")
        skill = wind_mod.WindResourceSkill(fetcher=unreachable)
        with pytest.raises(RuntimeError, match="生产环境拒绝返回合成"):
            await skill.execute({"latitude": 42.0, "longitude": 111.0})


# ── FM-001 LCOE ──────────────────────────────────────────────────────────────
class TestLcoeOracle:
    async def _run(self, **params):
        return await lcoe_mod.LcoeSkill().execute(params)

    async def test_case_1(self):
        # 手算：PV成本=1e6+20000×9.8181(8%,20年年金)=1,196,363
        # PV电量=1.5e6×Σ(0.995/1.08)^t(t=1..20)=1.5e6×9.435≈14,152,000
        # LCOE≈0.0845，容差 ±0.0005（年金系数手算精度）
        result = await self._run(
            capex=1_000_000, opex_annual=20_000,
            annual_generation_kwh=1_500_000,
            discount_rate=0.08, project_life=20, degradation_rate=0.005,
        )
        assert result["lcoe"] == pytest.approx(0.0845, abs=0.0005)

    async def test_case_2_no_degradation(self):
        # 无衰减：PV电量=1.5e6×9.8181=14,727,220 → LCOE≈0.0812，容差 ±0.0005
        result = await self._run(
            capex=1_000_000, opex_annual=20_000,
            annual_generation_kwh=1_500_000,
            discount_rate=0.08, project_life=20, degradation_rate=0.0,
        )
        assert result["lcoe"] == pytest.approx(0.0812, abs=0.0005)

    async def test_case_3_low_discount_long_life(self):
        # 5%,25年：年金系数 14.0939 → PV成本≈1,281,879
        # Σ(0.995/1.05)^t≈13.3787 → PV电量≈20,068,000 → LCOE≈0.0639，容差 ±0.0005
        result = await self._run(
            capex=1_000_000, opex_annual=20_000,
            annual_generation_kwh=1_500_000,
            discount_rate=0.05, project_life=25, degradation_rate=0.005,
        )
        assert result["lcoe"] == pytest.approx(0.0639, abs=0.0005)

    async def test_generation_from_capacity(self):
        # 1MW × 8760h × cf 0.2 = 1,752,000 kWh/年，与直接给发电量等价
        by_capacity = await self._run(
            capex=1_000_000, opex_annual=20_000,
            capacity_mw=1.0, capacity_factor=0.2,
            discount_rate=0.08, project_life=20, degradation_rate=0.005,
        )
        direct = await self._run(
            capex=1_000_000, opex_annual=20_000,
            annual_generation_kwh=1_752_000,
            discount_rate=0.08, project_life=20, degradation_rate=0.005,
        )
        assert by_capacity["annual_generation_kwh"] == 1_752_000
        assert by_capacity["lcoe"] == direct["lcoe"]


# ── FM-002 IRR / NPV / 回收期 ────────────────────────────────────────────────
class TestIrrNpvOracle:
    async def _run(self, **params):
        return await irr_mod.IrrNpvSkill().execute(params)

    async def test_case_1(self):
        # IRR: 3x²+3x-5=0 → x=0.884437 → 13.0662%（精确根，容差 ±0.001）
        # NPV(10%)=4.13；静态回收=1+40/60=1.67 年
        result = await self._run(cashflows=[-100, 60, 60], discount_rate=0.1)
        assert result["irr_pct"] == pytest.approx(13.0662, abs=0.001)
        assert result["npv"] == pytest.approx(4.13, abs=0.005)
        assert result["payback_years"] == pytest.approx(1.67, abs=0.005)

    async def test_case_2(self):
        # IRR([-1000,400,400,400]): 年金系数=2.5 → r≈9.701%（容差 ±0.01）
        # NPV(8%)=-1000+400×2.5771=30.84
        result = await self._run(cashflows=[-1000, 400, 400, 400], discount_rate=0.08)
        assert result["irr_pct"] == pytest.approx(9.701, abs=0.01)
        assert result["npv"] == pytest.approx(30.84, abs=0.05)
        assert result["payback_years"] == pytest.approx(2.5, abs=0.005)

    async def test_case_3(self):
        # IRR([-500,200×4]): 年金系数=2.5(4年) → r≈21.86%（容差 ±0.01）
        # 回收=3+100/200... 累计: -500,-300,-100,100 → 2+100/200=2.5 年
        result = await self._run(
            cashflows=[-500, 200, 200, 200, 200], discount_rate=0.08
        )
        assert result["irr_pct"] == pytest.approx(21.8623, abs=0.01)
        assert result["payback_years"] == pytest.approx(2.5, abs=0.005)

    async def test_discounted_payback(self):
        # 折现回收(10%): 累计 -100, -45.45, +4.13 → 1+45.4545/49.5868=1.92
        result = await self._run(cashflows=[-100, 60, 60], discount_rate=0.1)
        assert result["discounted_payback_years"] == pytest.approx(1.92, abs=0.01)

    async def test_no_payback_returns_none(self):
        result = await self._run(cashflows=[-1000, 100, 100], discount_rate=0.08)
        assert result["payback_years"] is None

    async def test_cashflows_from_project_params(self):
        result = await self._run(
            capacity_mw=10, capex_per_w=0.8, opex_per_kw_yr=12,
            electricity_price=0.4, capacity_factor=0.22, itc_rate=0.0,
            debt_ratio=0.0, tax_rate=0.25, project_life=20,
        )
        assert len(result["cashflows"]) == 21
        assert result["engine"] == "financial_utils.build_solar_cashflows"
        assert result["irr_pct"] is not None


# ── 注册表发现与执行 ─────────────────────────────────────────────────────────
class TestRegistryDiscovery:
    @pytest.fixture(scope="class")
    def registry(self):
        reg = SkillRegistry()
        reg.discover_all(force=True)
        return reg

    @pytest.mark.parametrize("skill_id", sorted(SKILL_FILES))
    def test_skill_discovered(self, registry, skill_id):
        wrapper = registry.get(skill_id)
        assert wrapper is not None, f"注册表未发现 {skill_id}"
        meta = registry.get_meta(skill_id)
        assert meta is not None
        assert meta.name
        assert meta.description

    @pytest.mark.parametrize("skill_id", sorted(SKILL_FILES))
    def test_skill_has_references(self, skill_id):
        module = _load_skill_module(skill_id)
        skill_classes = [
            obj for obj in vars(module).values()
            if isinstance(obj, type) and getattr(obj, "skill_id", None) == skill_id
        ]
        assert skill_classes, f"{skill_id} 技能类未找到"
        references = getattr(skill_classes[0], "references", None)
        assert references, f"{skill_id} 缺少 references 类属性（公式/阈值出处）"

    async def test_execute_ra001_via_registry(self, registry):
        result = await registry.execute(
            "RA-001",
            {
                "latitude": 38.4872,
                "longitude": 106.2309,
                "capacity_mw": 100,
                "market": "cn",
                "ghi_annual_kwh_m2": 2200.0,
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["resource_class"] == "I"

    async def test_execute_ra002_via_registry(self, registry):
        result = await registry.execute(
            "RA-002",
            {
                "latitude": 42.0,
                "longitude": 111.0,
                "capacity_mw": 50,
                "market": "cn",
                "mean_speed_ms": 8.0,
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["resource_class"] == "II"

    async def test_execute_fm001_via_registry(self, registry):
        result = await registry.execute(
            "FM-001",
            {
                "capex": 1_000_000,
                "opex_annual": 20_000,
                "annual_generation_kwh": 1_500_000,
                "discount_rate": 0.08,
                "project_life": 20,
                "degradation_rate": 0.005,
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["lcoe"] == pytest.approx(0.0845, abs=0.0005)

    async def test_execute_fm002_via_registry(self, registry):
        result = await registry.execute(
            "FM-002", {"cashflows": [-100, 60, 60], "discount_rate": 0.1}
        )
        assert result["status"] == "completed"
        assert result["data"]["irr_pct"] == pytest.approx(13.0662, abs=0.001)
