"""One citation line for an answer, a copy, and a PDF or Word export.

A locator is included only when the record has one. A pending or
machine-extracted record is labelled as not a published, human-reviewed source.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

_URL = re.compile(r"https?://[^\s<>]+")

UNPUBLISHED_STATUS = {"待核实", "待审核"}
BLOCKED_EVIDENCE = {"pending", "quarantined", "invalid"}
EXCERPT_LIMIT = 180


def is_blocked_from_retrieval(doc: Dict[str, Any]) -> bool:
    """Candidates that are still unverified must not be retrieved as published sources."""
    if str(doc.get("status") or "") in UNPUBLISHED_STATUS:
        return True
    return str(doc.get("evidence_status") or "") in BLOCKED_EVIDENCE


def excerpt_of(text: Any, limit: int = EXCERPT_LIMIT) -> Optional[str]:
    raw = " ".join(str(text or "").split())
    if not raw:
        return None
    if len(raw) <= limit:
        return raw
    cut = raw[:limit].rsplit(" ", 1)[0]
    return cut or raw[:limit].rstrip()


_SYNTHETIC_HOSTS = {"example.com", "example.org", "example.cn", "example.gov"}


def _host(url: str) -> str:
    return str(url or "").split("//")[-1].split("/")[0].split(":")[0].lower()


def is_synthetic_source(src: Dict[str, Any]) -> bool:
    host = _host(str(src.get("url") or src.get("source_url") or ""))
    return host in _SYNTHETIC_HOSTS or host.endswith(".example.com") or host.endswith(".example.gov")


def synthetic_banner(lang: str = "zh") -> str:
    if lang == "en":
        return (
            "SYNTHETIC TEST DATA. This file is not a publication of the National Energy "
            "Administration, the IRS, or any other authority. Do not deliver it as a real source."
        )
    return "合成测试数据。本文件不是国家能源局、税务机关或其他机构的出版物，不得当作真实来源交付。"


def publication_note(src: Dict[str, Any], lang: str = "zh") -> Optional[str]:
    en = lang == "en"
    status = str(src.get("status") or "")
    evidence = str(src.get("evidence_status") or "")
    notes = []
    if is_synthetic_source(src):
        notes.append("SYNTHETIC TEST DATA. Not a real publication." if en else "合成测试数据。不是真实出版物。")
    if status in UNPUBLISHED_STATUS or evidence in BLOCKED_EVIDENCE:
        notes.append(
            "Not published: pending review. Do not treat this as a released source."
            if en else
            "未发布：待审核。不得当作已发布来源。"
        )
    elif evidence == "auto_extracted":
        notes.append(
            "Review: machine extract, not a human-reviewed publication."
            if en else
            "审核：机器摘录，未经人工复核，不是已发布文本。"
        )
    elif evidence == "legacy_unreviewed":
        notes.append(
            "Review status: not recorded as a human review."
            if en else
            "审核状态：没有人工复核记录。"
        )
    return " ".join(notes) or None


def date_lines(src: Dict[str, Any], lang: str = "zh") -> list:
    """Label each date by what the file actually is. Never call a metadata date Published."""
    en = lang == "en"
    lines = []
    kind = str(src.get("date_kind") or "")
    published = src.get("published_at")
    if kind == "pdf_creation" and published:
        lines.append(
            f"PDF file metadata date (CreationDate): {published}. Printed publication date: unknown."
            if en else
            f"PDF文件元数据日期（CreationDate）：{published}。印刷发布日期：未知。"
        )
    elif kind == "page_release" and published:
        lines.append(f"Page release time: {published}." if en else f"页面发布时间：{published}。")
    elif kind == "printed_on_page" and published:
        lines.append(f"Date printed on the page: {published}." if en else f"页面所印日期：{published}。")
    elif published:
        lines.append(
            f"Date on record: {published}. Date type: not stated."
            if en else
            f"记录中的日期：{published}。日期类型：未标明。"
        )
    issued = src.get("publish_date") or src.get("issue_date")
    if issued and not en:
        lines.append(f"发文日期：{issued}。")
    if src.get("sign_date"):
        lines.append(f"Signature date: {src['sign_date']}." if en else f"落款日期：{src['sign_date']}。")
    if src.get("effective_date_stated") is True and src.get("effective_date"):
        basis = src.get("effective_date_basis")
        line = f"Effective date: {src['effective_date']}." if en else f"生效日：{src['effective_date']}。"
        if basis:
            line = f"{line} {basis}"
        lines.append(line)
    elif src.get("effective_date_stated") is False:
        basis = src.get("effective_date_basis")
        lines.append(
            f"Effective date: not stated as a single date. {basis}".rstrip()
            if en else
            f"生效日：原文未写单一施行日。{basis or ''}".rstrip()
        )
    if src.get("expiry_date"):
        lines.append(
            f"Expiry date on the record: {src['expiry_date']}."
            if en else
            f"记录中的届满日：{src['expiry_date']}。"
        )
    if src.get("superseded_by"):
        lines.append(
            f"Record says superseded by: {src['superseded_by']}."
            if en else
            f"记录写明被替代：{src['superseded_by']}。"
        )
    if src.get("primary_checked_at"):
        lines.append(
            f"Primary page read on {src['primary_checked_at']}. This is not a human review."
            if en else
            f"对照原文阅读：{src['primary_checked_at']}。这不是人工审核。"
        )
    return lines


def format_citation(index: int, src: Dict[str, Any], lang: str = "zh") -> str:
    """Stable citation line. Missing locator, date, or review fields are omitted, not invented."""
    en = lang == "en"
    title = src.get("title") or ("Untitled source" if en else "未命名来源")
    url = src.get("url") or src.get("source_url") or ("no URL" if en else "无URL")
    parts = [f"[{index}] {title}", str(url)]
    authors = src.get("authors")
    if authors:
        parts.append(f"Authors: {authors}" if en else f"作者：{authors}")
    version = src.get("version")
    if version:
        parts.append(f"Version: {version}" if en else f"版本：{version}")
    org = src.get("publisher") or src.get("source_org")
    if org:
        parts.append(f"Publisher: {org}" if en else f"机构：{org}")
    issuer = src.get("issuer")
    if issuer and issuer != org:
        parts.append(f"Issuing body: {issuer}" if en else f"发文机关：{issuer}")
    parts.extend(date_lines(src, lang))
    locator = src.get("locator")
    if locator:
        parts.append(f"Locator: {locator}" if en else f"页码/段落：{locator}")
    excerpt = src.get("excerpt") or excerpt_of(src.get("content"))
    if excerpt:
        parts.append(f"Excerpt: {excerpt}" if en else f"摘录：{excerpt}")
    retrieved = src.get("retrieved_at")
    parts.append(
        f"Retrieved: {retrieved or 'not recorded'}" if en else f"获取日期：{retrieved or '未记录'}"
    )
    freshness = src.get("freshness_status")
    if freshness and freshness != "unknown":
        parts.append(f"Freshness: {freshness}" if en else f"时效：{freshness}")
    note = publication_note(src, lang)
    if note:
        parts.append(note)
    license_note = src.get("license_note") or src.get("license")
    if license_note:
        parts.append(f"License: {license_note}" if en else f"许可：{license_note}")
    return " | ".join(str(part) for part in parts)


def pdf_link_markup(text: str) -> str:
    """Escape text for a ReportLab paragraph and make each URL a link."""
    raw = str(text)

    def esc(value: str) -> str:
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    pieces = []
    last = 0
    for match in _URL.finditer(raw):
        pieces.append(esc(raw[last:match.start()]))
        url = match.group(0).rstrip(".,;)")
        pieces.append(f'<link href="{esc(url)}" color="blue">{esc(url)}</link>')
        last = match.end()
    pieces.append(esc(raw[last:]))
    return "".join(pieces)
