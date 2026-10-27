"""国内构建的用户请求路径不得直连境外数据源。

NASA POWER 只允许 server-side 批量导入（见 nasa_batch_import.py），
并且默认关闭。本模块在 APP_EDITION=cn 时让请求路径在发起 HTTP 之前失败。
"""
from app.config import settings


class OverseasSourceDisabled(RuntimeError):
    pass


def overseas_live_allowed() -> bool:
    return (settings.APP_EDITION or "").lower() != "cn"


def refuse_if_cn() -> None:
    if not overseas_live_allowed():
        raise OverseasSourceDisabled("OVERSEAS_SOURCE_DISABLED")
