"""
Skill 注册表 — 自动发现并注册分布在各微服务中的所有 Skill 实现

扫描路径:
A) services/*/app/skills/**/*.py   (新风格 — skill_id/name/description/category + async execute)
B) backend/skills/**/*.py          (旧风格 — SKILL_ID/SKILL_NAME/SKILL_DESCRIPTION + sync execute)

发现规则:
- 遍历每个 .py 文件中的所有类
- 新风格: skill_id + name + description + category + async execute
- 旧风格: SKILL_ID + SKILL_NAME + SKILL_DESCRIPTION + sync execute 或 execute_{module} 函数
"""

from __future__ import annotations

import asyncio
import importlib
import importlib.util
import inspect
import logging
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from app.skills.base import SkillMeta, SkillWrapper

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 项目根目录
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[3]  # backend/..  → 新能源智库/
_SERVICES_DIR = _PROJECT_ROOT / "services"
_BACKEND_SKILLS_DIR = _PROJECT_ROOT / "backend" / "skills"
# V27 P79: 兼容 SK-* 新 ID 风格 (V27 新 Skills 9 个)
_NEW_SKILL_PREFIX = "SK-"

# 旧风格 Skills 目录 → 分类代码映射
_LEGACY_CATEGORY_MAP = {
    "financial": "FM",
    "generation": "GS",
    "knowledge": "KA",
    "operations": "OM",
    "project_mgmt": "PM",
    "resource": "RA",
}


