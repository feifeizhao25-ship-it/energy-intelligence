#!/usr/bin/env python3
"""Fail-closed checks for the rendered production Kubernetes manifest."""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml


WORKLOADS = {"Deployment", "StatefulSet"}
SECRET_NAME = re.compile(r"(secret|password|token|api[_-]?key|private[_-]?key)", re.I)


def fail(message: str) -> None:
    raise SystemExit(f"production Kubernetes security gate: {message}")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: verify_production_k8s_security.py <rendered.yaml>")
    manifest = Path(sys.argv[1])
    if not manifest.is_file() or manifest.stat().st_size == 0:
        fail(f"missing rendered manifest: {manifest}")

    documents = [item for item in yaml.safe_load_all(manifest.read_text()) if item]
    workloads = [item for item in documents if item.get("kind") in WORKLOADS]
    if not workloads:
        fail("no Deployment or StatefulSet resources found")

    checked = 0
    for item in workloads:
        name = f"{item['kind']}/{item.get('metadata', {}).get('name', '<unnamed>')}"
        namespace = item.get("metadata", {}).get("namespace")
        if not namespace or namespace == "default":
            fail(f"{name} must use an explicit non-default namespace")

        pod = item.get("spec", {}).get("template", {}).get("spec", {})
        if pod.get("automountServiceAccountToken") is not False:
            fail(f"{name} must disable automatic service-account token mounting")
        pod_security = pod.get("securityContext", {})
        if pod_security.get("seccompProfile", {}).get("type") != "RuntimeDefault":
            fail(f"{name} must use RuntimeDefault seccomp")

        for container in pod.get("containers", []):
            checked += 1
            container_name = f"{name}:{container.get('name', '<unnamed>')}"
            security = container.get("securityContext", {})
            if security.get("allowPrivilegeEscalation") is not False:
                fail(f"{container_name} permits privilege escalation")
            if security.get("readOnlyRootFilesystem") is not True:
                fail(f"{container_name} must use a read-only root filesystem")
            if "ALL" not in security.get("capabilities", {}).get("drop", []):
                fail(f"{container_name} must drop all Linux capabilities")
            if not (security.get("runAsNonRoot") is True or pod_security.get("runAsNonRoot") is True):
                fail(f"{container_name} must run as non-root")
            if container.get("imagePullPolicy") != "Always":
                fail(f"{container_name} must always verify the registry tag")
            image = str(container.get("image", ""))
            if not image or image.endswith(":latest") or (":" not in image and "@sha256:" not in image):
                fail(f"{container_name} uses an unpinned or latest image: {image!r}")
            if "readinessProbe" not in container or "livenessProbe" not in container:
                fail(f"{container_name} must define readiness and liveness probes")
            resources = container.get("resources", {})
            for section in ("requests", "limits"):
                values = resources.get(section, {})
                if not values.get("cpu") or not values.get("memory"):
                    fail(f"{container_name} lacks CPU/memory {section}")
            for env in container.get("env", []):
                if SECRET_NAME.search(str(env.get("name", ""))) and "value" in env:
                    fail(f"{container_name} contains a literal secret-like environment value")

    if checked < 20:
        fail(f"expected at least 20 production containers, checked {checked}")
    print(f"Production Kubernetes security gate passed: {len(workloads)} workloads, {checked} containers")


if __name__ == "__main__":
    main()
