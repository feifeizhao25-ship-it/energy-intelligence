"""口径咨询不得自动通过；内部收益率与前端夹具对齐。"""
from app.services.consultation import book_consultation
from app.utils.financial_utils import solve_irr_rate


def test_consultation_stays_pending_without_wecom_approval():
    row = book_consultation("电价口径", "user-1")
    assert row["approved"] is False
    assert row["status"] == "pending"
    assert "不会自动通过" in row["message"]


def test_consultation_rejects_empty_topic():
    row = book_consultation("  ", "user-1")
    assert row["approved"] is False
    assert row["status"] == "invalid"


def test_solve_irr_matches_frontend_fixture():
    rate = solve_irr_rate([-100, 60, 60])
    assert rate is not None
    assert abs(rate - 0.130662) < 1e-4
    assert solve_irr_rate([-100, 50, -10, 80]) is None
