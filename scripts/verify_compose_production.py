#!/usr/bin/env python3
"""Validate the canonical production Compose topology."""

from pathlib import Path
import os
import shutil
import subprocess
import sys

import yaml


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "docker-compose.prod.yml"
required_services = {
    "postgres-cn", "postgres-global", "redis-cn", "redis-global",
    "backend-cn", "backend-global", "frontend-cn", "frontend-int", "nginx",
}

raw = yaml.safe_load(COMPOSE_FILE.read_text(encoding="utf-8"))
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

for backend, market, provider in (("backend-cn", "cn", "oss"), ("backend-global", "global", "s3")):
    values = services[backend].get("environment", [])
    environment_text = "\n".join(values) if isinstance(values, list) else str(values)
    for required in ("ENVIRONMENT=production", f"MARKET_REGION={market}", f"STORAGE_PROVIDER={provider}", "VECTOR_STORE_BACKEND="):
        if required not in environment_text:
            errors.append(f"{backend}: missing production environment contract {required}")
    if "/ready" not in str(services[backend].get("healthcheck", {}).get("test", [])):
        errors.append(f"{backend}: healthcheck must use dependency-aware /ready")

for service_name, backend_name in (("frontend-cn", "backend-cn"), ("frontend-int", "backend-global")):
    backend_dependency = services[service_name].get("depends_on", {}).get(backend_name, {})
    if backend_dependency.get("condition") != "service_healthy":
        errors.append(f"{service_name}: must wait for healthy {backend_name}")

compose = shutil.which("docker-compose")
command = [compose, "-p", "energy", "-f", str(COMPOSE_FILE), "config"] if compose else None
if command:
    env = {
        **os.environ,
        "POSTGRES_PASSWORD_CN": "validation-only-password", "POSTGRES_PASSWORD_GLOBAL": "validation-only-password",
        "REDIS_PASSWORD_CN": "validation-only-password", "REDIS_PASSWORD_GLOBAL": "validation-only-password",
        "SECRET_KEY_CN": "Validation-Only_Secret-7k!2p#9Vz-L4n", "SECRET_KEY_GLOBAL": "Validation-Only_Secret-8k!2p#9Vz-L4n",
        "MILVUS_HOST": "milvus.internal",
        "OSS_BUCKET": "validation-bucket",
        "OSS_ENDPOINT": "oss.internal",
        "OSS_ACCESS_KEY_ID": "validation-key",
        "OSS_ACCESS_KEY_SECRET": "validation-secret",
        "MILVUS_HOST_GLOBAL": "milvus-global.internal", "S3_BUCKET_GLOBAL": "validation-global-bucket",
        "AWS_REGION": "us-east-1", "OPENROUTER_API_KEY_GLOBAL": "validation-key",
        "STRIPE_SECRET_KEY_GLOBAL": "validation-key", "STRIPE_WEBHOOK_SECRET_GLOBAL": "validation-key",
    }
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, capture_output=True, check=False)
    if result.returncode:
        errors.append("docker-compose config failed: " + (result.stderr.strip() or result.stdout.strip()))

if errors:
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(f"Production Compose gate failed: {len(errors)} error(s)")

print(f"Production Compose gate passed: {len(services)} services")
