#!/usr/bin/env python3
"""Render and statically verify the production Kubernetes overlay."""

from pathlib import Path
import shutil
import subprocess
import sys

import yaml


ROOT = Path(__file__).resolve().parents[1]
OVERLAY = ROOT / "k8s/overlays/production"
EXPECTED_EXTERNAL_SECRETS = {
    "database-secrets",
    "redis-secrets",
    "rabbitmq-secrets",
    "security-secrets",
    "external-api-secrets",
    "sso-secrets",
    "messaging-secrets",
    "monitoring-secrets",
    "monitoring-basic-auth",
}


def fail(message: str) -> None:
    print("Production Kubernetes gate failed; inspect the protected validation log", file=sys.stderr)
    raise SystemExit(1)


if shutil.which("kubectl") is None:
    fail("kubectl is required to render and validate the production overlay")

result = subprocess.run(
    ["kubectl", "kustomize", str(OVERLAY)],
    cwd=ROOT,
    text=True,
    capture_output=True,
    check=False,
)
if result.returncode:
    fail("kustomize render failed; inspect kubectl output in a protected local session")

documents = [
    document
    for document in yaml.safe_load_all(result.stdout)
    if isinstance(document, dict)
]
if not documents:
    fail("overlay rendered no resources")

embedded_secrets = [
    document.get("metadata", {}).get("name", "<unnamed>")
    for document in documents
    if document.get("kind") == "Secret"
]
if embedded_secrets:
    fail("production overlay must not embed Secret objects: " + ", ".join(embedded_secrets))

objects = {
    (
        document.get("kind"),
        document.get("metadata", {}).get("namespace", ""),
        document.get("metadata", {}).get("name"),
    )
    for document in documents
}
errors: list[str] = []
referenced_external_secrets: set[str] = set()

for document in documents:
    kind = document.get("kind")
    metadata = document.get("metadata", {})
    namespace = metadata.get("namespace", "")
    owner = f"{kind}/{metadata.get('name', '<unnamed>')}"
    spec = document.get("spec", {})

    if namespace != "energy-production":
        errors.append(f"{owner}: expected namespace energy-production, got {namespace!r}")

    if kind == "Ingress":
        auth_secret = metadata.get("annotations", {}).get(
            "nginx.ingress.kubernetes.io/auth-secret"
        )
        if auth_secret:
            referenced_external_secrets.add(auth_secret)

    pod_spec = None
    if kind in {"Deployment", "StatefulSet", "DaemonSet", "Job"}:
        pod_spec = spec.get("template", {}).get("spec", {})

    if pod_spec:
        for container in pod_spec.get("containers", []) + pod_spec.get("initContainers", []):
            image = container.get("image", "")
            if image.endswith(":latest") or "@sha256:" not in image and ":" not in image:
                errors.append(f"{owner}: mutable or untagged image {image!r}")

            for env in container.get("env", []):
                value_from = env.get("valueFrom", {})
                secret_ref = value_from.get("secretKeyRef", {})
                secret_name = secret_ref.get("name")
                if secret_name and not secret_ref.get("optional", False):
                    referenced_external_secrets.add(secret_name)
                config_ref = value_from.get("configMapKeyRef", {})
                config_name = config_ref.get("name")
                if (
                    config_name
                    and not config_ref.get("optional", False)
                    and ("ConfigMap", namespace, config_name) not in objects
                ):
                    errors.append(f"{owner}: missing ConfigMap {config_name}")

            for env_from in container.get("envFrom", []):
                secret_ref = env_from.get("secretRef", {})
                secret_name = secret_ref.get("name")
                if secret_name and not secret_ref.get("optional", False):
                    referenced_external_secrets.add(secret_name)

        service_account = pod_spec.get("serviceAccountName")
        if (
            service_account
            and ("ServiceAccount", namespace, service_account) not in objects
        ):
            errors.append(f"{owner}: missing ServiceAccount {service_account}")

    if kind == "HorizontalPodAutoscaler":
        target = spec.get("scaleTargetRef", {})
        target_kind = target.get("kind")
        target_name = target.get("name")
        if (
            target_kind
            and target_name
            and (target_kind, namespace, target_name) not in objects
        ):
            errors.append(f"{owner}: missing scale target {target_kind}/{target_name}")

unexpected = referenced_external_secrets - {
    f"prod-{name}" for name in EXPECTED_EXTERNAL_SECRETS
}
if unexpected:
    errors.append("undocumented external Secrets: " + ", ".join(sorted(unexpected)))

missing_contract = {
    f"prod-{name}" for name in EXPECTED_EXTERNAL_SECRETS
} - referenced_external_secrets
if missing_contract:
    errors.append("unused or missing required Secret contract: " + ", ".join(sorted(missing_contract)))

if errors:
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    fail(f"{len(errors)} validation error(s)")

print(
    f"Production Kubernetes gate passed: {len(documents)} resources, "
    f"{len(referenced_external_secrets)} external Secret contracts"
)
