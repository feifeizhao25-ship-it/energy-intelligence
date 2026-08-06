"""Oracle 已知值测试 v3 — 发电模拟（GS-050/F-050）、政策追踪（KA-070/F-070）、
项目报告生成（RP-090/F-090），以及 F 编号别名注册（任务 1）。

每个技能 ≥3 组「已知输入 → 已知输出」手算基准，推导写在用例注释里；
另验证 F 编号别名查找、impact_score 阈值（>0.7 → alert）、market 双语分支、
生产环境 fail-closed、SkillRegistry 按 F 编号发现全部 5 个首发技能。

手算基准说明：
- GS-050 光伏：月发电量 = 装机 × 月 GHI × PR；CF = 年发电量 / (装机 × 8760)
- GS-050 风电：P = 额定 × (v − 切入)/(额定风速 − 切入)，月电量 = P × 当月小时
- KA-070：impact = 0.45×补贴 + 0.35×并网 + 0.20×消纳（命中相加）
- RP-090：metrics 手算见 test_case_metrics_hand_calc 注释
"""

import importlib.util
import sys
from pathlib import Path

import pytest

from app.skills.registry import SkillRegistry

PROJECT_ROOT = Path(__file__).resolve().parents[2]

SKILL_FILES = {
    "GS-050": "services/simulation-service/app/skills/generation_simulation.py",
    "KA-070": "services/knowledge-service/app/skills/policy_tracker.py",
    "RP-090": "services/report-service/app/skills/report_generation.py",
}

ALIASES = {"GS-050": "F-050", "KA-070": "F-070", "RP-090": "F-090"}

# 运营规格首发 5 技能：F 编号 → 允许解析到的技术 skill_id
LAUNCH_SKILLS = {
    "F-001": {"RA-001"},
    "F-040": {"FM-001", "FM-002"},
    "F-050": {"GS-050"},
    "F-070": {"KA-070"},
    "F-090": {"RP-090"},
}

_LLM_KEY_ENVS = (
    "DASHSCOPE_API_KEY", "DEEPSEEK_API_KEY", "GLM_API_KEY",
    "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
)


