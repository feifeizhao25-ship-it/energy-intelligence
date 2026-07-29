"""Oracle 已知值测试 v2 — 碳资产（CA-001）、储能配置（ST-001）、清洗排程（OM-001）。

每个技能 ≥3 组「已知输入 → 已知输出」手算基准，推导写在用例注释里；
另验证 market 双语输出键、生产环境 fail-closed、SkillRegistry 发现与执行。

手算基准说明：
- CA-001: 减排量 = 发电量 × 0.5366（生态环境部/统计局 2022 全国电力平均因子）
- ST-001 clear 曲线小时 7..18 出力分数 [0.1..0.5,0.5,0.5..0.1,0]，合计 3.5
  等效满发小时；cloudy = clear × 0.6（合计 2.1）
- OM-001: 最优间隔 N = sqrt(2C/(R·s/100))（financial_utils 实现）
"""

import importlib.util
import sys
from pathlib import Path

import pytest

from app.skills.registry import SkillRegistry

PROJECT_ROOT = Path(__file__).resolve().parents[2]

SKILL_FILES = {
    "CA-001": "services/monetization-service/app/skills/carbon_asset.py",
    "ST-001": "services/simulation-service/app/skills/storage_sizing.py",
    "OM-001": "services/diagnostic-service/app/skills/cleaning_schedule.py",
}


def _load_skill_module(skill_id: str):
    """与注册表相同的加载方式：按文件路径加载技能模块。"""
    module_name = f"_oracle_test_v2.{skill_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(
        module_name, str(PROJECT_ROOT / SKILL_FILES[skill_id])
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


carbon_mod = _load_skill_module("CA-001")
storage_mod = _load_skill_module("ST-001")
cleaning_mod = _load_skill_module("OM-001")


