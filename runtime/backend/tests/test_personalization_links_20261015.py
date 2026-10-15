"""审计 13-1：个性化卡片的 next_action / 推荐链接必须指向真实存在的前端页面。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_DIR = ROOT / "web" / "src" / "app"
SRC = Path(__file__).resolve().parents[1] / "app" / "services" / "personalization_v2.py"


def _routes():
    out = set()
    for page in APP_DIR.rglob("page.tsx"):
        rel = page.parent.relative_to(APP_DIR).as_posix()
        parts = [p for p in rel.split("/") if p and not (p.startswith("(") and p.endswith(")"))]
        out.add("/" + "/".join(parts) if parts else "/")
    return out


def test_all_hrefs_resolve_to_pages():
    if not APP_DIR.exists():
        import pytest
        pytest.skip("web 源码不在本仓库布局中")
    routes = _routes()
    hrefs = set(re.findall(r'"href": "([^"]+)"', SRC.read_text(encoding="utf-8")))
    dead = sorted(h for h in hrefs if h.split("?")[0] not in routes)
    assert not dead, dead
