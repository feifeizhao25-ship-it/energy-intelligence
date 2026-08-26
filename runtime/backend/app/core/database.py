"""
兼容门面：历史代码从 app.core.database 导入 get_db/Base。

权威实现已统一到 app.database（引擎、会话工厂、生命周期）。
"""

from app.database import (  # noqa: F401
    AsyncSessionLocal,
    engine,
    get_db,
)
from app.models.database import Base  # noqa: F401  # 统一使用 models 的 Base

__all__ = ["AsyncSessionLocal", "Base", "engine", "get_db"]