def _load_skill_module(skill_id: str):
    """与注册表相同的加载方式：按文件路径加载技能模块。"""
    module_name = f"_oracle_test_v3.{skill_id.replace('-', '_')}"
    spec = importlib.util.spec_from_file_location(
        module_name, str(PROJECT_ROOT / SKILL_FILES[skill_id])
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


generation_mod = _load_skill_module("GS-050")
policy_mod = _load_skill_module("KA-070")
report_mod = _load_skill_module("RP-090")


def _no_llm(monkeypatch):
    for env in _LLM_KEY_ENVS:
        monkeypatch.delenv(env, raising=False)


# ── GS-050 发电量模拟 ────────────────────────────────────────────────────────
class TestGenerationSimulationOracle:
    async def _run(self, **params):
        return await generation_mod.GenerationSimulationSkill().execute(params)

    async def test_case_1_solar_uniform_monthly(self):
        # 10MW × 100 kWh/m²/月 × PR 0.8 = 800 MWh/月；年 9600 MWh
        # CF = 9600 / (10 × 8760) = 0.109589...
        result = await self._run(
            project_type="solar_pv", capacity_mw=10,
            ghi_monthly_kwh_m2=[100.0] * 12, performance_ratio=0.8,
        )
        assert result["monthly_generation_mwh"] == [800.0] * 12
        assert result["annual_generation_mwh"] == pytest.approx(9600.0, abs=0.001)
        assert result["capacity_factor"] == pytest.approx(0.1096, abs=0.0001)
        assert result["estimated"] is False

    async def test_case_2_solar_varying_monthly(self):
        # 50MW，逐月 GHI 合计 1530；PR 0.82
        # 1 月 = 50 × 80 × 0.82 = 3280；年 = 50 × 1530 × 0.82 = 62730
        # CF = 62730 / (50 × 8760) = 0.14322
        ghi = [80, 90, 110, 130, 150, 170, 180, 175, 150, 120, 95, 80]
        assert sum(ghi) == 1530
        result = await self._run(
            capacity_mw=50, ghi_monthly_kwh_m2=ghi, performance_ratio=0.82,
        )
        assert result["monthly_generation_mwh"][0] == pytest.approx(3280.0, abs=0.001)
        assert result["annual_generation_mwh"] == pytest.approx(62730.0, abs=0.001)
        assert result["capacity_factor"] == pytest.approx(0.1432, abs=0.0001)

    async def test_case_3_solar_system_loss_equivalent(self):
        # system_loss 0.18 → PR = 0.82：年 = 20 × 1200 × 0.82 = 19680 MWh
        result = await self._run(
            capacity_mw=20, ghi_monthly_kwh_m2=[100.0] * 12, system_loss=0.18,
        )
        assert result["annual_generation_mwh"] == pytest.approx(19680.0, abs=0.001)
        assert "system_loss" in result["engine"]
        assert result["estimated"] is False

    async def test_case_4_solar_annual_split_dev_estimate(self):
        # 开发环境年值均匀拆分：月 GHI = 1825 × 天数/365 → 1 月 = 155（=5×31）
        # 1 月电量 = 10 × 155 × 0.8 = 1240 MWh；年 = 10 × 1825 × 0.8 = 14600
        result = await self._run(
            capacity_mw=10, ghi_annual_kwh_m2=1825.0, performance_ratio=0.8,
        )
        assert result["monthly_generation_mwh"][0] == pytest.approx(1240.0, abs=0.001)
        assert result["annual_generation_mwh"] == pytest.approx(14600.0, abs=0.01)
        assert result["estimated"] is True
        assert "uniform_annual_split" in result["engine"]
        assert "warning" in result

    async def test_case_5_wind_power_curve_ramp(self):
        # 3MW，v=8 m/s，切入 3 / 额定 12：P = 3 × (8−3)/(12−3) = 5/3 MW
        # 年 = 5/3 × 8760 = 14600 MWh；CF = 5/9 ≈ 0.5556
        # 1 月 = 5/3 × 744 = 1240 MWh
        result = await self._run(
            project_type="wind", capacity_mw=3, wind_speed_ms=8.0,
        )
        assert result["monthly_generation_mwh"][0] == pytest.approx(1240.0, abs=0.001)
        assert result["annual_generation_mwh"] == pytest.approx(14600.0, abs=0.001)
        assert result["capacity_factor"] == pytest.approx(0.5556, abs=0.0001)

    async def test_case_6_wind_rated_and_below_cut_in(self):
        # v=15 ≥ 额定 12 → 满发：年 = 3 × 8760 = 26280，CF = 1.0
        rated = await self._run(project_type="wind", capacity_mw=3, wind_speed_ms=15.0)
        assert rated["annual_generation_mwh"] == pytest.approx(26280.0, abs=0.001)
        assert rated["capacity_factor"] == pytest.approx(1.0, abs=0.0001)
        # v=2 < 切入 3 → 0
        below = await self._run(project_type="wind", capacity_mw=3, wind_speed_ms=2.0)
        assert below["annual_generation_mwh"] == 0.0
        assert below["capacity_factor"] == 0.0

    async def test_case_7_wind_monthly_speeds(self):
        # 月均风速 [10]*6+[4]*6，3MW：P(10)=3×7/9=7/3，P(4)=3×1/9=1/3
        # 1 月 = 7/3×744 = 1736；7 月 = 1/3×744 = 248
        result = await self._run(
            project_type="wind", capacity_mw=3,
            wind_speed_monthly_ms=[10.0] * 6 + [4.0] * 6,
        )
        assert result["monthly_generation_mwh"][0] == pytest.approx(1736.0, abs=0.001)
        assert result["monthly_generation_mwh"][6] == pytest.approx(248.0, abs=0.001)

    async def test_production_fail_closed_default_pr(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        with pytest.raises(RuntimeError, match="内置 PR 假设"):
            await self._run(capacity_mw=10, ghi_monthly_kwh_m2=[100.0] * 12)

    async def test_production_fail_closed_annual_split(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        with pytest.raises(RuntimeError, match="逐月 GHI"):
            await self._run(
                capacity_mw=10, ghi_annual_kwh_m2=1825.0, performance_ratio=0.8,
            )

    async def test_missing_resource_params(self):
        with pytest.raises(ValueError, match="ghi"):
            await self._run(capacity_mw=10, performance_ratio=0.8)
        with pytest.raises(ValueError, match="wind_speed"):
            await self._run(project_type="wind", capacity_mw=3)


# ── KA-070 政策追踪 ──────────────────────────────────────────────────────────
class TestPolicyTrackerOracle:
    async def _run(self, **params):
        return await policy_mod.PolicyTrackerSkill().execute(params)

    async def test_case_1_subsidy_only_cn(self):
        # 仅命中补贴类：impact = 0.45 ≤ 0.7 → alert=False
        # 生效日期「自2026年3月1日起施行」→ 2026-03-01；适用技术 = solar_pv
        text = (
            "关于促进光伏产业健康发展的通知。自2026年3月1日起施行。"
            "对分布式光伏项目给予度电补贴0.1元/千瓦时，上网电价按标杆电价执行。"
        )
        result = await self._run(
            policy_text=text, metadata={"title": "光伏补贴通知"}, market="cn",
        )
        assert result["impact_score"] == pytest.approx(0.45, abs=0.0001)
        assert result["alert"] is False
        assert result["适用技术"] == ["solar_pv"]
        assert result["生效日期"] == "2026-03-01"
        assert len(result["补贴电价要点"]) >= 1
        assert "applicable_technologies" not in result
        assert isinstance(result["相关政策佐证"], list)

    async def test_case_2_subsidy_plus_grid_alert(self):
        # 补贴 + 并网：impact = 0.45 + 0.35 = 0.80 > 0.7 → alert=True
        text = (
            "国家能源局关于光伏电站并网管理的规定：自2026年6月1日起实施。"
            "全面取消补贴，新增项目须完成电网接入评审后方可并网。"
        )
        result = await self._run(policy_text=text, market="cn")
        assert result["impact_score"] == pytest.approx(0.80, abs=0.0001)
        assert result["alert"] is True
        assert result["impact_categories"] == {
            "subsidy": True, "grid": True, "consumption": False,
        }
        assert result["生效日期"] == "2026-06-01"

    async def test_case_3_consumption_only(self):
        # 仅消纳：impact = 0.20 → alert=False；适用技术 = wind
        text = "建立风电消纳监测预警机制，保障性收购电量按消纳权重分摊。"
        result = await self._run(policy_text=text, market="cn")
        assert result["impact_score"] == pytest.approx(0.20, abs=0.0001)
        assert result["alert"] is False
        assert result["适用技术"] == ["wind"]

    async def test_case_4_all_three_categories(self):
        # 三类全中：impact = 0.45+0.35+0.20 = 1.00 → alert=True
        text = (
            "自2026年1月1日起施行：新能源上网电价补贴退坡，"
            "并网项目须符合电网接入技术规范，消纳责任权重按年度考核。"
        )
        result = await self._run(policy_text=text, market="cn")
        assert result["impact_score"] == pytest.approx(1.0, abs=0.0001)
        assert result["alert"] is True

    async def test_case_5_english_keys_and_score(self):
        # 英文文本 → 英文键；tariff + grid connection + curtailment 全中 → 1.0
        text = (
            "The federal solar tariff adjustment ends the feed-in subsidy. "
            "New projects require grid connection approval effective 2026-07-01. "
            "Curtailment rules add a consumption guarantee for wind farms."
        )
        result = await self._run(
            policy_text=text, metadata={"title": "Tariff Order"}, market="global",
        )
        assert result["impact_score"] == pytest.approx(1.0, abs=0.0001)
        assert result["alert"] is True
        assert "applicable_technologies" in result
        assert "solar_pv" in result["applicable_technologies"]
        assert "wind" in result["applicable_technologies"]
        assert result["effective_date"] == "2026-07-01"
        assert result["policy_title"] == "Tariff Order"
        assert "适用技术" not in result
        assert isinstance(result["related_policies"], list)

    async def test_case_6_threshold_boundary_no_alert(self):
        # 补贴 + 消纳 = 0.45 + 0.20 = 0.65 ≤ 0.7 → alert=False（阈值边界）
        text = "储能项目度电补贴政策延续，消纳责任权重纳入考核。"
        result = await self._run(policy_text=text, market="cn")
        assert result["impact_score"] == pytest.approx(0.65, abs=0.0001)
        assert result["alert"] is False

    async def test_production_fail_closed_no_llm(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        _no_llm(monkeypatch)
        with pytest.raises(RuntimeError, match="LLM"):
            await self._run(policy_text="关于光伏补贴的通知。", market="cn")

    async def test_dev_fallback_labeled(self, monkeypatch):
        _no_llm(monkeypatch)
        result = await self._run(policy_text="关于光伏补贴的通知。", market="cn")
        assert result["engine"] == "rule_based_fallback"
        assert result["estimated"] is True
        assert "warning" in result

    async def test_llm_configured_engine_label(self, monkeypatch):
        _no_llm(monkeypatch)
        monkeypatch.setenv("OPENAI_API_KEY", "test-key")
        result = await self._run(policy_text="关于光伏补贴的通知。", market="cn")
        assert result["engine"] == "rule_based+llm_available"
        assert result["estimated"] is False


# ── RP-090 项目报告生成 ──────────────────────────────────────────────────────
_PROJECT = {
    "name": "酒泉100MW光伏电站",
    "project_type": "solar_pv",
    "capacity_mw": 100.0,
    "country_code": "CN",
    "province_or_region": "甘肃省",
    "city": "酒泉市",
    "currency": "CNY",
    "financial": {
        "initial_investment": 360_000_000,
        "project_life_years": 25,
        "discount_rate": 0.08,
        "annual_generation_mwh": 165_000,
        "electricity_price": 0.32,
        "price_escalation_rate": 0.02,
        "opex_annual": 7_200_000,
        "opex_escalation_rate": 0.025,
    },
}


class TestReportGenerationOracle:
    async def _run(self, **params):
        return await report_mod.ReportGenerationSkill().execute(params)

    async def test_case_1_cn_docx_feasibility(self):
        result = await self._run(
            project=dict(_PROJECT), report_type="feasibility",
            market="cn", output_format="docx",
        )
        assert result["format"] == "docx"
        assert result["file_size_bytes"] > 10_000  # 真实 docx 不可能只有几 KB
        assert result["storage"]["filename"].endswith(".docx")
        assert result["storage"]["path"].startswith("generated_reports")
        assert result["template_name"] == "可行性研究报告"
        assert result["estimated"] is False
        assert result["engine"] == "reports.generate_docx"

    async def test_case_2_global_market_english_branch(self):
        result = await self._run(
            project=dict(_PROJECT), report_type="investment",
            market="global", output_format="docx",
        )
        assert result["template_name"] == "Investment Analysis Report"
        assert "Investment Analysis Report" in result["title"]
        assert result["file_size_bytes"] > 5_000
        assert result["estimated"] is False

    async def test_case_3_pdf_compliance(self):
        result = await self._run(
            project=dict(_PROJECT), report_type="compliance",
            market="cn", output_format="pdf",
        )
        assert result["format"] == "pdf"
        assert result["storage"]["filename"].endswith(".pdf")
        assert result["file_size_bytes"] > 5_000
        assert result["template_name"] == "合规报告"

    async def test_case_metrics_hand_calc(self):
        # 手算基准（calc_financial_metrics 的确定性计算）：
        # inv=2e6, 20 年, dr=0, 年发电 1000 MWh × 1.0 元/kWh = 1e6 收入,
        # opex 5e5 不递增 → 年净现金流 5e5
        # NPV(dr=0) = −2e6 + 20×5e5 = 8,000,000
        # 回收期 = 2e6/5e5 = 4 年；ROI = 20×5e5/2e6 = 5.0
        # LCOE = (2e6 + 20×5e5) / (1000×1000 × Σ_{k=0..19} 1.005^k)
        #      = 1.2e7 / (1e6 × 20.979115) ≈ 0.572
        project = dict(_PROJECT)
        project["financial"] = {
            "initial_investment": 2_000_000,
            "project_life_years": 20,
            "discount_rate": 0.0,
            "annual_generation_mwh": 1000,
            "electricity_price": 1.0,
            "price_escalation_rate": 0.0,
            "opex_annual": 500_000,
            "opex_escalation_rate": 0.0,
        }
        result = await self._run(
            project=project, report_type="feasibility", market="cn",
        )
        metrics = result["metrics"]
        assert metrics["npv"] == pytest.approx(8_000_000.0, abs=0.01)
        assert metrics["payback_years"] == 4
        assert metrics["roi"] == pytest.approx(5.0, abs=0.0001)
        assert metrics["lcoe"] == pytest.approx(0.572, abs=0.001)

    async def test_dev_demo_fallback_labeled(self):
        result = await self._run(project={}, report_type="feasibility", market="cn")
        assert result["estimated"] is True
        assert "demo_data_fallback" in result["engine"]
        assert "warning" in result
        assert result["file_size_bytes"] > 10_000

    async def test_production_fail_closed_missing_project(self, monkeypatch):
        monkeypatch.setenv("ENVIRONMENT", "production")
        with pytest.raises(RuntimeError, match="示例数据"):
            await self._run(project={}, report_type="feasibility", market="cn")

    async def test_production_fail_closed_missing_financial(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        with pytest.raises(RuntimeError, match="示例数据"):
            await self._run(
                project={"name": "X", "capacity_mw": 10},
                report_type="feasibility", market="cn",
            )

    async def test_invalid_report_type(self):
        with pytest.raises(ValueError, match="report_type"):
            await self._run(
                project=dict(_PROJECT), report_type="unknown", market="cn",
            )


# ── F 编号别名与注册表发现 ───────────────────────────────────────────────────
class TestAliasesAndRegistryV3:
    @pytest.fixture(scope="class")
    def registry(self):
        reg = SkillRegistry()
        reg.discover_all(force=True)
        return reg

    @pytest.mark.parametrize("skill_id,alias", sorted(ALIASES.items()))
    def test_skill_declares_alias(self, skill_id, alias):
        module = _load_skill_module(skill_id)
        skill_classes = [
            obj for obj in vars(module).values()
            if isinstance(obj, type) and getattr(obj, "skill_id", None) == skill_id
        ]
        assert skill_classes, f"{skill_id} 技能类未找到"
        aliases = getattr(skill_classes[0], "aliases", None)
        assert aliases and alias in aliases, f"{skill_id} 缺少别名 {alias}"

    @pytest.mark.parametrize("skill_id", sorted(SKILL_FILES))
    def test_skill_discovered(self, registry, skill_id):
        wrapper = registry.get(skill_id)
        assert wrapper is not None, f"注册表未发现 {skill_id}"
        meta = registry.get_meta(skill_id)
        assert meta is not None and meta.name and meta.description

    @pytest.mark.parametrize("skill_id,alias", sorted(ALIASES.items()))
    def test_alias_lookup(self, registry, skill_id, alias):
        wrapper = registry.get(alias)
        assert wrapper is not None, f"注册表按别名 {alias} 未找到 {skill_id}"
        meta = registry.get_meta(alias)
        assert meta is not None and meta.skill_id == skill_id

    def test_existing_skills_have_f_aliases(self):
        """任务 1：RA-001/FM-001/FM-002 已补 F 编号别名。"""
        checks = {
            "services/resource-service/app/skills/solar_resource.py": "F-001",
            "services/financial-service/app/skills/lcoe.py": "F-040",
            "services/financial-service/app/skills/irr_npv.py": "F-040",
        }
        for rel_path, alias in checks.items():
            spec = importlib.util.spec_from_file_location(
                "_oracle_test_v3.alias_" + Path(rel_path).stem,
                str(PROJECT_ROOT / rel_path),
            )
            module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = module
            spec.loader.exec_module(module)
            classes = [
                obj for obj in vars(module).values()
                if isinstance(obj, type) and getattr(obj, "skill_id", None)
            ]
            assert classes, f"{rel_path} 未找到技能类"
            assert any(
                alias in (getattr(cls, "aliases", None) or []) for cls in classes
            ), f"{rel_path} 缺少别名 {alias}"

    @pytest.mark.parametrize("f_code,expected", sorted(LAUNCH_SKILLS.items()))
    def test_registry_resolves_launch_f_codes(self, registry, f_code, expected):
        """注册表能按 F 编号 get 到全部 5 个首发技能。"""
        wrapper = registry.get(f_code)
        assert wrapper is not None, f"注册表按 {f_code} 未找到首发技能"
        meta = registry.get_meta(f_code)
        assert meta is not None
        assert meta.skill_id in expected, (
            f"{f_code} 解析到 {meta.skill_id}，期望 {sorted(expected)} 之一"
        )

    async def test_execute_gs050_via_f_alias(self, registry):
        result = await registry.execute(
            "F-050",
            {
                "capacity_mw": 10, "project_type": "solar_pv",
                "ghi_monthly_kwh_m2": [100.0] * 12, "performance_ratio": 0.8,
            },
        )
        assert result["status"] == "completed"
        assert result["data"]["annual_generation_mwh"] == pytest.approx(
            9600.0, abs=0.001
        )