# ── CA-001 碳资产测算 ────────────────────────────────────────────────────────
class TestCarbonAssetOracle:
    async def _run(self, **params):
        return await carbon_mod.CarbonAssetSkill().execute(params)

    async def test_case_1_default_factor(self):
        # 10,000 MWh × 0.5366 = 5,366.0 tCO2
        # CCER [60,100] CNY/t → [321,960.0, 536,600.0] CNY
        result = await self._run(
            annual_generation_mwh=10_000, market="cn",
            ccer_price_low=60.0, ccer_price_high=100.0,
        )
        assert result["减排量_tCO2"] == pytest.approx(5366.0, abs=0.001)
        assert result["CCER潜在收益_CNY"]["下限"] == pytest.approx(321_960.0, abs=0.01)
        assert result["CCER潜在收益_CNY"]["上限"] == pytest.approx(536_600.0, abs=0.01)
        assert result["排放因子_tCO2每MWh"] == 0.5366
        assert "2022" in result["排放因子出处"]
        assert result["estimated"] is False

    async def test_case_2_override_factor(self):
        # 2,500 MWh × 0.5568（区域因子覆盖）= 1,392.0 tCO2
        # CCER [50,80] → [69,600.0, 111,360.0] CNY
        result = await self._run(
            annual_generation_mwh=2_500, market="cn",
            grid_emission_factor=0.5568,
            ccer_price_low=50.0, ccer_price_high=80.0,
        )
        assert result["减排量_tCO2"] == pytest.approx(1392.0, abs=0.001)
        assert result["CCER潜在收益_CNY"]["下限"] == pytest.approx(69_600.0, abs=0.01)
        assert result["CCER潜在收益_CNY"]["上限"] == pytest.approx(111_360.0, abs=0.01)

    async def test_case_3_offset_ratio(self):
        # 50,000 MWh × 0.5366 = 26,830.0 tCO2；年排放 20,000 → 抵消比 1.3415
        result = await self._run(
            annual_generation_mwh=50_000, market="cn",
            annual_emissions_tco2=20_000,
            ccer_price_low=60.0, ccer_price_high=100.0,
        )
        assert result["减排量_tCO2"] == pytest.approx(26_830.0, abs=0.001)
        assert result["抵消比例"] == pytest.approx(1.3415, abs=0.0001)

    async def test_case_4_cbam_global(self):
        # CBAM：嵌入排放 800 t × (1−0) × 85 EUR/t = 68,000 EUR
        result = await self._run(
            annual_generation_mwh=10_000, market="global",
            embedded_emissions_tco2=800.0, eu_ets_price_eur=85.0,
            ccer_price_low=60.0, ccer_price_high=100.0,
        )
        assert result["emission_reduction_tco2"] == pytest.approx(5366.0, abs=0.001)
        cbam = result["cbam_carbon_cost_eur"]
        assert cbam["cost_eur"] == pytest.approx(68_000.0, abs=0.01)

    async def test_case_5_cbam_free_allocation(self):
        # 免费配额 10%：800 × 0.9 × 85 = 61,200 EUR
        result = await self._run(
            annual_generation_mwh=10_000, market="global",
            embedded_emissions_tco2=800.0, eu_ets_price_eur=85.0,
            cbam_free_allocation_rate=0.1,
            ccer_price_low=60.0, ccer_price_high=100.0,
        )
        assert result["cbam_carbon_cost_eur"]["cost_eur"] == pytest.approx(
            61_200.0, abs=0.01
        )

    async def test_market_bilingual_keys(self):
        cn = await self._run(
            annual_generation_mwh=10_000, market="cn",
            ccer_price_low=60.0, ccer_price_high=100.0,
        )
        assert "减排量_tCO2" in cn and "CCER潜在收益_CNY" in cn
        assert "emission_reduction_tco2" not in cn

        en = await self._run(
            annual_generation_mwh=10_000, market="global",
            embedded_emissions_tco2=800.0, eu_ets_price_eur=85.0,
            ccer_price_low=60.0, ccer_price_high=100.0,
        )
        assert "emission_reduction_tco2" in en
        assert "ccer_potential_revenue_cny" in en
        assert "cbam_carbon_cost_eur" in en
        assert "减排量_tCO2" not in en

    async def test_production_fail_closed_missing_prices(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        with pytest.raises(RuntimeError, match="拒绝使用内置价格假设"):
            await self._run(annual_generation_mwh=10_000, market="cn")

    async def test_production_fail_closed_missing_ets_price(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        with pytest.raises(RuntimeError, match="eu_ets_price_eur"):
            await self._run(
                annual_generation_mwh=10_000, market="global",
                embedded_emissions_tco2=800.0,
                ccer_price_low=60.0, ccer_price_high=100.0,
            )

    async def test_dev_default_prices_labeled_estimate(self):
        result = await self._run(annual_generation_mwh=10_000, market="cn")
        assert result["estimated"] is True
        assert result["CCER潜在收益_CNY"]["价格区间假设_CNY每吨"] == [60.0, 100.0]
        assert "内置假设" in result["warning"]


# ── ST-001 储能容量配置 ──────────────────────────────────────────────────────
class TestStorageSizingOracle:
    async def _run(self, **params):
        return await storage_mod.StorageSizingSkill().execute(params)

    async def test_case_1_self_consumption_clear(self):
        # 100MW clear：日发电 D=350 MWh；负荷 240 MWh/日=10 MW/h 平坦
        # 小时 7..17 出力 ≥10 → 直接消纳 11×10=110；Δ=0.8×350−110=170
        # 充电=170/0.88=193.182；容量=193.182/0.9=214.646；功率=max富余=50−10=40
        result = await self._run(
            pv_capacity_mw=100, daily_profile="clear", daily_load_mwh=240,
            target="self_consumption", target_self_consumption=0.8,
            storage_cost_cny_per_kwh=1500.0, market="cn",
        )
        sizing = result["推荐储能"]
        assert sizing["功率_MW"] == pytest.approx(40.0, abs=0.001)
        assert sizing["容量_MWh"] == pytest.approx(214.646, abs=0.001)
        assert sizing["往返效率假设"] == 0.88
        assert sizing["达成自发自用比例"] == pytest.approx(0.8, abs=0.0001)
        assert sizing["直接消纳_MWh"] == pytest.approx(110.0, abs=0.001)
        dispatch = result["日调度模拟"]
        assert dispatch["充电量_MWh"] == pytest.approx(193.182, abs=0.001)
        assert dispatch["放电量_MWh"] == pytest.approx(170.0, abs=0.001)
        assert result["daily_generation_mwh"] == pytest.approx(350.0, abs=0.001)

    async def test_case_2_lower_target(self):
        # 同上但目标 0.6：Δ=0.6×350−110=100 → 充电 113.636，容量 126.263
        result = await self._run(
            pv_capacity_mw=100, daily_profile="clear", daily_load_mwh=240,
            target_self_consumption=0.6,
            storage_cost_cny_per_kwh=1500.0, market="cn",
        )
        sizing = result["推荐储能"]
        assert sizing["容量_MWh"] == pytest.approx(126.263, abs=0.001)
        assert result["日调度模拟"]["放电量_MWh"] == pytest.approx(100.0, abs=0.001)
        assert sizing["达成自发自用比例"] == pytest.approx(0.6, abs=0.0001)

    async def test_case_3_cloudy_profile(self):
        # cloudy：D=210 MWh，峰值出力 30MW；负荷 120 MWh/日=5 MW/h
        # 直接消纳 11×5=55；Δ=0.8×210−55=113 → 充电 128.409，容量 142.677
        # 功率 = 30−5 = 25 MW
        result = await self._run(
            pv_capacity_mw=100, daily_profile="cloudy", daily_load_mwh=120,
            target_self_consumption=0.8,
            storage_cost_cny_per_kwh=1500.0, market="cn",
        )
        sizing = result["推荐储能"]
        assert sizing["功率_MW"] == pytest.approx(25.0, abs=0.001)
        assert sizing["容量_MWh"] == pytest.approx(142.677, abs=0.001)
        assert result["daily_generation_mwh"] == pytest.approx(210.0, abs=0.001)
        assert result["日调度模拟"]["放电量_MWh"] == pytest.approx(113.0, abs=0.001)

    async def test_case_4_peak_shaving(self):
        # 削峰：峰值 30MW、限额 20MW、2h → 功率 10MW，放电 20 MWh
        # 充电 = 20/0.88 = 22.727；容量 = 22.727/0.9 = 25.253
        result = await self._run(
            pv_capacity_mw=100, daily_profile="clear",
            target="peak_shaving", peak_load_mw=30.0, grid_limit_mw=20.0,
            peak_hours=2, storage_cost_cny_per_kwh=1500.0, market="cn",
        )
        sizing = result["推荐储能"]
        assert sizing["功率_MW"] == pytest.approx(10.0, abs=0.001)
        assert sizing["容量_MWh"] == pytest.approx(25.253, abs=0.001)
        assert result["日调度模拟"]["充电量_MWh"] == pytest.approx(22.727, abs=0.001)
        assert result["日调度模拟"]["放电量_MWh"] == pytest.approx(20.0, abs=0.001)

    async def test_market_bilingual_keys(self):
        common = dict(
            pv_capacity_mw=100, daily_load_mwh=240,
            storage_cost_cny_per_kwh=1500.0,
        )
        cn = await self._run(market="cn", **common)
        assert "推荐储能" in cn and "日调度模拟" in cn
        assert "recommended_storage" not in cn

        en = await self._run(market="global", **common)
        assert "recommended_storage" in en and "daily_dispatch_simulation" in en
        assert "推荐储能" not in en

    async def test_production_fail_closed_missing_cost(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        with pytest.raises(RuntimeError, match="拒绝使用内置成本假设"):
            await self._run(pv_capacity_mw=100, daily_load_mwh=240, market="cn")

    async def test_dev_default_cost_labeled_estimate(self):
        result = await self._run(
            pv_capacity_mw=100, daily_load_mwh=240, market="cn"
        )
        assert result["estimated"] is True
        assert result["投资估算"]["成本假设_CNY每kWh"] == 1200.0
        assert "内置假设" in result["warning"]


# ── OM-001 组件清洗排程 ──────────────────────────────────────────────────────
class TestCleaningScheduleOracle:
    async def _run(self, **params):
        return await cleaning_mod.CleaningScheduleSkill().execute(params)

    async def test_case_1_high_dust(self):
        # high 积灰 0.5%/天；N=sqrt(2×450/(200×0.5/100))=sqrt(900)=30 天
        # 已积灰=5.0/0.5=10 天 → 30−10=20 天后 → 2026-01-01+20=2026-01-21
        # 挽回毛收益=200×5%×30=300.0；净=300−450=−150.0；置信度 0.75
        result = await self._run(
            dust_level="high", pr_loss_pct=5.0, rainfall_30d_mm=0,
            cleaning_cost=450.0, daily_revenue=200.0,
            as_of_date="2026-01-01", market="cn",
        )
        schedule = result["清洗排程"]
        assert schedule["最优清洗间隔_天"] == 30
        assert schedule["下次清洗建议日期"] == "2026-01-21"
        assert schedule["建议立即清洗"] is False
        assert schedule["预计挽回发电收益"] == pytest.approx(300.0, abs=0.01)
        assert schedule["扣除成本净收益"] == pytest.approx(-150.0, abs=0.01)
        assert schedule["置信度"] == pytest.approx(0.75, abs=0.001)

    async def test_case_2_explicit_soiling_rate(self):
        # 显式速率 0.2%/天；N=sqrt(2×800/(500×0.2/100))=sqrt(1600)=40 天
        # 已积灰=4.0/0.2=20 天 → 20 天后 → 2026-01-21
        # 毛收益=500×4%×40=800.0；净=800−800=0.0；置信度 0.90（显式速率）
        result = await self._run(
            soiling_rate_pct_per_day=0.2, pr_loss_pct=4.0, rainfall_30d_mm=5,
            cleaning_cost=800.0, daily_revenue=500.0,
            as_of_date="2026-01-01", market="cn",
        )
        schedule = result["清洗排程"]
        assert schedule["最优清洗间隔_天"] == 40
        assert schedule["下次清洗建议日期"] == "2026-01-21"
        assert schedule["预计挽回发电收益"] == pytest.approx(800.0, abs=0.01)
        assert schedule["扣除成本净收益"] == pytest.approx(0.0, abs=0.01)
        assert schedule["置信度"] == pytest.approx(0.90, abs=0.001)

    async def test_case_3_rain_natural_cleaning(self):
        # low 积灰 0.1%/天；降雨 30mm ≥20 → 有效损失=6.0×0.3=1.8%
        # N=sqrt(2×450/(200×0.1/100))=sqrt(4500)=67.08→67 天
        # 已积灰=1.8/0.1=18 天 → 67−18=49 天后 → 2026-02-19
        # 毛收益=200×1.8%×67=241.2；净=241.2−450=−208.8；置信度 0.75−0.15=0.60
        result = await self._run(
            dust_level="low", pr_loss_pct=6.0, rainfall_30d_mm=30,
            cleaning_cost=450.0, daily_revenue=200.0,
            as_of_date="2026-01-01", market="cn",
        )
        schedule = result["清洗排程"]
        assert schedule["最优清洗间隔_天"] == 67
        assert schedule["近期自然清洗"] is True
        assert schedule["有效累积损失_pct"] == pytest.approx(1.8, abs=0.0001)
        assert schedule["下次清洗建议日期"] == "2026-02-19"
        assert schedule["预计挽回发电收益"] == pytest.approx(241.2, abs=0.01)
        assert schedule["扣除成本净收益"] == pytest.approx(-208.8, abs=0.01)
        assert schedule["置信度"] == pytest.approx(0.60, abs=0.001)

    async def test_case_4_clean_now_when_overdue(self):
        # high 积灰，PR 衰减 15% → 已积灰 15/0.5=30 天 ≥ N=30 → 立即清洗
        # 毛收益=200×15%×30=900；净=900−450=450
        result = await self._run(
            dust_level="high", pr_loss_pct=15.0, rainfall_30d_mm=0,
            cleaning_cost=450.0, daily_revenue=200.0,
            as_of_date="2026-01-01", market="cn",
        )
        schedule = result["清洗排程"]
        assert schedule["建议立即清洗"] is True
        assert schedule["下次清洗建议日期"] == "2026-01-01"
        assert schedule["扣除成本净收益"] == pytest.approx(450.0, abs=0.01)

    async def test_market_bilingual_keys(self):
        common = dict(
            dust_level="high", pr_loss_pct=5.0,
            cleaning_cost=450.0, daily_revenue=200.0,
            as_of_date="2026-01-01",
        )
        cn = await self._run(market="cn", **common)
        assert "清洗排程" in cn
        assert "下次清洗建议日期" in cn["清洗排程"]
        assert "cleaning_schedule" not in cn

        en = await self._run(market="global", **common)
        assert "cleaning_schedule" in en
        assert "next_cleaning_date" in en["cleaning_schedule"]
        assert "confidence" in en["cleaning_schedule"]
        assert "清洗排程" not in en

    async def test_production_fail_closed_missing_costs(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        with pytest.raises(RuntimeError, match="拒绝使用内置运营假设"):
            await self._run(dust_level="high", pr_loss_pct=5.0, market="cn")

    async def test_dev_default_costs_labeled_estimate(self):
        result = await self._run(
            dust_level="high", pr_loss_pct=5.0, rainfall_30d_mm=0,
            as_of_date="2026-01-01", market="cn",
        )
        assert result["estimated"] is True
        assert "内置假设" in result["warning"]


# ── 注册表发现与执行 ─────────────────────────────────────────────────────────
class TestRegistryDiscoveryV2:
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

    async def test_execute_ca001_via_registry(self, registry):
        result = await registry.execute(
            "CA-001",
            {
                "annual_generation_mwh": 10_000, "market": "cn",
                "ccer_price_low": 60.0, "ccer_price_high": 100.0,
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["减排量_tCO2"] == pytest.approx(5366.0, abs=0.001)

    async def test_execute_st001_via_registry(self, registry):
        result = await registry.execute(
            "ST-001",
            {
                "pv_capacity_mw": 100, "daily_load_mwh": 240,
                "storage_cost_cny_per_kwh": 1500.0, "market": "cn",
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["推荐储能"]["容量_MWh"] == pytest.approx(
            214.646, abs=0.001
        )

    async def test_execute_om001_via_registry(self, registry):
        result = await registry.execute(
            "OM-001",
            {
                "dust_level": "high", "pr_loss_pct": 5.0,
                "cleaning_cost": 450.0, "daily_revenue": 200.0,
                "as_of_date": "2026-01-01", "market": "cn",
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["清洗排程"]["最优清洗间隔_天"] == 30
