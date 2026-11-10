"""EN-A1: the monthly report records a readability check without a score."""
from app.self_improve.monthly_report import build_report, render_markdown
from app.services.language_guard import CJK


def test_monthly_report_records_readability_without_a_score():
    report = build_report("energy", "2026-10", lang="en", sil_enabled=False)
    reading = report["readability"]
    assert isinstance(reading["average_sentence_length"], float)
    assert reading["issues"] == [] or all(item.isascii() for item in reading["issues"])
    markdown = render_markdown(report)
    assert "Readability" in markdown
    assert "not a score" in markdown
    assert not CJK.search(markdown)
