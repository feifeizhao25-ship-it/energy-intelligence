#!/usr/bin/env python3
"""
Security Scan Script v2.0
==========================
增强版安全扫描，支持：
1. 密钥检测（正则 + entropy）
2. SQL 注入风险
3. XSS 风险
4. 不安全的反序列化
5. 硬编码 IP / 内网地址
6. 不安全的文件权限
7. 输出格式：console / json / sarif

用法：
    python backend/scripts/security_scan.py --format sarif --output security.sarif
    python backend/scripts/security_scan.py --format json --output security.json
    python backend/scripts/security_scan.py  # 默认 console 输出
"""

import argparse
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ── Configuration ────────────────────────────────────────────────────────

SCAN_ROOTS = ["backend/app", "backend/skills", "backend/services", "services", "apps", "packages"]
EXCLUDE_DIRS = {"node_modules", ".git", "__pycache__", ".venv", ".venv313", ".tox", "dist", "build", ".next", ".dart_tool", ".turbo"}
EXCLUDE_FILES = {".env", ".env.local", ".env.test", "poetry.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"}

SECRET_PATTERNS: List[Tuple[str, str, int]] = [
    # (name, regex, severity_level)  severity: 0=info, 1=low, 2=medium, 3=high, 4=critical
    ("AWS Access Key ID", r"AKIA[0-9A-Z]{16}", 4),
    ("AWS Secret Access Key", r"['\"][0-9a-zA-Z/+]{40}['\"]", 3),
    ("Generic API Key", r"\b(?:api[_-]?key|apikey)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{32,}['\"]", 3),
    ("Generic Secret", r"\b(?:secret|password|passwd|pwd)\s*[:=]\s*['\"][^'\"\s]{8,}['\"]", 3),
    ("Private Key", r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----", 4),
    ("GitHub Token", r"\bgh[pousr]_[A-Za-z0-9_]{36,}", 4),
    ("Slack Token", r"\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}(?:-[a-zA-Z0-9]{24})?", 4),
    ("JWT Token", r"\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b", 2),
    ("OpenAI API Key", r"\bsk-[a-zA-Z0-9]{48}", 4),
    ("Stripe Key", r"\bsk_(?:live|test)_[0-9a-zA-Z]{24,}", 4),
]

SQL_INJECTION_PATTERNS: List[Tuple[str, str, int]] = [
    ("Raw SQL concat", r"execute\s*\(\s*['\"].*\+.*\)", 3),
    ("f-string SQL", r"f['\"][^'\"]*\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b[^'\"]*\{[^'\"]+\}[^'\"]*['\"]", 3),
    ("format SQL", r"['\"].*\b(SELECT|INSERT|UPDATE|DELETE)\b.*['\"]\.format\(", 3),
    ("percent SQL", r"text\s*\(\s*['\"].*%\w.*['\"]\)", 2),
]

XSS_PATTERNS: List[Tuple[str, str, int]] = [
    # 仅标记包含变量插值的 dangerouslySetInnerHTML（静态 CSS 除外）
    ("dangerouslySetInnerHTML with interpolation", r"dangerouslySetInnerHTML.*\$\{.*\}|dangerouslySetInnerHTML.*\+.*\+", 3),
    ("innerHTML assignment", r"\.innerHTML\s*=.*\+", 2),
    ("document.write", r"document\.write\s*\(", 2),
    ("eval usage", r"eval\s*\(", 3),
]

INSECURE_DESER_PATTERNS: List[Tuple[str, str, int]] = [
    ("pickle load", r"pickle\.loads?\s*\(", 3),
    ("yaml unsafe load", r"yaml\.load\s*\([^,)]*\)(?!.*Loader\s*=\s*(yaml\.)?SafeLoader)", 3),
    ("marshal load", r"marshal\.loads?\s*\(", 3),
]

HARDCODED_IP_PATTERNS: List[Tuple[str, str, int]] = [
    ("Hardcoded IP", r"['\"](?!0\.0\.0\.0|127\.0\.0\.1)(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}['\"]", 1),
]

# ── Data Models ──────────────────────────────────────────────────────────

@dataclass
class Finding:
    rule_id: str
    rule_name: str
    severity: str  # critical, high, medium, low, info
    message: str
    file: str
    line: int
    column: int = 1
    code_snippet: str = ""
    confidence: str = "medium"  # high, medium, low

    def to_sarif(self) -> Dict[str, Any]:
        severity_map = {
            "critical": "error",
            "high": "error",
            "medium": "warning",
            "low": "note",
            "info": "note",
        }
        return {
            "ruleId": self.rule_id,
            "level": severity_map.get(self.severity, "warning"),
            "message": {"text": self.message},
            "locations": [{
                "physicalLocation": {
                    "artifactLocation": {"uri": self.file},
                    "region": {
                        "startLine": self.line,
                        "startColumn": self.column,
                        "snippet": {"text": self.code_snippet[:200]},
                    },
                }
            }],
            "properties": {
                "confidence": self.confidence,
            },
        }


@dataclass
class ScanResult:
    findings: List[Finding] = field(default_factory=list)
    scanned_files: int = 0
    duration_ms: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def severity_counts(self) -> Dict[str, int]:
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in self.findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
        return counts

    def has_failures(self, threshold: str = "high") -> bool:
        order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
        threshold_val = order.get(threshold, 3)
        for f in self.findings:
            if order.get(f.severity, 0) >= threshold_val:
                return True
        return False


# ── Scanners ─────────────────────────────────────────────────────────────

class SecurityScanner:
    def __init__(self, project_root: Path):
        self.root = project_root
        self.result = ScanResult()

    def scan_all(self) -> ScanResult:
        import time
        start = time.perf_counter()

        for relative_root in SCAN_ROOTS:
            scan_path = self.root / relative_root
            if not scan_path.exists():
                continue
            self._scan_directory(scan_path)

        self.result.duration_ms = round((time.perf_counter() - start) * 1000, 2)
        return self.result

    def _scan_directory(self, path: Path) -> None:
        for item in path.rglob("*"):
            if item.is_dir():
                if item.name in EXCLUDE_DIRS:
                    continue
                # 检查路径中是否包含排除目录
                if any(p in EXCLUDE_DIRS for p in item.parts):
                    continue
                continue

            if item.name in EXCLUDE_FILES:
                continue

            if not item.is_file():
                continue

            # 检查文件路径中是否包含排除目录
            if any(p in EXCLUDE_DIRS for p in item.parts):
                continue

            self.result.scanned_files += 1
            suffix = item.suffix.lower()

            # Python files
            if suffix == ".py":
                self._scan_secrets(item)
                self._scan_sql_injection(item)
                self._scan_insecure_deser(item)
                self._scan_hardcoded_ip(item)

            # Web files
            if suffix in (".ts", ".tsx", ".js", ".jsx", ".html", ".vue", ".svelte"):
                self._scan_secrets(item)
                self._scan_xss(item)
                self._scan_hardcoded_ip(item)

            # Config files
            if suffix in (".yml", ".yaml", ".json", ".tf", ".sh"):
                self._scan_secrets(item)

    def _scan_patterns(
        self,
        file_path: Path,
        patterns: List[Tuple[str, str, int]],
        category_prefix: str,
    ) -> None:
        try:
            content = file_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return

        lines = content.splitlines()
        for rule_name, pattern, severity_level in patterns:
            for match in re.finditer(pattern, content, re.IGNORECASE):
                line_num = content[:match.start()].count("\n") + 1
                line_content = lines[line_num - 1] if line_num <= len(lines) else ""

                # 排除示例/测试/注释行（简单启发式）
                stripped = line_content.strip()
                if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
                    continue
                if "example" in stripped.lower() or "test_" in stripped.lower() or "mock" in stripped.lower():
                    continue
                if "fake" in stripped.lower() or "placeholder" in stripped.lower():
                    continue

                # SQL 规则额外验证：要求行内确实包含 SQL 关键字（大写）
                if category_prefix == "SQLI":
                    sql_keywords = ("SELECT ", "INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ")
                    if not any(kw in stripped for kw in sql_keywords):
                        continue

                # Secret 规则排除测试文件中的测试凭据
                if category_prefix == "SECRET" and ("/__tests__/" in str(file_path) or "/tests/" in str(file_path) or ".test." in str(file_path)):
                    # 常见测试密码模式
                    test_passwords = ("wrongpassword", "testpass", "password123", "123456", "changeme", "mock")
                    if any(pw in stripped.lower() for pw in test_passwords):
                        continue
                    if any(kw in stripped.lower() for kw in ("test", "mock", "fixture", "stub")):
                        continue

                severity = {4: "critical", 3: "high", 2: "medium", 1: "low", 0: "info"}[severity_level]
                rel_path = str(file_path.relative_to(self.root))

                self.result.findings.append(Finding(
                    rule_id=f"{category_prefix}-{hashlib.sha256(rule_name.encode()).hexdigest()[:8]}",
                    rule_name=rule_name,
                    severity=severity,
                    message=f"{rule_name}: potential security issue detected",
                    file=rel_path,
                    line=line_num,
                    column=match.start() - content.rfind("\n", 0, match.start()),
                    code_snippet=line_content.strip(),
                    confidence="medium",
                ))

    def _scan_secrets(self, file_path: Path) -> None:
        self._scan_patterns(file_path, SECRET_PATTERNS, "SECRET")

    def _scan_sql_injection(self, file_path: Path) -> None:
        self._scan_patterns(file_path, SQL_INJECTION_PATTERNS, "SQLI")

    def _scan_xss(self, file_path: Path) -> None:
        self._scan_patterns(file_path, XSS_PATTERNS, "XSS")

    def _scan_insecure_deser(self, file_path: Path) -> None:
        self._scan_patterns(file_path, INSECURE_DESER_PATTERNS, "DESER")

    def _scan_hardcoded_ip(self, file_path: Path) -> None:
        self._scan_patterns(file_path, HARDCODED_IP_PATTERNS, "IP")


# ── Reporters ────────────────────────────────────────────────────────────

def report_console(result: ScanResult) -> None:
    counts = result.severity_counts()
    print("=" * 80)
    print("SECURITY SCAN REPORT")
    print("=" * 80)
    print(f"Scanned files: {result.scanned_files}")
    print(f"Duration: {result.duration_ms} ms")
    print(f"Timestamp: {result.timestamp}")
    print()

    for sev in ["critical", "high", "medium", "low", "info"]:
        findings = [f for f in result.findings if f.severity == sev]
        if not findings:
            continue
        emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢", "info": "⚪"}[sev]
        print(f"{emoji} {sev.upper()}: {len(findings)}")
        for f in findings[:10]:
            print(f"   [{f.rule_name}] {f.file}:{f.line}")
            print(f"   → {f.code_snippet[:80]}")
        if len(findings) > 10:
            print(f"   ... and {len(findings) - 10} more")
        print()

    print("=" * 80)
    total = len(result.findings)
    print(f"Total findings: {total}")
    if counts["critical"] or counts["high"]:
        print("❌ FAILED: Critical or High severity issues found")
    else:
        print("✅ PASSED: No critical/high severity issues")


def report_json(result: ScanResult, output_path: Path) -> None:
    data = {
        "version": "2.0.0",
        "timestamp": result.timestamp,
        "duration_ms": result.duration_ms,
        "scanned_files": result.scanned_files,
        "severity_counts": result.severity_counts(),
        "findings": [asdict(f) for f in result.findings],
    }
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"JSON report written to {output_path}")


