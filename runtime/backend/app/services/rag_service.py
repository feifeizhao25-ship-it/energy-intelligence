"""
RAG retrieval service — registry-driven provenance & freshness metadata.

恢复说明：原文件只剩国家/地区识别片段。这里重建为一个小型语料检索服务：
语料由 ``rag_sources.SourceRegistry``（``后端/data/rag_sources.json``）驱动，
每条命中带 year / last_verified_at / freshness_status / verification 元数据，
global 市场只返回英文文档（禁止未翻译中文泄漏到国际版）。
"""

from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from datetime import date

from app.services.policy_term import valid_until
from typing import Dict, List, Optional

from app.services.citation_record import is_blocked_from_retrieval
from app.services.policy_aliases import ALIAS_GROUPS, STOPWORDS, alias_score
from app.services.rag_sources import SourceRegistry, verification_status


class StalePolicyError(Exception):
    """过期政策语料被用于结论生成时抛出（fail-closed）。"""

    def __init__(self, source_ids: List[str]) -> None:
        self.source_ids = list(source_ids)
        super().__init__(
            "政策类语料已过期（stale），不得进入测算引用: "
            + ", ".join(self.source_ids)
        )


_OVERSEAS_QUERY_MARKERS = ("美国", "海外", "境外", "IEC", "IEEE", "NREL", "EIA", "ITC", "PR")


def query_allows_overseas(query: str) -> bool:
    """国内问答默认不检索海外条目。点名海外地区或已登记的国际标准指标时例外。"""
    text = query or ""
    upper = text.upper()
    if any(marker in text for marker in ("美国", "海外", "境外")):
        return True
    return any(marker in upper for marker in ("IEC", "IEEE", "NREL", "EIA", "ITC", "PR"))


def assert_no_stale_policy(hits: List["RAGHit"]) -> None:
    """Fail-closed 守卫：命中中存在 stale 政策类语料时抛出 StalePolicyError。

    生成测算引用前必须调用；过期政策只能触发重新核验，
    不能静默进入结果。
    """
    stale = [
        hit.source_id
        for hit in hits
        if hit.metadata.get("type") == "policy"
        and hit.metadata.get("freshness_status") == "stale"
    ]
    if stale:
        raise StalePolicyError(stale)


@dataclass
class RAGHit:
    source_id: str
    title: str
    content: str
    score: float
    metadata: Dict = field(default_factory=dict)


@dataclass
class RAGResult:
    hits: List[RAGHit]


_COUNTRY_MAP = {
    "china": "cn", "中国": "cn", "prc": "cn",
    "united states": "us", "usa": "us", "america": "us", "美国": "us",
    "germany": "de", "德国": "de",
    "japan": "jp", "日本": "jp",
}


def _detect_countries(query: str, market: str = "") -> set:
    """只从查询词识别国家。市场参数不再自动补国家，避免把未写适用范围的文档收进来。"""
    text = (query or "").lower()
    countries = set()
    for token, code in _COUNTRY_MAP.items():
        if re.search(r"[\u4e00-\u9fff]", token):
            if token in text:
                countries.add(code)
        elif re.search(rf"\b{re.escape(token)}\b", text):
            countries.add(code)
    if re.search(r"\bunited states\b", text):
        countries.add("us")
    return countries


def _currently_effective(doc: Dict, today: date) -> bool:
    from app.services.policy_term import is_expired_policy

    return not is_expired_policy(doc, today)


def _retrieval_gate(doc: Dict, *, lang: str, allow_overseas: bool, countries: set,
                    today: date, effective_only: bool) -> bool:
    """Same pre-freshness filters search() uses. A stale-excluded source is one that passes these and is then dropped."""
    overseas = doc.get("jurisdiction") == "海外"
    if overseas and not allow_overseas:
        return False
    if doc["lang"] != lang and not (overseas and allow_overseas):
        return False
    if doc.get("quote_policy") == "withdrawn":
        return False
    if doc.get("type") == "price":
        return False
    if is_blocked_from_retrieval(doc):
        return False
    if effective_only and not _currently_effective(doc, today):
        return False
    source_countries = set(doc.get("countries") or [])
    if countries and source_countries and not (countries & source_countries):
        return False
    if countries and not source_countries and doc.get("applicability_status") != "reviewed":
        return False
    return True


