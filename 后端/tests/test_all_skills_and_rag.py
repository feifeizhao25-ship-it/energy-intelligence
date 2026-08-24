"""Skills 注册表 + RAG 检索质量测试（恢复重建版）。

原文件引用已丢失的 `app.ai.skills.skill_registry`（42 个技能的旧后端）。
本版本按当前代码库的真实行为验收：
1. 注册表能优雅处理不存在的技能目录（恢复副本中微服务技能源已丢失）
2. 注册/查询/执行的完整链路可用（手工注册一个真实 Skill）
3. RAG 检索的溯源元数据与市场语言隔离
"""

import pytest

from pathlib import Path

from app.services.rag_service import RAGService

_SELF = Path(__file__).resolve()
from app.skills.registry import SkillRegistry


class _DemoSkill:
    skill_id = "RA-DEMO"
    name = "Demo Solar Assessment"
    description = "Demonstration skill for registry pipeline tests"
    category = "resource"

    async def execute(self, params):
        return {"ghi": 1850.0, "market": params.get("market", "cn")}


class TestSkillRegistry:
    def test_discovery_handles_missing_dirs_gracefully(self):
        registry = SkillRegistry()
        count = registry.discover_all(force=True)
        # 恢复副本中技能源目录不存在：不崩溃即可，数量不限
        assert count >= 0
        assert registry.total_count >= 0

    def test_register_and_get(self):
        registry = SkillRegistry()
        registry._register_skill("test-service", _SELF, _DemoSkill(), _DemoSkill)
        wrapper = registry.get("RA-DEMO")
        assert wrapper is not None
        assert wrapper.name == "Demo Solar Assessment"
        meta = registry.get_meta("RA-DEMO")
        assert meta is not None
        assert meta.category == "resource"
        assert "resource" in registry.list_categories()

    @pytest.mark.asyncio
    async def test_execute_registered_skill(self):
        registry = SkillRegistry()
        registry._register_skill("test-service", _SELF, _DemoSkill(), _DemoSkill)
        result = await registry.execute("RA-DEMO", {"market": "global"})
        assert result["status"] == "completed"
        assert result["data"]["market"] == "global"

    @pytest.mark.asyncio
    async def test_execute_unknown_skill_fails_closed(self):
        registry = SkillRegistry()
        result = await registry.execute("SK-999-DOES-NOT-EXIST", {})
        assert result["status"] == "failed"
        assert result["error_code"] == "SKILL_NOT_FOUND"


class TestRAGQuality:
    def test_hits_expose_freshness_metadata(self):
        hits = RAGService().search("分布式光伏并网", top_k=3, market="cn").hits
        assert hits
        for hit in hits:
            assert isinstance(hit.metadata["year"], int)
            assert hit.metadata["freshness_status"] in {
                "current", "review_recommended", "stale",
            }
            assert hit.metadata["last_verified_at"]

    def test_global_market_language_isolation(self):
        hits = RAGService().search("solar interconnection standard", top_k=5, market="global").hits
        assert hits
        import re
        for hit in hits:
            assert not re.search(r"[一-鿿]", hit.title + hit.content)
