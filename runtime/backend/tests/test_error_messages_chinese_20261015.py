"""审计 4-2：国内版 API 错误提示必须为中文。"""
import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"


def test_http_exception_details_are_chinese():
    bad = []
    for f in APP.rglob("*.py"):
        for m in re.finditer(r'detail="([^"]+)"', f.read_text(encoding="utf-8")):
            if not re.search(r"[\u4e00-\u9fff]", m.group(1)):
                bad.append(f"{f.relative_to(APP)}: {m.group(1)}")
    assert not bad, "\n".join(bad)
