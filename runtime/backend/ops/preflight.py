"""密钥预检只报告变量名和是否存在，不报告值。缺一项只关掉对应模块。

产品密钥与 OpenClaw 运维密钥分文件。相同取值只比较 sha256 前缀，明文不进入报告。
国内版若环境里出现境外供应商变量，只列出变量名。
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path

MODULES = {
    "deepseek": ["NENGJIAN_DEEPSEEK_API_KEY"],
    "dashscope": ["NENGJIAN_DASHSCOPE_API_KEY"],
    "glm": ["NENGJIAN_GLM_API_KEY"],
    "content_safety": ["NENGJIAN_GUARDRAIL_AK_ID", "NENGJIAN_GUARDRAIL_AK_SECRET"],
    "ark_media": ["NENGJIAN_ARK_API_KEY"],
    "wecom": ["NENGJIAN_WECOM_CORP_ID", "NENGJIAN_WECOM_AGENT_ID", "NENGJIAN_WECOM_TOKEN", "NENGJIAN_WECOM_AES_KEY", "NENGJIAN_WECOM_SECRET"],
    "baidu_push": ["NENGJIAN_BAIDU_PUSH_TOKEN"],
    "geo_qwen": ["NENGJIAN_GEO_QWEN_API_KEY"],
    "geo_wenxin": ["NENGJIAN_GEO_WENXIN_API_KEY"],
    "geo_doubao": ["NENGJIAN_GEO_DOUBAO_API_KEY"],
}

BANNED_OVERSEAS = (
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENROUTER_BASE_URL",
    "SENTRY_DSN",
    "DATADOG_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_ENTERPRISE_PRICE_ID",
    "SENDGRID_API_KEY",
    "NREL_API_KEY",
    "OPENWEATHERMAP_API_KEY",
    "OPENWEATHER_API_KEY",
    "PINECONE_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APPLE_CLIENT_ID",
    "APPLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "FCM_SERVER_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SILICONFLOW_API_KEY",
    "OPENALEX_CONTACT_EMAIL",
    "CORE_API_KEY",
    "UNPAYWALL_EMAIL",
    "SEMANTIC_SCHOLAR_API_KEY",
    "CROSSREF_MAILTO",
)

def secrets_file() -> Path:
    return Path(os.environ.get("NENGJIAN_SECRETS_FILE", "/etc/airui-nengjian/secrets.env"))


def openclaw_secrets_file() -> Path:
    return Path(os.environ.get("NENGJIAN_OPENCLAW_SECRETS_FILE", "/etc/airui-nengjian/openclaw.env"))


SECRETS_FILE = secrets_file()
OPENCLAW_SECRETS_FILE = openclaw_secrets_file()


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        name = name.strip()
        value = value.strip().strip('"').strip("'")
        if name and value:
            values[name] = value
    return values


def load_secret_names(path: Path | None = None) -> set[str]:
    path = path or secrets_file()
    names = {key for key in os.environ if key.startswith("NENGJIAN_") and os.environ.get(key)}
    names.update(_parse_env_file(path))
    return names


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def shared_key_findings(product_path: Path | None = None, openclaw_path: Path | None = None) -> list[dict]:
    product = _parse_env_file(product_path or secrets_file())
    for key, value in os.environ.items():
        if key.startswith("NENGJIAN_") and value and key not in product and key != "NENGJIAN_OPENCLAW_SECRETS_FILE":
            product[key] = value
    openclaw = _parse_env_file(openclaw_path or openclaw_secrets_file())
    for key, value in os.environ.items():
        if key.startswith("OPENCLAW_") and value:
            openclaw[key] = value
    by_hash: dict[str, list[str]] = {}
    for name, value in openclaw.items():
        by_hash.setdefault(_hash(value), []).append(name)
    findings = []
    for name, value in product.items():
        digest = _hash(value)
        for other in by_hash.get(digest, []):
            findings.append({"product": name, "openclaw": other, "sha256_prefix": digest[:12]})
    return findings


def banned_overseas_present() -> list[str]:
    if os.environ.get("APP_EDITION", "").lower() != "cn":
        return []
    return [name for name in BANNED_OVERSEAS if os.environ.get(name)]


def preflight(path: Path | None = None) -> dict:
    present = load_secret_names(path)
    modules = {}
    for module, keys in MODULES.items():
        missing = [key for key in keys if key not in present]
        modules[module] = {"enabled": not missing, "missing": missing, "present": [key for key in keys if key in present]}
    return {
        "secrets_file": str(path or secrets_file()),
        "openclaw_secrets_file": str(openclaw_secrets_file()),
        "modules": modules,
        "shared_keys": shared_key_findings(path),
        "banned_overseas": banned_overseas_present(),
    }