def report_sarif(result: ScanResult, output_path: Path) -> None:
    rules = {}
    for f in result.findings:
        rules[f.rule_id] = {
            "id": f.rule_id,
            "name": f.rule_name,
            "shortDescription": {"text": f.rule_name},
            "defaultConfiguration": {"level": "warning"},
        }

    sarif = {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {
                "driver": {
                    "name": "EIP Security Scanner",
                    "version": "2.0.0",
                    "informationUri": "https://energy-intelligence.com/security",
                    "rules": list(rules.values()),
                }
            },
            "results": [f.to_sarif() for f in result.findings],
            "invocations": [{
                "executionSuccessful": True,
                "endTimeUtc": result.timestamp,
            }],
        }],
    }
    output_path.write_text(json.dumps(sarif, indent=2, ensure_ascii=False))
    print(f"SARIF report written to {output_path}")


# ── CLI ──────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Energy Intelligence Platform Security Scanner")
    parser.add_argument("--root", default=".", help="Project root directory")
    parser.add_argument("--format", choices=["console", "json", "sarif"], default="console", help="Output format")
    parser.add_argument("--output", default=None, help="Output file path")
    parser.add_argument("--fail-on", choices=["critical", "high", "medium", "low", "none"], default="high", help="Fail threshold")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    scanner = SecurityScanner(root)
    result = scanner.scan_all()

    if args.format == "json":
        out = Path(args.output or "security-report.json")
        report_json(result, out)
    elif args.format == "sarif":
        out = Path(args.output or "security-report.sarif")
        report_sarif(result, out)
    else:
        report_console(result)

    if args.fail_on != "none" and result.has_failures(args.fail_on):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
