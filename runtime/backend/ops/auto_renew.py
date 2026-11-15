"""自动续费未开启。

是否对用户扣款由人工决定，并须先有企业微信审批。
本模块不生成订单，也不记录已批准。
"""
from __future__ import annotations


def auto_renew_status() -> dict:
    # TODO: 开启自动续费前，由负责人绑定商店或支付账户并完成企业微信审批。未审批不得扣款。
    return {
        "enabled": False,
        "charged": False,
        "approved": False,
        "todo": "待人工决定是否开启自动续费，并完成企业微信审批。",
    }
