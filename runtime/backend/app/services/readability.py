"""回答与模板文案的可读性。不达标时改写一次，仍不达标则进入抽检。"""
from __future__ import annotations

import re

_SENTENCE = re.compile(r"[^。！？\n]+[。！？]?")
_NUMBER = re.compile(r"\d+(?:\.\d+)?")
_UNIT = re.compile(r"千瓦时|元|年|月|日|号|%|千瓦|兆瓦|小时|米|吨|伏|安")
_AS_OF = re.compile(r"截至|作为|公布于|\d{4}-\d{2}-\d{2}|\d{4}年")


def split_sentences(text: str) -> list[str]:
    return [part.strip() for part in _SENTENCE.findall(text or "") if part.strip()]


def unexplained_terms(text: str, glossary: list[str]) -> list[str]:
    found = []
    for term in glossary:
        if term and term in text and f"{term}（" not in text and f"{term}(" not in text:
            found.append(term)
    return found


def assess(text: str, glossary: list[str] | None = None) -> dict:
    glossary = glossary or []
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text or "") if part.strip()] or [text or ""]
    sentences = split_sentences(text)
    lengths = [len(re.sub(r"[。！？\s]", "", sentence)) for sentence in sentences]
    average = (sum(lengths) / len(lengths)) if lengths else 0
    long_paragraphs = []
    for paragraph in paragraphs:
        if len(split_sentences(paragraph)) > 4:
            long_paragraphs.append(paragraph)
    naked_numbers = []
    for sentence in sentences:
        if _NUMBER.search(sentence) and not _UNIT.search(sentence):
            naked_numbers.append(sentence)
        elif _NUMBER.search(sentence) and not _AS_OF.search(sentence) and not _AS_OF.search(text or ""):
            naked_numbers.append(sentence)
    terms = unexplained_terms(text, glossary)
    issues = []
    if average > 35:
        issues.append("句长")
    if long_paragraphs:
        issues.append("段长")
    if len(terms) > 2:
        issues.append("术语")
    if naked_numbers:
        issues.append("数字")
    return {
        "ok": not issues,
        "issues": issues,
        "average_sentence_length": average,
        "unexplained": terms,
        "sentences": len(sentences),
    }


def rewrite_once(text: str) -> str:
    """把长句按逗号拆开，并补上截至说明。只改写一次。"""
    parts = []
    for sentence in split_sentences(text):
        body = sentence.rstrip("。！？")
        if len(body) > 35 and "，" in body:
            chunks = [chunk for chunk in body.split("，") if chunk]
            parts.extend(f"{chunk}。" for chunk in chunks)
        else:
            parts.append(sentence if sentence.endswith(("。", "！", "？")) else f"{sentence}。")
    rewritten = "".join(parts)
    if not _AS_OF.search(rewritten):
        rewritten += "截至日期见所引用原文。"
    return rewritten


def ensure_readable(text: str, glossary: list[str] | None = None) -> dict:
    first = assess(text, glossary)
    if first["ok"]:
        return {"text": text, "rewritten": False, "ok": True, "review": False, "assessment": first}
    rewritten = rewrite_once(text)
    second = assess(rewritten, glossary)
    return {
        "text": rewritten,
        "rewritten": True,
        "ok": second["ok"],
        "review": not second["ok"],
        "assessment": second,
    }
