#!/usr/bin/env python3
"""Fail CI when production-facing code can present synthetic results as real."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def require(path: str, text: str) -> None:
    target = ROOT / path
    if not target.is_file():
        errors.append(f"{path}: required production source file is missing")
        return
    content = target.read_text(encoding="utf-8")
    if text not in content:
        errors.append(f"{path}: missing production guard {text!r}")


def forbid_tree(path: str, patterns: tuple[str, ...]) -> None:
    for file in (ROOT / path).rglob("*"):
        if file.suffix not in {".ts", ".tsx", ".js", ".jsx"} or not file.is_file():
            continue
        content = file.read_text(encoding="utf-8")
        for pattern in patterns:
            if pattern in content:
                errors.append(f"{file.relative_to(ROOT)}: forbidden production UI text {pattern!r}")


require(
    "services/knowledge-service/app/skills/knowledge_management.py",
    "synthetic fallback is disabled in production",
)
require(
    "services/ai-engine/app/vector_store/milvus_client.py",
    "refusing to generate synthetic production embeddings",
)
require(
    "services/ai-engine/app/skills/v31_new_skills.py",
    "No synthetic result was generated.",
)
forbid_tree(
    "web-global/src",
    (
        "realbackend",
        "backendreal",
        'https://docs.example.com/',
        'https://example.com/wp',
        "mock-user-id",
    ),
)

service_dockerfiles = sorted((ROOT / "services").glob("*/Dockerfile"))
if len(service_dockerfiles) != 15:
    errors.append(
        f"services: expected 15 production Dockerfiles, found {len(service_dockerfiles)}"
    )
for dockerfile in service_dockerfiles:
    content = dockerfile.read_text(encoding="utf-8")
    service_dir = dockerfile.parent
    source_files = [
        path
        for path in service_dir.rglob("*")
        if path.is_file()
        and path != dockerfile
        and "__pycache__" not in path.parts
    ]
    if not source_files:
        errors.append(
            f"{service_dir.relative_to(ROOT)}: service source and dependency files are missing"
        )
    if len(content.splitlines()) < 12:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: Dockerfile is an incomplete recovery fragment"
        )
    if dockerfile.parent.name == "gateway":
        continue
    if "FROM python:3.12-slim" not in content:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: must use the tested Python 3.12 runtime"
        )
    if "USER appuser" not in content:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: production image must run as appuser"
        )
    if "HEALTHCHECK " not in content:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: production image needs a health check"
        )

if errors:
    print("Production code gate failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Production code gate passed")
