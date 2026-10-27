"""密钥预检只报告变量名和是否存在，不报告值。缺一项只关掉对应模块。"""
from __future__ import annotations

import os
from pathlib import Path

MODULES = {
    "deepseek": ["NENGJIAN_DEEPSEEK_API_KEY"],
    "dashscope": ["NENGJIAN_DASHSCOPE_API_KEY"],
    "glm": ["NENGJIAN_GLM_API_KEY"],
    "content_safety": ["NENGJIAN_GUARDRAIL_AK_ID", "NENGJIAN_GUARDRAIL_AK_SECRET"],
    "ark_media": ["NENGJIAN_ARK_API_KEY"],
    "wecom": ["NENGJIAN_WECOM_TOKEN", "NENGJIAN_WECOM_AES_KEY", "NENGJIAN_WECOM_SECRET"],
    "baidu_push": ["NENGJIAN_BAIDU_PUSH_TOKEN"],
    "geo_qwen": ["NENGJIAN_GEO_QWEN_API_KEY"],
    "geo_wenxin": ["NENGJIAN_GEO_WENXIN_API_KEY"],
    "geo_doubao": ["NENGJIAN_GEO_DOUBAO_API_KEY"],
}

SECRETS_FILE = Path(os.environ.get("NENGJIAN_SECRETS_FILE", "/etc/airui-nengjian/secrets.env"))


def load_secret_names(path: Path | None = None) -> set[str]:
    path = path or SECRETS_FILE
    names = {key for key in os.environ if key.startswith("NENGJIAN_")}
    if not path.is_file():
        return names
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        if value.strip():
            names.add(name.strip())
    return names


def preflight(path: Path | None = None) -> dict:
    present = load_secret_names(path)
    modules = {}
    for module, keys in MODULES.items():
        missing = [key for key in keys if key not in present]
        modules[module] = {"enabled": not missing, "missing": missing, "present": [key for key in keys if key in present]}
    return {"secrets_file": str(path or SECRETS_FILE), "modules": modules}