class SkillRegistry:
    """
    全局 Skill 注册表 (单例)
    """

    def __init__(self) -> None:
        self._skills: Dict[str, SkillWrapper] = {}   # skill_id → wrapper
        self._meta: Dict[str, SkillMeta] = {}         # skill_id → meta
        self._by_category: Dict[str, List[str]] = {}  # category → [skill_id, ...]
        self._by_service: Dict[str, List[str]] = {}   # service  → [skill_id, ...]
        self._discovered = False

    # ------------------------------------------------------------------
    # 发现 & 注册
    # ------------------------------------------------------------------

    def discover_all(self, force: bool = False) -> int:
        """
        扫描两个位置的 Skill:
        A) services/*/app/skills/  (新格式 — async execute)
        B) backend/skills/         (旧格式 — sync execute / execute_{module} 函数)

        Args:
            force: 是否强制重新扫描。

        Returns:
            注册的 Skill 总数。
        """
        if self._discovered and not force:
            return len(self._skills)

        # ---- 路径 A: services/*/app/skills/ ----
        self._discover_services_skills()

        # ---- 路径 B: backend/skills/ ----
        self._discover_legacy_skills()

        self._discovered = True
        total = len(self._skills)
        logger.info(
            "Skill discovery complete: %d skills registered across %d services/sources",
            total,
            len(self._by_service),
        )
        return total

    # ------------------------------------------------------------------
    # 路径 A: services/*/app/skills/ (新风格)
    # ------------------------------------------------------------------

    def _discover_services_skills(self) -> None:
        """扫描 services/*/app/skills/ 下所有 .py 文件"""
        if not _SERVICES_DIR.is_dir():
            logger.warning("Services directory not found: %s", _SERVICES_DIR)
            return

        for service_dir in sorted(_SERVICES_DIR.iterdir()):
            if not service_dir.is_dir():
                continue
            if service_dir.name.startswith(".") or service_dir.name.startswith("_"):
                continue
            if service_dir.name in ("shared", "gateway"):
                continue

            skills_dir = service_dir / "app" / "skills"
            if not skills_dir.is_dir():
                continue

            service_name = service_dir.name
            self._scan_service_skills(service_name, skills_dir)

    def _scan_service_skills(self, service_name: str, skills_dir: Path) -> None:
        """扫描一个服务下的所有 skill 文件"""
        logger.info("V28 scan %s in %s", service_name, skills_dir)
        for py_file in sorted(skills_dir.rglob("*.py")):
            if py_file.name == "__init__.py":
                continue
            if ".venv" in py_file.parts:
                continue
            if "__pycache__" in py_file.parts:
                continue

            try:
                self._load_skills_from_file(service_name, py_file)
            except Exception as exc:
                logger.error(
                    "V28 ERR %s (%s): %s", py_file.relative_to(_PROJECT_ROOT), service_name, exc
                )

    def _load_skills_from_file(self, service_name: str, py_file: Path) -> None:
        """从一个 .py 文件中提取并注册所有 Skill 类 (新风格)"""
        module_name = f"_skills_auto.{service_name}.{py_file.stem}"
        try:
            spec = importlib.util.spec_from_file_location(module_name, str(py_file))
            if spec is None or spec.loader is None:
                return
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            # V28 P83: 必须先注册到 sys.modules 才能让 dataclass 正常工作
            spec.loader.exec_module(module)
        except Exception as exc:
            logger.error("V28 import fail %s: %s", py_file.name, exc)
            return

        for attr_name in dir(module):
            obj = getattr(module, attr_name, None)
            if obj is None or not inspect.isclass(obj):
                continue
            if issubclass(obj, dict) or issubclass(obj, str) or issubclass(obj, int):
                continue
            try:
                from pydantic import BaseModel as _PydanticBase
                if issubclass(obj, _PydanticBase):
                    continue
            except Exception as e:
                logger.debug("Skipping non-importable class during skill scan: %s", e)

            # 检查是否有 Skill 必需属性 (小写) - V28 P83: 支持 @property meta
            skill_id = getattr(obj, "skill_id", None)
            name = getattr(obj, "name", None)
            description = getattr(obj, "description", None)
            category = getattr(obj, "category", None)
            # V28 P83: 如果类属性没有, 试 @property meta
            if not all([skill_id, name, description, category]):
                meta_prop = getattr(obj, "meta", None)
                if isinstance(meta_prop, property):
                    try:
                        instance_tmp = obj()
                        m = instance_tmp.meta
                        if m and hasattr(m, 'skill_id'):
                            skill_id = m.skill_id
                            name = m.name
                            description = m.description
                            category = m.category
                    except Exception as e: logger.warning(f"[registry] 读取skill meta失败: {e}")

            if not all([skill_id, name, description, category]):
                continue

            # 检查是否有 execute 方法
            execute_method = getattr(obj, "execute", None)
            if execute_method is None or not callable(execute_method):
                continue

            # 新风格要求 async execute (但不强制拒绝)
            try:
                instance = obj()
            except Exception:
                continue

            self._register_skill(service_name, py_file, instance, obj)

    # ------------------------------------------------------------------
    # 路径 B: backend/skills/ (旧风格)
    # ------------------------------------------------------------------

    def _discover_legacy_skills(self) -> None:
        """
        扫描 backend/skills/ 下的旧风格 Skills。

        旧风格特征:
        - 类属性用大写: SKILL_ID, SKILL_NAME, SKILL_DESCRIPTION
        - execute 方法是同步的
        - 可能有模块级 execute_{module_name} 便捷函数
        """
        if not _BACKEND_SKILLS_DIR.is_dir():
            logger.warning("Legacy skills directory not found: %s", _BACKEND_SKILLS_DIR)
            return

        for cat_dir_name, cat_code in _LEGACY_CATEGORY_MAP.items():
            cat_path = _BACKEND_SKILLS_DIR / cat_dir_name
            if not cat_path.is_dir():
                continue

            for py_file in sorted(cat_path.glob("*.py")):
                if py_file.name == "__init__.py":
                    continue
                if "__pycache__" in py_file.parts:
                    continue

                try:
                    self._load_legacy_skill(cat_code, cat_dir_name, py_file)
                except Exception as exc:
                    logger.debug(
                        "Skipping legacy skill %s: %s",
                        py_file.name, exc,
                    )

    def _load_legacy_skill(
        self,
        cat_code: str,
        cat_dir_name: str,
        py_file: Path,
    ) -> None:
        """加载一个旧风格 Skill 文件"""
        module_name = f"_skills_legacy.{cat_dir_name}.{py_file.stem}"

        try:
            spec = importlib.util.spec_from_file_location(module_name, str(py_file))
            if spec is None or spec.loader is None:
                return
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            # V28 P83: 必须先注册到 sys.modules 才能让 dataclass 正常工作
            spec.loader.exec_module(module)
        except Exception as exc:
            logger.error("V28 import fail %s: %s", py_file.name, exc)
            return

        # 策略 1: 查找带 SKILL_ID 的类
        skill_cls = None
        for attr_name in dir(module):
            obj = getattr(module, attr_name, None)
            if obj is None or not inspect.isclass(obj):
                continue
            if hasattr(obj, "SKILL_ID") or hasattr(obj, "skill_id"):
                skill_cls = obj
                break

        if skill_cls is not None:
            # 提取属性 (兼容大写/小写)
            skill_id = (
                getattr(skill_cls, "skill_id", None)
                or getattr(skill_cls, "SKILL_ID", None)
            )
            skill_name = (
                getattr(skill_cls, "name", None)
                or getattr(skill_cls, "SKILL_NAME", None)
                or py_file.stem
            )
            skill_desc = (
                getattr(skill_cls, "description", None)
                or getattr(skill_cls, "SKILL_DESCRIPTION", None)
                or ""
            )

            if not skill_id:
                return

            # 实例化
            try:
                instance = skill_cls()
            except Exception:
                instance = None

            # 查找模块级便捷函数 (execute_{module_name})
            func_name = f"execute_{py_file.stem}"
            callable_func = getattr(module, func_name, None)
            if callable_func is not None and not callable(callable_func):
                callable_func = None

            # 构建 wrapper
            if instance is not None:
                wrapper = SkillWrapper(instance)
            elif callable_func is not None:
                wrapper = SkillWrapper(callable_func=callable_func)
            else:
                return

            # 注入元数据 (旧风格类可能没有小写属性)
            wrapper.set_meta_fields(
                skill_id=skill_id,
                name=str(skill_name),
                description=str(skill_desc),
                category=cat_code,
            )

            # 注册为原始 ID
            self._register_legacy_skill(cat_code, py_file, wrapper, skill_id,
                                        str(skill_name), str(skill_desc))
            
            # 同时使用文件名形式（下划线和中划线）进行注册，确保不管哪种方式都能找到，并且避开 ID 冲突
            stem_id = py_file.stem
            hyphen_id = stem_id.replace("_", "-")
            
            if stem_id != skill_id:
                self._register_legacy_skill(cat_code, py_file, wrapper, stem_id,
                                            str(skill_name), str(skill_desc))
            if hyphen_id != skill_id and hyphen_id != stem_id:
                self._register_legacy_skill(cat_code, py_file, wrapper, hyphen_id,
                                            str(skill_name), str(skill_desc))
            return

        # 策略 2: 没有类但有 execute_{module_name} 函数
        func_name = f"execute_{py_file.stem}"
        callable_func = getattr(module, func_name, None)
        if callable_func is not None and callable(callable_func):
            # 用文件名构造 skill_id
            skill_id = f"{cat_code}-{py_file.stem}"

            wrapper = SkillWrapper(callable_func=callable_func)
            wrapper.set_meta_fields(
                skill_id=skill_id,
                name=py_file.stem.replace("_", " ").title(),
                description=f"Legacy skill: {py_file.stem}",
                category=cat_code,
            )
            self._register_legacy_skill(cat_code, py_file, wrapper, skill_id,
                                        wrapper.name, wrapper.description)
            
            # 也注册为 stem 和 hyphen 形式
            stem_id = py_file.stem
            hyphen_id = stem_id.replace("_", "-")
            
            if stem_id != skill_id:
                self._register_legacy_skill(cat_code, py_file, wrapper, stem_id,
                                            wrapper.name, wrapper.description)
            if hyphen_id != skill_id and hyphen_id != stem_id:
                self._register_legacy_skill(cat_code, py_file, wrapper, hyphen_id,
                                            wrapper.name, wrapper.description)

    def _register_legacy_skill(
        self,
        cat_code: str,
        py_file: Path,
        wrapper: SkillWrapper,
        skill_id: str,
        skill_name: str,
        skill_desc: str,
    ) -> None:
        """注册一个旧风格 Skill (复用核心注册逻辑)"""
        if skill_id in self._skills:
            logger.debug("Skill %s already registered, skipping duplicate", skill_id)
            return

        # 构建元信息
        try:
            rel_path = str(py_file.relative_to(_PROJECT_ROOT))
        except ValueError:
            rel_path = str(py_file)

        meta = SkillMeta(
            skill_id=skill_id,
            name=skill_name,
            description=skill_desc,
            category=cat_code,
            service=f"backend-skills/{cat_code}",
            source_file=rel_path,
            input_schema_class=None,
            output_schema_class=None,
        )

        self._skills[skill_id] = wrapper
        self._meta[skill_id] = meta
        self._by_category.setdefault(cat_code, []).append(skill_id)
        self._by_service.setdefault(f"backend-skills/{cat_code}", []).append(skill_id)

        logger.debug(
            "Registered legacy skill %s (%s) from %s",
            skill_id, skill_name, cat_code,
        )

    # ------------------------------------------------------------------
    # 通用注册 (新风格)
    # ------------------------------------------------------------------

    def _register_skill(
        self,
        service_name: str,
        source_file: Path,
        instance: Any,
        cls: type,
    ) -> None:
        """注册单个 Skill (新风格)"""
        skill_id = instance.skill_id
        if skill_id in self._skills:
            logger.debug("Skill %s already registered, skipping duplicate", skill_id)
            return

        # 创建包装器
        wrapper = SkillWrapper(instance)

        # 提取 input/output schema 类名
        input_cls_name = None
        output_cls_name = None
        input_schema = getattr(instance, "input_schema", None)
        output_schema = getattr(instance, "output_schema", None)
        if input_schema is not None:
            input_cls_name = getattr(input_schema, "__name__", str(input_schema))
        if output_schema is not None:
            output_cls_name = getattr(output_schema, "__name__", str(output_schema))

        # 构建元信息
        meta = SkillMeta(
            skill_id=skill_id,
            name=instance.name,
            description=instance.description,
            category=instance.category,
            service=service_name,
            source_file=str(source_file.relative_to(_PROJECT_ROOT)),
            input_schema_class=input_cls_name,
            output_schema_class=output_cls_name,
        )

        self._skills[skill_id] = wrapper
        self._meta[skill_id] = meta

        # 分类索引
        cat = instance.category
        self._by_category.setdefault(cat, []).append(skill_id)
        self._by_service.setdefault(service_name, []).append(skill_id)

        logger.debug(
            "Registered skill %s (%s) from %s", skill_id, instance.name, service_name
        )

    # ------------------------------------------------------------------
    # 查询
    # ------------------------------------------------------------------

    def get(self, skill_id: str) -> Optional[SkillWrapper]:
        """获取已注册的 Skill"""
        res = self._skills.get(skill_id)
        if res is not None:
            return res

        # 兼容性: 尝试转换为下划线格式寻找
        normalized_id = skill_id.replace("-", "_")
        res = self._skills.get(normalized_id)
        if res is not None:
            return res

        # 遍历元信息，查找源文件名 (stem) 匹配 normalized_id 的技能
        for sid, wrapper in self._skills.items():
            meta = self._meta.get(sid)
            if meta and meta.source_file:
                stem = Path(meta.source_file).stem
                if stem == normalized_id or stem.replace("-", "_") == normalized_id:
                    return wrapper

        return None

    def get_meta(self, skill_id: str) -> Optional[SkillMeta]:
        """获取 Skill 元信息"""
        res = self._meta.get(skill_id)
        if res is not None:
            return res

        # 兼容性: 尝试转换为下划线格式寻找
        normalized_id = skill_id.replace("-", "_")
        res = self._meta.get(normalized_id)
        if res is not None:
            return res

        # 遍历元信息，查找源文件名 (stem) 匹配 normalized_id 的技能
        for sid, meta in self._meta.items():
            if meta.source_file:
                stem = Path(meta.source_file).stem
                if stem == normalized_id or stem.replace("-", "_") == normalized_id:
                    return meta

        return None

    def list_skills(
        self,
        category: Optional[str] = None,
        service: Optional[str] = None,
    ) -> List[SkillMeta]:
        """
        列出所有已注册的 Skill 元信息。

        可按 category 和 service 过滤。
        """
        if category:
            ids = set(self._by_category.get(category, []))
        else:
            ids = set(self._skills.keys())

        if service:
            ids &= set(self._by_service.get(service, []))

        return [self._meta[sid] for sid in sorted(ids) if sid in self._meta]

    def list_categories(self) -> List[str]:
        """获取所有分类"""
        return sorted(self._by_category.keys())

    def list_services(self) -> List[str]:
        """获取所有服务"""
        return sorted(self._by_service.keys())

    @property
    def total_count(self) -> int:
        return len(self._skills)

    # ------------------------------------------------------------------
    # 执行
    # ------------------------------------------------------------------

    async def execute(
        self,
        skill_id: str,
        params: Dict[str, Any],
        *,
        timeout: float = 60.0,
    ) -> Dict[str, Any]:
        """
        执行指定 Skill，包含校验、计时、错误处理。

        Args:
            skill_id: Skill ID
            params:   输入参数
            timeout:  超时秒数

        Returns:
            Skill 执行结果 (dict)
        """
        import asyncio
        import time as _time

        from app.skills.base import SkillExecutionResult, SkillStatus

        wrapper = self.get(skill_id)
        if wrapper is None:
            return SkillExecutionResult(
                skill_id=skill_id,
                status=SkillStatus.FAILED,
                error=f"Skill '{skill_id}' not found",
                error_code="SKILL_NOT_FOUND",
            ).to_dict()

        # 参数适配: 将业务参数转换为 Skill 实际输入格式
        from app.skills.param_adapter_v2 import adapt_params
        params = adapt_params(skill_id, params)

        # 参数校验
        if not wrapper.validate(params):
            return SkillExecutionResult(
                skill_id=skill_id,
                status=SkillStatus.FAILED,
                error="Parameter validation failed",
                error_code="INVALID_PARAMS",
            ).to_dict()

        start = _time.monotonic()
        try:
            result = await asyncio.wait_for(
                wrapper.execute(params),
                timeout=timeout,
            )
            elapsed_ms = (_time.monotonic() - start) * 1000

            return SkillExecutionResult(
                skill_id=skill_id,
                status=SkillStatus.COMPLETED,
                data=result,
                execution_time_ms=elapsed_ms,
            ).to_dict()

        except asyncio.TimeoutError:
            elapsed_ms = (_time.monotonic() - start) * 1000
            return SkillExecutionResult(
                skill_id=skill_id,
                status=SkillStatus.TIMEOUT,
                error=f"Skill execution timed out after {timeout}s",
                error_code="EXECUTION_TIMEOUT",
                execution_time_ms=elapsed_ms,
            ).to_dict()

        except Exception as exc:
            elapsed_ms = (_time.monotonic() - start) * 1000
            logger.exception("Skill execution failed")
            return SkillExecutionResult(
                skill_id=skill_id,
                status=SkillStatus.FAILED,
                error=str(exc),
                error_code="EXECUTION_ERROR",
                execution_time_ms=elapsed_ms,
            ).to_dict()


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_registry_instance: Optional[SkillRegistry] = None


def get_registry() -> SkillRegistry:
    """获取全局 SkillRegistry 单例"""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = SkillRegistry()
        _registry_instance.discover_all()
    return _registry_instance