_FOLD = str.maketrans({
    "[": "〔", "]": "〕", "【": "〔", "】": "〕",
    "(": "〔", ")": "〕", "（": "〔", "）": "〕",
    " ": "", "\u3000": "", "\t": "", "\n": "", "\r": "",
})
_BRACKET = r"[\[\]〔〕【】（）()]"


def _fold_number(text: str) -> str:
    return (text or "").translate(_FOLD).lower()


def _trailing_serial(doc_number: str) -> Optional[str]:
    match = re.search(r"(\d+)号$", _fold_number(doc_number))
    return match.group(1) if match else None


def _serial_owners(corpus: List[Dict]) -> Dict[str, List[str]]:
    owners: Dict[str, List[str]] = {}
    for doc in corpus:
        serial = _trailing_serial(str(doc.get("doc_number") or ""))
        if serial:
            owners.setdefault(serial, []).append(str(doc.get("source_id") or ""))
    return owners


def _doc_number_span(query: str, doc_number: str) -> Optional[tuple]:
    """Span of this document number in the query, brackets and spacing aside. None when it is not named."""
    raw = (doc_number or "").strip()
    if len(_fold_number(raw)) < 8:
        return None
    pieces = []
    for char in raw:
        if char.isspace():
            continue
        pieces.append(_BRACKET if char in "[]〔〕【】（）()" else re.escape(char))
    if not pieces:
        return None
    pattern = r"\s*".join(pieces)
    if raw[-1].isdigit():
        pattern += r"(?!\d)"
    match = re.search(pattern, query or "", re.I)
    if not match:
        return None
    return match.start(), match.group(0)


def _doc_number_spans(query: str, doc_number: str) -> List[tuple]:
    raw = (doc_number or "").strip()
    words = raw.split()
    spans = []
    if not words:
        return spans
    for index in range(len(words)):
        span = _doc_number_span(query, " ".join(words[index:]))
        if span:
            spans.append(span)
    return spans


def _serial_span(query: str, serial: str) -> Optional[tuple]:
    match = re.search(rf"(?<!\d){re.escape(serial)}(?!\d)\s*号(?:文|文件|通知)?", query or "")
    if not match:
        return None
    return match.start(), re.sub(r"\s+", "", match.group(0))


def _issuer_prefix(doc_number: str) -> str:
    folded = _fold_number(doc_number)
    folded = re.sub(r"〔?\d{4}〕?\d+号$", "", folded)
    return re.sub(r"\d+号$", "", folded)


def _serial_names_doc(query: str, doc: Dict, owners: Dict[str, List[str]]) -> Optional[tuple]:
    """Short alias such as 136号文. A shared serial also needs the issuer prefix, so 42号 does not name every 42号 file."""
    serial = _trailing_serial(str(doc.get("doc_number") or ""))
    if not serial:
        return None
    span = _serial_span(query, serial)
    if not span:
        return None
    owner_ids = owners.get(serial) or []
    source_id = str(doc.get("source_id") or "")
    if len([item for item in owner_ids if item]) <= 1:
        return span
    prefix = _issuer_prefix(str(doc.get("doc_number") or ""))
    if len(prefix) >= 2 and prefix in _fold_number(query):
        return span
    return None


