"""E24: the Chinese edition shows Chinese, the international edition shows English.

The 2026-08 backend test (后端/tests/test_global_api_language_boundary.py) went away with the
old backend; the current one only counts CJK in international API responses
(app/services/language_guard.py). This test restores a hard check on the client side by
running scripts/verify_language_isolation.py over every deployed or kept frontend:

- international (runtime/web-int, web-global, android-global, ios-global): no CJK in code,
  including dead branches such as `kUiZh ? '中文' : 'English'`;
- Chinese (runtime/web, frontend-cn-web): no run of five or more natural English words in
  JSX text; Chinese Flutter apps (android-cn, ios-cn): no English in any string reachable
  from main.dart (scripts/verify_zh_ui_dart.py).

It also proves the gate itself still catches both kinds of leak, so a broken gate cannot
pass silently.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "scripts" / "verify_language_isolation.py"
ZH_SCRIPT = ROOT / "scripts" / "verify_zh_ui_dart.py"
ZH_ALLOW = ROOT / "scripts" / "zh_ui_allow.json"

pytestmark = pytest.mark.skipif(not SCRIPT.is_file(), reason="needs the full repository checkout")


def _gate():
    spec = importlib.util.spec_from_file_location("verify_language_isolation", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_repository_frontends_keep_their_language(capsys):
    assert _gate().main() == 0, capsys.readouterr().out


def test_chinese_flutter_apps_show_no_english():
    """android-cn / ios-cn: every string reachable from main.dart is Chinese (brand/unit allowlist aside)."""
    import json

    spec = importlib.util.spec_from_file_location("verify_zh_ui_dart", ZH_SCRIPT)
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    cfg = json.loads(ZH_ALLOW.read_text(encoding="utf-8"))
    tokens = sorted(gate.DEFAULT_TOKENS | set(cfg.get("tokens", [])))
    for app in ("android-cn", "ios-cn"):
        bad = gate.scan_app(ROOT / app, tokens, cfg.get("literals", []))
        assert not bad, "\n".join(f"{app}/{r}:{n}: {t!r}" for r, n, t, _ in bad[:30])


def test_gate_rejects_chinese_in_international_code(tmp_path, monkeypatch):
    gate = _gate()
    monkeypatch.setattr(gate, "ROOT", tmp_path)
    (tmp_path / "w.dart").write_text(
        "const bool kZh = false;\n"
        "String get t => kZh ? '保存失败' : 'Could not save';\n"
        "// 注释里的中文不算\n",
        encoding="utf-8",
    )
    found = gate.check_intl(tmp_path, set())
    assert len(found) == 1 and "保存失败" in found[0]


def test_gate_rejects_english_sentences_in_chinese_jsx(tmp_path, monkeypatch):
    gate = _gate()
    monkeypatch.setattr(gate, "ROOT", tmp_path)
    (tmp_path / "p.tsx").write_text(
        "export default function P() {\n"
        "  return <div>Please sign in to see your saved projects here</div>;\n"
        "}\n"
        "export function Q() { return <div>登录后查看项目 PDF</div>; }\n",
        encoding="utf-8",
    )
    found = gate.check_cn(tmp_path, set())
    assert len(found) == 1 and "Please sign in" in found[0]
