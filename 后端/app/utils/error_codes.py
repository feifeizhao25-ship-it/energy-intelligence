"""业务错误码表（恢复版，覆盖现有路由引用）。"""

from enum import Enum


class _Code:
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message


class ErrorCode(Enum):
    E1001 = _Code("E1001", "请求参数无效")
    E1002 = _Code("E1002", "缺少必需的请求参数")
    E2003 = _Code("E2003", "认证失败或令牌无效")
    E2004 = _Code("E2004", "邮箱或密码错误")
    E2007 = _Code("E2007", "刷新令牌已过期")
    E2008 = _Code("E2008", "令牌类型不匹配")
    E4003 = _Code("E4003", "该邮箱已被注册")
    E5001 = _Code("E5001", "服务器内部错误")

    @property
    def message(self) -> str:  # type: ignore[override]
        return self.value.message

    @property
    def code(self) -> str:
        return self.value.code