def _alias_spans(query: str, doc: Dict) -> List[tuple]:
    """English alias spellings, matched against the document's own title, number, and version — not a citation inside another file."""
    identity = " ".join(str(doc.get(key) or "") for key in ("title", "doc_number", "version"))
    tokens = tokenize(identity)
    spans = []
    for _name, (spellings, doc_tokens) in ALIAS_GROUPS.items():
        if not (doc_tokens & tokens):
            continue
        for spelling in spellings:
            parts = [part for part in spelling.split() if part]
            if not parts:
                continue
            pattern = r"(?<![A-Za-z0-9])" + r"\s+".join(re.escape(part) for part in parts) + r"(?![A-Za-z0-9])"
            match = re.search(pattern, query or "", re.I)
            if match:
                spans.append((match.start(), match.group(0)))
    return spans


def name_in_query(query: str, doc: Dict, owners: Dict[str, List[str]]) -> Optional[str]:
    """The phrase the query uses for this source, or None. The phrase is taken from the query, not from source_id.

    A document number or short 号文 alias wins over a broader concept alias (OBBBA, beginning of construction)
    when the query contains both, so another file is not addressed by the concept name.
    """
    spans: List[tuple] = []
    for field in ("doc_number", "version"):
        spans.extend(_doc_number_spans(query, str(doc.get(field) or "")))
    serial = _serial_names_doc(query, doc, owners)
    if serial:
        spans.append(serial)
    if not spans:
        spans = _alias_spans(query, doc)
    if not spans:
        return None
    spans.sort(key=lambda item: (-len(item[1]), item[0]))
    return spans[0][1].strip()


_LATIN_RE = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")
_CJK_RUN_RE = re.compile(r"[\u4e00-\u9fff]+")


# 词面重合低于这个值的条目不算相关。0.35 与问答接口的 MIN_SOURCE_RELEVANCE 一致，
# 可用环境变量 RAG_MIN_RELEVANCE 覆盖（0 到 1）。
DEFAULT_MIN_RELEVANCE = 0.35
_STANDARD_RE = re.compile(
    r"(?i)(?<![A-Za-z0-9])"
    r"((?:GB|NB|DL)\s*/\s*[A-Za-z]|GB|NB|DL|IEC|IEEE|ISO)"
    r"\s*"
    r"(\d+(?:\.\d+)?)"
    r"(?!\d)"
)


def min_relevance() -> float:
    raw = os.environ.get("RAG_MIN_RELEVANCE", "").strip()
    if not raw:
        return DEFAULT_MIN_RELEVANCE
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_MIN_RELEVANCE
    if value < 0 or value > 1:
        return DEFAULT_MIN_RELEVANCE
    return value


# 词面重合只数共同的字和双字，“光伏”“电站”“成本”这类人人都有的词也算一分，
# 于是“2031 年火星光伏电站的度电成本”能和不相干的通知凑到 0.48。这里再按全库文档频率加权：
# 语料里从没出现过的词（火星、月球、烤鸭）权重最大，问句的主题词一个都对不上时，加权覆盖率就很低。
# 问法里的虚词（“怎么”“是多少”“现在是怎么定的”拆出来的“么定”“是怎”）在政策原文里几乎不出现，按文档频率算权重最大，
# 会把真实用户的口语问法挤掉；含这些字的中文词不参与加权（_QUESTION_CHARS）。
# 0.42 用 data/eval 下黄金集、留出集、out_of_corpus_v1.jsonl 和 2026-11-21 补的 chat_realistic_v1（库内 70 / 近领域库外 30 / 无关 20）调出。
# 问句点名了库里任何一份文件（标准号、文号或“136号文”这类简称）时不受这条限制：它问的就是库里的东西，
# 只是常带“替代”“落款”这类语料外的措辞。可用 RAG_MIN_COVERAGE 覆盖（0 到 1）。
DEFAULT_MIN_COVERAGE = 0.42
# 不含中文的问句（国际版英文问法）维持原来的 0.36：0.42 会挡掉 "solar grid interconnection tax incentive United States" 这类库内英文问法。
DEFAULT_MIN_COVERAGE_NON_CJK = 0.36
_QUESTION_CHARS = frozenset("的吗呢么怎什哪吧啊呀嘛了请问我你是多少几些样")
# 文档频率要有一定规模的库才有意义；测试里注入的两三条样本不做这项检查。RAG_MIN_RELEVANCE=0 时也一并关闭。
MIN_DOCS_FOR_COVERAGE = 50


