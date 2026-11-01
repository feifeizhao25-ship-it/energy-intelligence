"""X10: the docs said formula rendering was missing in the apps; the dependencies must stay in place."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_flutter_apps_declare_formula_renderer():
    for app in ("android-cn", "android-global", "ios-cn", "ios-global"):
        assert "flutter_math_fork" in (ROOT / app / "pubspec.yaml").read_text(encoding="utf-8"), app
        body = (ROOT / app / "lib" / "widgets" / "ai_message_body.dart").read_text(encoding="utf-8")
        assert "Math" in body, app


def test_web_apps_depend_on_katex():
    for pkg in (ROOT / "runtime" / "web" / "package.json", ROOT / "web-global" / "package.json"):
        data = json.loads(pkg.read_text(encoding="utf-8"))
        deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
        assert any("katex" in k.lower() for k in deps), pkg
