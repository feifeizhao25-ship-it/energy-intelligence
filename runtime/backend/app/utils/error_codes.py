"""业务错误码。用户可见文案只从 app/errors/catalog.json 取。"""

from enum import Enum

from app.errors.catalog import public_message


class ErrorCode(Enum):
    E1001 = "E1001"
    E1002 = "E1002"
    E2003 = "E2003"
    E2004 = "E2004"
    E2005 = "E2005"
    E2007 = "E2007"
    E2008 = "E2008"
    E4001 = "E4001"
    E4003 = "E4003"
    E5001 = "E5001"
    E_CONFIG = "E_CONFIG"
    E_AUTH = "E_AUTH"
    E_FORBIDDEN = "E_FORBIDDEN"
    E_QUOTA = "E_QUOTA"
    E_COMPLIANCE = "E_COMPLIANCE"
    E_SERVICE = "E_SERVICE"

    @property
    def message(self) -> str:
        return public_message(self.value, "cn")

    @property
    def code(self) -> str:
        return self.value
