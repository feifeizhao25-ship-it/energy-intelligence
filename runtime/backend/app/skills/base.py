"""
Skill 基础类型 — SkillMeta / SkillWrapper / SkillStatus / SkillExecutionResult。

恢复说明：app/skills/registry.py 依赖本模块，恢复碎片中丢失。
按 registry 的实际调用面重建。
"""

from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, Optional


class SkillStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class SkillMeta:
    skill_id: str
    name: str
    description: str
    category: str
    service: str = ""
    source_file: str = ""
    input_schema_class: Optional[str] = None
    output_schema_class: Optional[str] = None
    tags: list = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Catalog entry for GET /skills; the router called this method but it did not exist (HTTP 500)."""
        return {
            "skill_id": self.skill_id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "service": self.service,
            "source_file": self.source_file,
            "input_schema_class": self.input_schema_class,
            "output_schema_class": self.output_schema_class,
            "tags": list(self.tags),
        }


@dataclass
class SkillExecutionResult:
    skill_id: str
    status: SkillStatus
    data: Any = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    execution_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "skill_id": self.skill_id,
            "status": self.status.value,
            "data": self.data,
            "error": self.error,
            "error_code": self.error_code,
            "execution_time_ms": self.execution_time_ms,
        }


class SkillWrapper:
    """统一包装新风格实例（async execute）与旧风格可调用对象。"""

    def __init__(
        self,
        instance: Any = None,
        callable_func: Optional[Callable] = None,
    ) -> None:
        if instance is None and callable_func is None:
            raise ValueError("SkillWrapper 需要 instance 或 callable_func")
        self._instance = instance
        self._callable = callable_func
        self._meta_fields: Dict[str, Any] = {}

    # ── 元信息 ────────────────────────────────────────────────────────────
    @property
    def name(self) -> str:
        if "name" in self._meta_fields:
            return self._meta_fields["name"]
        if self._instance is not None:
            return getattr(self._instance, "name", type(self._instance).__name__)
        return getattr(self._callable, "__name__", "unknown")

    @property
    def description(self) -> str:
        if "description" in self._meta_fields:
            return self._meta_fields["description"]
        if self._instance is not None:
            return getattr(self._instance, "description", "")
        return inspect.getdoc(self._callable) or ""

    def set_meta_fields(self, **fields: Any) -> None:
        self._meta_fields.update(fields)

    def get_schema(self) -> Dict[str, Any]:
        """Input/output JSON schema for GET /skills/{id}; the router called this but it did not exist (HTTP 500)."""
        getter = getattr(self._instance, "get_schema", None) if self._instance is not None else None
        if callable(getter):
            try:
                value = getter()
                if isinstance(value, dict):
                    return value
            except Exception:
                pass
        out: Dict[str, Any] = {"input": None, "output": None}
        for key, attrs in (("input", ("input_schema", "InputSchema")), ("output", ("output_schema", "OutputSchema"))):
            for attr in attrs:
                model = getattr(self._instance, attr, None) if self._instance is not None else None
                dump = getattr(model, "model_json_schema", None)
                if callable(dump):
                    try:
                        out[key] = dump()
                        break
                    except Exception:
                        continue
        if out["input"] is None and self._callable is not None:
            try:
                sig = inspect.signature(self._callable)
                out["input"] = {
                    "type": "object",
                    "properties": {n: {"required": p.default is inspect.Parameter.empty} for n, p in sig.parameters.items()},
                }
            except (TypeError, ValueError):
                pass
        return out

    # ── 校验与执行 ─────────────────────────────────────────────────────────
    def validate(self, params: Dict[str, Any]) -> bool:
        validator = getattr(self._instance, "validate", None) if self._instance else None
        if callable(validator):
            try:
                return bool(validator(params))
            except Exception:
                return False
        return isinstance(params, dict)

    async def execute(self, params: Dict[str, Any]) -> Any:
        target = None
        if self._instance is not None:
            target = getattr(self._instance, "execute", None)
        if target is None:
            target = self._callable
        if target is None:
            raise RuntimeError("SkillWrapper 没有可执行目标")

        if inspect.iscoroutinefunction(target):
            return await target(params)
        result = target(params)
        if inspect.isawaitable(result):
            return await result
        return result
