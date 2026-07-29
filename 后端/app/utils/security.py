"""密码散列兼容门面 — 历史代码从 app.utils.security 导入。"""

from app.core.security import hash_password, verify_password


def get_password_hash(password: str) -> str:
    return hash_password(password)


__all__ = ["get_password_hash", "hash_password", "verify_password"]
