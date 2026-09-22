"""按 compose 给后端的环境变量构造配置，必须能启动。

2026-09-22 之前，按 docker-compose.cn.production.yml 部署：
- VECTOR_STORE_BACKEND 未配置，默认 "sqlite" 被生产校验拒绝 → 导入即崩溃；
- 部署示例里的 CORS_ORIGINS=https://a,https://b 被 pydantic-settings 当 JSON 解析 → 导入即崩溃。
后端起不来，web-cn（depends_on backend healthy）与网关都不会启动，整站打不开。
"""
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = ROOT / "docker-compose.cn.production.yml"
VALUES = {
    "SECRET_KEY": "Validation-Only_Secret-7k!2p#9Vz-L4n",
    "POSTGRES_PASSWORD": "validation-password",
    "REDIS_PASSWORD": "validation-password",
    "CORS_ORIGINS": "https://cn.example.cn,https://www.example.cn",
}


def _backend_env():
    env = yaml.safe_load(COMPOSE.read_text())["services"]["backend"]["environment"]
    out = {}
    for key, value in env.items():
        text = str(value)
        text = re.sub(r"\$\{([A-Z0-9_]+):\?[^}]*\}", lambda m: VALUES.get(m.group(1), "validation"), text)
        text = re.sub(r"\$\{([A-Z0-9_]+):-([^}]*)\}", lambda m: m.group(2), text)
        out[key] = text
    return out


@pytest.mark.parametrize("cors", ["https://cn.example.cn,https://www.example.cn", '["https://cn.example.cn"]'])
def test_backend_boots_with_compose_environment(cors):
    env = {"PATH": os.environ.get("PATH", ""), **_backend_env(), "CORS_ORIGINS": cors}
    code = (
        "from app.config import Settings; s = Settings(); "
        "assert all(o.startswith('https://') for o in s.CORS_ORIGINS), s.CORS_ORIGINS; "
        "import app.main; print('ok')"
    )
    result = subprocess.run([sys.executable, "-c", code], cwd=ROOT / "backend", env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr[-2000:]
    assert result.stdout.strip().endswith("ok")


def test_explicit_non_durable_vector_store_still_rejected():
    env = {"PATH": os.environ.get("PATH", ""), **_backend_env(), "VECTOR_STORE_BACKEND": "sqlite"}
    result = subprocess.run([sys.executable, "-c", "from app.config import Settings; Settings()"],
                            cwd=ROOT / "backend", env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert "VECTOR_STORE_BACKEND" in result.stderr
