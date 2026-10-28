from ops.auto_renew import auto_renew_status
from ops.procurement import open_document_request


def test_document_requests_do_not_create_payment():
    fields = {"account_name": "甲", "bank_name": "示例银行", "account_number": "1", "tax_id": "2"}
    for kind in ("quote", "contract", "invoice"):
        result = open_document_request(kind, fields)
        assert result["status"] == "pending_wecom"
        assert result["payment_created"] is False
        assert result["invoice_number"] is None
        assert result["approved"] is False
        assert result["sent"] is False
    assert open_document_request("pay", fields)["payment_created"] is False


def test_auto_renew_stays_off():
    status = auto_renew_status()
    assert status["enabled"] is False
    assert status["charged"] is False
    assert status["approved"] is False
    assert "企业微信" in status["todo"]
