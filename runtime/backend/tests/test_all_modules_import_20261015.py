"""O-3：后端所有模块都能被导入（死代码/残片会在这里变红）。"""
import importlib
import pkgutil

import app


def test_every_backend_module_imports():
    failures = []
    for mod in pkgutil.walk_packages(app.__path__, "app."):
        try:
            importlib.import_module(mod.name)
        except Exception as exc:  # pragma: no cover - 失败时列出
            failures.append(f"{mod.name}: {type(exc).__name__}: {exc}")
    assert failures == []
