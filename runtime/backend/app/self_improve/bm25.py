"""离线 BM25（含标题字段加权）：给“变好才上线”闸门做 with/without 对照检索用，不依赖任何模型或网络。
来源思路见 docs/RESEARCH_DIGEST_20261101.md（BM25 + RRF 混合检索）；能源产品自己的检索在 services/hybrid_retrieval.py，这里不改它。"""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import Iterable

POOL = 60
_EN_TOKEN = re.compile(r"[a-z0-9]+")
_CJK_RUN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]+")
_CN_STOP_CHARS = set("的了是在有我你他她它们这那个一不也都很而会把被让给跟比等还对才能吗呢吧啊么怎要想该应什么哪些怎样如何可以")
_CN_STOP_WORDS = frozenset({"怎么办", "怎么", "什么", "有哪些", "哪些", "应该", "可以", "需要", "注意", "一下", "怎样", "如何", "是否", "为什么"})
_EN_STOP = frozenset("a an the and or of to in on for with is are be can i my me how what which do does should when why it its at as by from this that these those about into your you we our".split())


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def tokenize(text: str, lang: str) -> list[str]:
    text = (text or "").lower()
    if lang != "cn":
        return [_stem(w) for w in _EN_TOKEN.findall(text) if w not in _EN_STOP and len(w) > 1]
    try:
        import jieba
    except ImportError:  # 没装 jieba 时只用字二元组，仍可工作
        jieba = None

    toks: list[str] = []
    for run in _CJK_RUN.findall(text):
        for w in (jieba.lcut_for_search(run) if jieba else []):
            if len(w) > 1 and w not in _CN_STOP_WORDS and not all(c in _CN_STOP_CHARS for c in w):
                toks.append(w)
        clean = "".join(c for c in run if c not in _CN_STOP_CHARS)
        toks.extend(clean[i:i + 2] for i in range(len(clean) - 1))  # 字二元组：口语问法和书面词不同分词时仍能对上
    toks.extend(_stem(w) for w in _EN_TOKEN.findall(text) if len(w) > 1)
    return toks


class BM25Index:
    """字段加权 BM25：标题重复 3 次再并入正文，等价于标题字段权重 3。"""

    def __init__(self, docs: Iterable[tuple[str, str]], lang: str, k1: float = 1.4, b: float = 0.75, heading_weight: int = 3):
        self.lang, self.k1, self.b = lang, k1, b
        self.tf: list[Counter] = []
        self.dl: list[int] = []
        df: Counter = Counter()
        for heading, content in docs:
            toks = tokenize(heading, lang) * heading_weight + tokenize(content, lang)
            c = Counter(toks)
            self.tf.append(c)
            self.dl.append(len(toks))
            df.update(c.keys())
        self.n = len(self.tf)
        self.avgdl = (sum(self.dl) / self.n) if self.n else 0.0
        self.idf = {t: math.log(1 + (self.n - d + 0.5) / (d + 0.5)) for t, d in df.items()}

    def query(self, q: str, top_k: int = POOL) -> list[tuple[int, float]]:
        qt = [t for t in tokenize(q, self.lang) if t in self.idf]
        if not qt or not self.n:
            return []
        qc = Counter(qt)
        scores: list[tuple[int, float]] = []
        for i, c in enumerate(self.tf):
            s = 0.0
            norm = self.k1 * (1 - self.b + self.b * self.dl[i] / (self.avgdl or 1))
            for t, qn in qc.items():
                f = c.get(t)
                if f:
                    s += self.idf[t] * f * (self.k1 + 1) / (f + norm) * (1 + 0.1 * (qn - 1))
            if s > 0:
                scores.append((i, s))
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]
