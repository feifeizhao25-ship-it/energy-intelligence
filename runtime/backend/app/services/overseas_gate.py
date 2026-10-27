"""国内构建的用户请求路径不得直连境外数据源。

NASA POWER 只允许 server-side 批量导入（见 nasa_batch_import.py），
并且默认关闭。国内版要打开境外检索，必须同时满足：
OVERSEAS_LIVE=1、隐私政策披露确认、个人信息保护影响评估记录。
三者缺一即拒绝，没有跳过参数。
"""
import os

from app.config import settings


class OverseasSourceDisabled(RuntimeError):
    pass


def overseas_live_allowed() -> bool:
    edition = (settings.APP_EDITION or os.environ.get("APP_EDITION") or "").lower()
    if edition != "cn":
        return True
    live = os.environ.get("OVERSEAS_LIVE") or getattr(settings, "NENGJIAN_OVERSEAS_LIVE", "")
    acknowledged = os.environ.get("OVERSEAS_PRIVACY_ACK") == "1"
    pia = os.environ.get("OVERSEAS_PIA_RECORD") == "1"
    return live == "1" and acknowledged and pia


def refuse_if_cn() -> None:
    if not overseas_live_allowed():
        raise OverseasSourceDisabled("OVERSEAS_SOURCE_DISABLED")
