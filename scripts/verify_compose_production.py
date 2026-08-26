#!/usr/bin/env python3
"""Validate the canonical production Compose topology.

2026-08-18 复核更正三处，此前本脚本**必然失败**（但从未接进 CI，所以没人发现）：

1. 服务名对不上。脚本要求 frontend-cn / frontend-int / nginx，
   实际编排里是 web-cn / web-int，且根本没有 nginx 服务
   （反向代理由 Caddy 在编排之外承担）。
2. 读错文件。docker-compose.prod.yml 现在是一个 `include:` 委托，
   顶层没有 services 键，直接 safe_load 取 services 得到空字典。
3. 环境契约项写错。脚本要求 STORAGE_PROVIDER=oss 与 VECTOR_STORE_BACKEND=，
   而后端实际用的是 SECRET_KEY / DATABASE_URL / REDIS_URL / CORS_ORIGINS
   这套（且都带 `:?` 强制校验）。
"""

from pathlib import Path
import os
import shutil
import subprocess
import sys

import yaml


ROOT = Path(__file__).resolve().parents[1]
ENTRY_FILE = ROOT / "docker-compose.prod.yml"
required_services = {"postgres", "redis", "backend", "web-cn", "web-int", "gateway"}


def _resolve_compose(entry: Path) -> tuple[Path, dict]:
    """解析入口文件；若它只是 `include:` 委托，则跟进被包含的文件。"""
    raw = yaml.safe_load(entry.read_text(encoding="utf-8")) or {}
    if raw.get("services"):
        return entry, raw

    for item in raw.get("include") or []:
        target = item.get("path") if isinstance(item, dict) else item
        if not target:
            continue
        resolved = (entry.parent / target).resolve()
        if resolved.is_file():
            inner = yaml.safe_load(resolved.read_text(encoding="utf-8")) or {}
            if inner.get("services"):
                return resolved, inner

    raise SystemExit(
        f"Production Compose gate failed: {entry.name} 里既没有 services，"
        f"也没有可解析的 include 目标"
    )


COMPOSE_FILE, raw = _resolve_compose(ENTRY_FILE)
ROOT = COMPOSE_FILE.parent          # build context 相对被包含文件解析
services = raw.get("services", {})
missing = required_services - set(services)
if missing:
    raise SystemExit("Production Compose gate failed: missing services " + ", ".join(sorted(missing)))

errors: list[str] = []
for name, service in services.items():
    image = service.get("image", "")
    if image.endswith(":latest"):
        errors.append(f"{name}: mutable latest image")
    build = service.get("build")
    if build:
        context = build if isinstance(build, str) else build.get("context")
        dockerfile = "Dockerfile" if isinstance(build, str) else build.get("dockerfile", "Dockerfile")
        path = (ROOT / context / dockerfile).resolve()
        if not path.is_file():
            errors.append(f"{name}: missing Dockerfile {path}")

backend_environment = services["backend"].get("environment", [])
if isinstance(backend_environment, dict):
    environment_text = "\n".join(f"{k}={v}" for k, v in backend_environment.items())
elif isinstance(backend_environment, list):
    environment_text = "\n".join(str(x) for x in backend_environment)
else:
    environment_text = str(backend_environment)
# 生产环境契约：既要确认是 production，也要确认关键凭证都用了 `:?` 强制校验 ——
# 缺了它们 compose 会静默启动一个没有密码的服务。
for required in ("ENVIRONMENT", "SECRET_KEY", "DATABASE_URL", "REDIS_URL", "CORS_ORIGINS"):
    if required not in environment_text:
        errors.append(f"backend: missing production environment contract {required}")

if "ENVIRONMENT" in environment_text and "production" not in environment_text:
    errors.append("backend: ENVIRONMENT 不是 production")

for secret in ("SECRET_KEY", "POSTGRES_PASSWORD", "REDIS_PASSWORD", "CORS_ORIGINS"):
    if secret in environment_text and f"${{{secret}:?" not in environment_text:
        errors.append(f"backend: {secret} 未使用 `:?` 强制校验，缺失时会静默启动")

compose = shutil.which("docker-compose")
command = [compose, "-p", "energy", "-f", str(COMPOSE_FILE), "config"] if compose else None
if command:
    env = {
        **os.environ,
        "POSTGRES_PASSWORD": "validation-only-password",
        "REDIS_PASSWORD": "validation-only-password",
        "SECRET_KEY": "Validation-Only_Secret-7k!2p#9Vz-L4n",
        "CORS_ORIGINS": "https://cn.example.test,https://global.example.test",
        "CN_NEXTAUTH_URL": "https://cn.example.test",
        "NEXTAUTH_SECRET": "Validation-Only_NextAuth-4m!8q#2Ks-X7p",
        "NEXT_PUBLIC_SUPABASE_URL": "https://validation.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "validation-anon-key",
        "SUPABASE_SERVICE_ROLE_KEY": "validation-service-role-key",
        "IMAGE_REGISTRY": "registry.example.test/energy",
        "IMAGE_TAG": "validation-sha",
        "CN_PUBLIC_API_URL": "https://cn.example.test/api/backend",
        "CN_DOMAIN": "cn.example.test",
        "INT_DOMAIN": "global.example.test",
        "TLS_EMAIL": "ops@example.test",
        "MILVUS_HOST": "milvus.internal",
        "OSS_BUCKET": "validation-bucket",
        "OSS_ENDPOINT": "oss.internal",
        "OSS_ACCESS_KEY_ID": "validation-key",
        "OSS_ACCESS_KEY_SECRET": "validation-secret",
        "OPENALEX_CONTACT_EMAIL": "ops@example.test",
    }
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    if result.returncode:
        errors.append("docker-compose config failed; rerun locally with redacted environment values")

if errors:
    print("Production Compose gate found invalid production configuration", file=sys.stderr)
    raise SystemExit(f"Production Compose gate failed: {len(errors)} error(s)")

print(f"Production Compose gate passed: {len(services)} services")
