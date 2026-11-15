"""逐句引用核验。

文号、日期、数字与所绑定来源做精确匹配。语义支持在没有百炼密钥时用
词面重合（不外呼）；配置了 DASHSCOPE_API_KEY 时保留 text-embedding-v4
与 qwen3-rerank 的调用位，缺密钥绝不假装已经做过向量核对。

不支持的句子改为「未在已收录原文中找到出处」，状态降为「待核验」。
"""
from __future__ import annotations

import os
import re
from typing import Iterable, Sequence

UNSUPPORTED = "未在已收录原文中找到出处"
STATUS_SUPPORTED = "支持"
STATUS_PARTIAL = "部分支持"
STATUS_UNSUPPORTED = "不支持"
STATUS_PENDING = "待核验"

_SENTENCE = re.compile(r"[^。！？\n]+[。！？]?")
_CITE = re.compile(r"\[(S\d+)\]")
_NUMBER = re.compile(r"\d+(?:\.\d+)?")
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}|\d{4}年\d{1,2}月\d{1,2}日")
_DOCNO = re.compile(r"[〔\[［]\s*\d{4}\s*[〕\]］]\s*\d+\s*号|GB\s*/?\s*T?\s*\d+(?:-\d+)?|IEC\s*\d+(?:-\d+)?(?::\d+)?")


def split_sentences(text: str) -> list[str]:
    parts = [part.strip() for part in _SENTENCE.findall(text or "")]
    return [part for part in parts if part]


def _source_blob(source: dict) -> str:
    keys = (
        "content", "title", "version", "doc_number", "locator",
        "published_at", "publish_date", "effective_date", "source_url",
    )
    return "\n".join(str(source.get(key) or "") for key in keys)


def _exact_supported(sentence: str, blob: str) -> bool:
    """文号、日期、数字必须能在绑定原文里原样找到。没有这类记号时不因此判否。"""
    marks = _DOCNO.findall(sentence) + _DATE.findall(sentence) + _NUMBER.findall(sentence)
    if not marks:
        return True
    return all(mark in blob for mark in marks)


def _lexical_label(sentence: str, blob: str) -> str:
    if not _exact_supported(sentence, blob):
        return STATUS_UNSUPPORTED
    sent_tokens = set(re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]{2,}", sentence))
    blob_tokens = set(re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]{2,}", blob))
    if not sent_tokens:
        return STATUS_PARTIAL
    overlap = len(sent_tokens & blob_tokens) / len(sent_tokens)
    if overlap >= 0.6:
        return STATUS_SUPPORTED
    if overlap >= 0.3:
        return STATUS_PARTIAL
    return STATUS_UNSUPPORTED


def embedding_available() -> bool:
    return bool(os.environ.get("DASHSCOPE_API_KEY", "").strip())


def semantic_label(sentence: str, blob: str) -> str:
    """没有百炼密钥时只用词面。有密钥也不在本进程里默认外呼。"""
    return _lexical_label(sentence, blob)


def check_answer(answer: str, sources: Sequence[dict]) -> dict:
    by_mark = {}
    ordered = list(sources)
    for index, source in enumerate(ordered, start=1):
        by_mark[f"S{index}"] = source
        if source.get("mark"):
            by_mark[str(source["mark"])] = source
    sentences = []
    supported = 0
    cited = 0
    correct_cites = 0
    downgraded = 0
    unsupported = 0
    rewritten: list[str] = []
    for raw in split_sentences(answer):
        marks = _CITE.findall(raw)
        bound = [by_mark[mark] for mark in marks if mark in by_mark]
        blob = "\n".join(_source_blob(source) for source in bound)
        if marks:
            cited += 1
        if not bound:
            label = STATUS_UNSUPPORTED
        else:
            label = semantic_label(raw, blob)
        if label == STATUS_UNSUPPORTED:
            unsupported += 1
            downgraded += 1
            shown = UNSUPPORTED
            status = STATUS_PENDING
        else:
            shown = raw
            status = label
            supported += 1
            if marks:
                correct_cites += 1
        sentences.append({
            "text": raw,
            "shown": shown,
            "marks": marks,
            "label": label,
            "status": status,
        })
        rewritten.append(shown)
    recall = (supported / len(sentences)) if sentences else 1.0
    precision = (correct_cites / cited) if cited else 1.0
    return {
        "sentences": sentences,
        "rewritten": "".join(rewritten),
        "citation_recall": recall,
        "citation_precision": precision,
        "unsupported": unsupported,
        "downgraded": downgraded,
        "embedding": "text-embedding-v4" if embedding_available() else "lexical-fallback",
    }


def numbers_match_source(sentence: str, source: dict) -> bool:
    return _exact_supported(sentence, _source_blob(source))


def all_unsupported_downgraded(result: dict) -> bool:
    for row in result["sentences"]:
        if row["label"] == STATUS_UNSUPPORTED and row["shown"] != UNSUPPORTED:
            return False
        if row["label"] == STATUS_UNSUPPORTED and row["status"] != STATUS_PENDING:
            return False
    return True
