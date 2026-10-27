"""平台订单与渠道账单对账。差额非零即告警。生产环境不接受模拟标记。"""

from __future__ import annotations

from decimal import Decimal


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def reconcile_orders(ledger: list[dict], bill: list[dict]) -> dict:
    paid = {row["order_no"]: _money(row["amount"]) for row in ledger if row.get("status") in {"paid", "completed"}}
    received = {row["order_no"]: _money(row["amount"]) for row in bill if row.get("status") in {"success", "TRADE_SUCCESS"}}
    missing_in_bill = sorted(order_no for order_no in paid if order_no not in received)
    missing_in_ledger = sorted(order_no for order_no in received if order_no not in paid)
    amount_mismatch = sorted(order_no for order_no in paid if order_no in received and paid[order_no] != received[order_no])
    ledger_sum = sum(paid.values(), Decimal("0.00"))
    bill_sum = sum(received.values(), Decimal("0.00"))
    diff = (bill_sum - ledger_sum).quantize(Decimal("0.01"))
    alert = diff != 0 or bool(missing_in_bill or missing_in_ledger or amount_mismatch)
    return {
        "diff": f"{diff:.2f}",
        "ledger_sum": f"{ledger_sum:.2f}",
        "bill_sum": f"{bill_sum:.2f}",
        "missing_in_bill": missing_in_bill,
        "missing_in_ledger": missing_in_ledger,
        "amount_mismatch": amount_mismatch,
        "alert": alert,
    }


def production_forbids_simulation(environment: str, sandbox: bool, simulation_flag: str | None) -> None:
    if environment == "production" and (sandbox or simulation_flag == "1"):
        raise RuntimeError("生产环境禁止模拟支付")
