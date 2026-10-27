"""发布开关全部默认关闭。

值从 ops/nengjian.yaml 的 switches 段读取，再用 NENGJIAN_SWITCH_<NAME> 覆盖。
缺省、无法解析的文件、空环境变量都不打开开关。SWITCHES 是可变字典，
调用方可以在进程内临时改写（测试会这样做），不要在导入后换成新对象。
"""
from __future__ import annotations

import os
from pathlib import Path

_DEFAULTS = {
    "publish_a": False,
    "publish_b": False,
    "publish_c": False,
    "baidu_push": False,
    "email_opt_in": False,
    "github_methodology": False,
    "seo_generate": False,
    "geo_monitor": False,
    "wecom_submit": False,
    "marketing_media": False,
}

_TRUE = {"1", "true", "yes", "on"}


def _apply_yaml(values: dict) -> None:
    path = Path(__file__).with_name("nengjian.yaml")
    if not path.is_file():
        return
    section = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if not line.startswith(" ") and line.strip().endswith(":"):
            section = line.strip()[:-1]
            continue
        if section != "switches" or ":" not in line:
            continue
        key, val = line.strip().split(":", 1)
        key = key.strip()
        if key in values:
            values[key] = val.strip().lower() in _TRUE


def _apply_env(values: dict) -> None:
    for key in list(values):
        raw = os.environ.get(f"NENGJIAN_SWITCH_{key.upper()}")
        if raw is None or raw.strip() == "":
            continue
        values[key] = raw.strip().lower() in _TRUE


def load_switches() -> dict:
    values = dict(_DEFAULTS)
    _apply_yaml(values)
    _apply_env(values)
    return values


SWITCHES = load_switches()