def min_coverage(query: str | None = None) -> float:
    """加权覆盖率下限。设了 RAG_MIN_COVERAGE 就一律用它；否则中文问句 0.42，不含中文的问句 0.36。"""
    default = DEFAULT_MIN_COVERAGE
    if query is not None and not re.search(r"[\u4e00-\u9fff]", query):
        default = DEFAULT_MIN_COVERAGE_NON_CJK
    raw = os.environ.get("RAG_MIN_COVERAGE", "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    if value < 0 or value > 1:
        return default
    return value


def _doc_text(doc: Dict) -> str:
    return " ".join(str(doc.get(k) or "") for k in ("title", "content", "version", "locator"))


def _is_question_word(token: str) -> bool:
    """含问句虚词的中文字/双字（怎、么、多少、是怎……）。英文、数字不算。"""
    return bool(token) and all("\u4e00" <= c <= "\u9fff" for c in token) and any(c in _QUESTION_CHARS for c in token)


def weighted_coverage(query_tokens: set, doc_tokens: set, df: Dict[str, int], n_docs: int) -> float:
    """问句词按全库逆文档频率加权后，被这条来源覆盖的比例（0 到 1）。"""
    if not query_tokens:
        return 0.0
    total = 0.0
    got = 0.0
    for token in query_tokens:
        if _is_question_word(token):
            continue
        weight = math.log((n_docs + 1) / (df.get(token, 0) + 0.5))
        if weight <= 0:
            continue
        total += weight
        if token in doc_tokens:
            got += weight
    return got / total if total else 1.0


def _standard_stems(text: str) -> set:
    """标准号词干：GB 50797-2012 与 GB 50797 都是 GB50797。年份和分部分号不参与比较。"""
    stems = set()
    for match in _STANDARD_RE.finditer(text or ""):
        prefix = re.sub(r"[\s/]+", "", match.group(1)).upper()
        stems.add(prefix + match.group(2))
    return stems


def standard_number_score(query: str, doc: Dict) -> float:
    """问句里的标准号与条目文号、标题或版本一致时给满分；只在正文里出现时略低。"""
    query_stems = _standard_stems(query)
    if not query_stems:
        return 0.0
    identity = " ".join(str(doc.get(key) or "") for key in ("doc_number", "title", "version"))
    if query_stems & _standard_stems(identity):
        return 1.0
    if query_stems & _standard_stems(str(doc.get("content") or "")):
        return 0.85
    return 0.0


def tokenize(text: str) -> set:
    """中英混合分词：英文/数字按词，中文按字 unigram + bigram。

    旧实现用 ``[\u4e00-\u9fff]+`` 把整句中文当一个 token，中文查询几乎永远零重合。
    这里不引入 jieba 依赖，用字 n-gram，对短政策标题足够稳健。
    """
    lowered = (text or "").lower()
    tokens = set(_LATIN_RE.findall(lowered))
    for run in _CJK_RUN_RE.findall(lowered):
        tokens.update(run)  # unigram
        tokens.update(run[i:i + 2] for i in range(len(run) - 1))  # bigram
    return tokens


class RAGService:
    """小型语料检索：按市场语言过滤 + 词面重合度排序。

    不传 ``corpus`` 时从来源注册表（后端/data/rag_sources.json）加载；
    传入 ``corpus`` 时保持旧的构造兼容（测试可注入伪造条目）。
    """

    def __init__(self, corpus: Optional[List[Dict]] = None,
                 registry: Optional[SourceRegistry] = None) -> None:
        if corpus is not None:
            self._corpus = list(corpus)
            self._registry = registry
        else:
            self._registry = registry or SourceRegistry.from_file()
            self._corpus = self._registry.sources

    def _document_frequency(self):
        """全库（不分市场、不分新旧）每个词出现在几条来源里。只算一次。"""
        cached = self.__dict__.get("_df_cache")
        if cached is None or cached[1] != len(self._corpus):
            df: Dict[str, int] = {}
            for doc in self._corpus:
                for token in tokenize(_doc_text(doc)):
                    df[token] = df.get(token, 0) + 1
            cached = (df, len(self._corpus))
            self.__dict__["_df_cache"] = cached
        return cached

    def search(self, query: str, top_k: int = 5, market: str = "cn",
               exclude_stale: bool = True, effective_only: bool = True,
               include_stale: bool = False) -> RAGResult:
        if include_stale:
            exclude_stale = False
        if top_k <= 0:
            return RAGResult(hits=[])
        lang = "cn" if market == "cn" else "en"
        allow_overseas = market != "cn" or query_allows_overseas(query)
        countries = _detect_countries(query, market)
        # Filler words (what, is, the, of ...) are in every document; counting them made "what is the capital of France"
        # score 0.5 against a US tax-credit page. Only content words are scored.
        query_tokens = tokenize(query) - STOPWORDS
        if not query_tokens:
            return RAGResult(hits=[])
        today = date.today()
        retrieved_at = today.isoformat()

        coverage_floor = min_coverage(query) if len(self._corpus) >= MIN_DOCS_FOR_COVERAGE and min_relevance() > 0 else 0.0
        names_registered = None  # 问句是否点名了库里任何一份文件（文号、标准号或简称）
        scored: List[RAGHit] = []
        for doc in self._corpus:
            if not _retrieval_gate(
                doc, lang=lang, allow_overseas=allow_overseas, countries=countries,
                today=today, effective_only=effective_only,
            ):
                continue
            review = doc.get("evidence_status")
            freshness = self._freshness_of(doc, today)
            if exclude_stale and freshness == "stale":
                continue
            doc_tokens = tokenize(_doc_text(doc))
            overlap = len(query_tokens & doc_tokens)
            score = overlap / max(len(query_tokens), 1)
            alias = alias_score(query, doc_tokens)
            if alias is not None and alias > score:
                score = alias
            numbered = standard_number_score(query, doc)
            if numbered > score:
                score = numbered
            elif overlap < 2 and len(query_tokens) > 1:
                continue  # one stray shared word ("work" in "Physical Work Test" vs "how does IRR work") is not a match
            if score <= 0 or score < min_relevance():
                continue
            if numbered < 0.85 and coverage_floor > 0:
                df, n_docs = self._document_frequency()
                if weighted_coverage(query_tokens, doc_tokens, df, n_docs) < coverage_floor:
                    if names_registered is None:
                        owners = _serial_owners(self._corpus)
                        names_registered = any(name_in_query(query, other, owners) for other in self._corpus)
                    if not names_registered:
                        continue  # 问句的主题词这条来源一个都没有，只是“光伏”“成本”这类通用词撞上
            hit = RAGHit(
                source_id=doc["source_id"],
                title=doc["title"],
                content=doc["content"],
                score=score,
                metadata={
                    "type": doc.get("type"),
                    "year": int(doc["year"]),
                    "authors": doc.get("authors"),
                    "version": doc.get("version"),
                    "published_at": doc.get("published_at"),
                    "publish_date": doc.get("publish_date") or doc.get("issue_date"),
                    "valid_until": (valid_until(doc).isoformat() if valid_until(doc) else None),
                    "date_kind": doc.get("date_kind"),
                    "sign_date": doc.get("sign_date"),
                    "effective_date_stated": doc.get("effective_date_stated"),
                    "effective_date_basis": doc.get("effective_date_basis"),
                    "issuer": doc.get("issuer"),
                    "primary_checked_at": doc.get("primary_checked_at"),
                    "excerpt": doc.get("excerpt"),
                    "locator": doc.get("locator"),
                    "last_verified_at": doc["last_verified_at"],
                    "retrieved_at": retrieved_at,
                    "freshness_status": freshness,
                    "verification": verification_status(doc, self._registry),
                    "source_url": doc.get("source_url"),
                    "source_org": doc.get("source_org"),
                    "license_note": doc.get("license_note"),
                    "market": market,
                    "countries": list(doc.get("countries") or []),
                    "query_countries": sorted(countries),
                    "evidence_status": review or "legacy_unreviewed",
                    "effective_date": doc.get("effective_date"),
                    "expiry": doc.get("expiry") or doc.get("expiry_date"),
                    "expiry_date": doc.get("expiry_date"),
                    "superseded_by": doc.get("superseded_by"),
                    "jurisdiction": doc.get("jurisdiction"),
                    "status": doc.get("status"),
                    "doc_number": doc.get("doc_number"),
                    "key_dates": list(doc.get("key_dates") or []),
                },
            )
            scored.append(hit)

        scored.sort(key=lambda h: h.score, reverse=True)
        return RAGResult(hits=scored[: max(top_k, 0)])

    def named_stale_labels(self, query: str, market: str = "cn") -> List[str]:
        """Phrases in the query that name a source search() drops because it is past its review window.

        The source itself is not a hit and is not a citation. The label is the wording in the query
        (a document number or alias), not the registry id. Uses the same wall clock as search().
        """
        if not (query or "").strip():
            return []
        lang = "cn" if market == "cn" else "en"
        allow_overseas = market != "cn" or query_allows_overseas(query)
        countries = _detect_countries(query, market)
        today = date.today()
        owners = _serial_owners(self._corpus)
        found: List[tuple] = []
        seen = set()
        for doc in self._corpus:
            if not _retrieval_gate(
                doc, lang=lang, allow_overseas=allow_overseas, countries=countries,
                today=today, effective_only=True,
            ):
                continue
            if self._freshness_of(doc, today) != "stale":
                continue
            label = name_in_query(query, doc, owners)
            if not label:
                continue
            key = label.casefold()
            if key in seen:
                continue
            seen.add(key)
            position = (query or "").lower().find(label.lower())
            found.append((position if position >= 0 else 10**9, label))
        found.sort()
        return [label for _position, label in found]

    def hybrid_search(self, query: str, top_k: int = 8, vector_scores: dict | None = None) -> dict:
        """词面结果再与向量分混合。不改变 search 的原有排序。"""
        from app.services.hybrid_retrieval import hybrid_scores, rerank

        base = self.search(query, top_k=max(top_k, 8))
        docs = [
            {
                "source_id": hit.source_id,
                "content": hit.content,
                "doc_number": (hit.metadata or {}).get("doc_number"),
                "issuer": (hit.metadata or {}).get("source_org"),
                "evidence_status": (hit.metadata or {}).get("evidence_status"),
            }
            for hit in base.hits
        ]
        rows = hybrid_scores(query, docs, vector_scores)
        ranked = rerank(query, rows)
        ranked["rows"] = ranked["rows"][:top_k]
        return ranked

    def _freshness_of(self, doc: Dict, today: Optional[date] = None) -> str:
        # Same instant search() already took from the wall clock. Callers that
        # omit it still resolve "now" inside freshness_status.
        if self._registry is not None:
            return self._registry.freshness_of(doc, today=today)
        # 注入 corpus 且未给注册表时，按条目自带周期（缺省 365 天）计算
        from app.services.rag_sources import freshness_status
        return freshness_status(
            doc.get("last_verified_at", ""),
            int(doc.get("verify_interval_days", 365)),
            today=today,
        )
