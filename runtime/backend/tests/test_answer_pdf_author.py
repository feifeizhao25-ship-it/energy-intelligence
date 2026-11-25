"""能25 / 智10：回答导出的作者和纸张。"""

from app.services.answer_export import render_answer_file


def test_chinese_answer_pdf_names_the_product_not_anonymous():
    pdf = render_answer_file({"market": "cn", "message": "这是一条回答。"}, "pdf")
    assert b"(anonymous)" not in pdf
    assert b"Page 1" not in pdf


def test_english_answer_pdf_uses_letter_and_an_english_author():
    pdf = render_answer_file({"market": "global", "message": "An answer."}, "pdf")
    assert b"(anonymous)" not in pdf
    assert b"Energy Intelligence" in pdf
    # Letter is 612 x 792 points. Reportlab writes the media box.
    assert b"612" in pdf and b"792" in pdf
