"""Alias index for policy names, so retrieval does not depend on how the user spells them.

"How does OBBBA change ITC eligibility for a Texas 100MW solar project?" retrieved nothing because lexical overlap
was computed over every word of the question (how, does, for, a ...) and the abbreviation OBBBA was only one of
twelve tokens. Each alias group below is one *concept*: it matches when the query uses any spelling and the document
uses any spelling. A concept counts three times a plain word, and filler words are not counted at all, so the same
question asked five ways reaches the same source. Without an alias match the old scoring is used unchanged.
"""
from __future__ import annotations

import re
from typing import Dict, FrozenSet, List, Optional, Tuple

# name -> (spellings found in a question, spellings found in a document)
ALIAS_GROUPS: Dict[str, Tuple[Tuple[str, ...], FrozenSet[str]]] = {
    "obbba": (
        ("obbba", "obbb", "one big beautiful bill", "big beautiful bill", "h.r. 1", "hr 1", "hr1",
         "public law 119-21", "p.l. 119-21", "pl 119-21", "the 2025 tax law", "2025 budget reconciliation"),
        frozenset({"obbba", "obbb", "beautiful", "119-21"}),
    ),
    "itc": (
        ("itc", "investment tax credit", "investment tax credits", "48e", "section 48e", "clean electricity investment credit"),
        frozenset({"itc", "48e", "investment"}),
    ),
    "ptc": (
        ("ptc", "production tax credit", "production tax credits", "45y", "section 45y", "clean electricity production credit"),
        frozenset({"ptc", "45y", "production"}),
    ),
    "irs_notice": (
        ("notice 2025-42", "irs notice 2025-42", "beginning of construction", "begin construction", "begun construction",
         "start of construction", "safe harbor", "safe harbour", "physical work test", "five percent safe harbor"),
        frozenset({"2025-42", "construction", "safe", "physical"}),
    ),
}

CONCEPT_WEIGHT = 3.0

STOPWORDS = frozenset(
    "a an the of for to in on at by with and or but is are was were be been being do does did how what which who whom "
    "whose when where why can could should would will shall may might must it its this that these those my our your "
    "their there here from as into about over under after before than then so if not no any all some i we you they he "
    "she me us them have has had having tell explain please give show".split()
)
_WORD = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")


def _normalise(text: str) -> str:
    return " " + re.sub(r"\s+", " ", (text or "").lower()) + " "


def detect_groups(query: str) -> List[str]:
    text = _normalise(query)
    found = []
    for name, (spellings, _doc) in ALIAS_GROUPS.items():
        for sp in spellings:
            if re.search(r"(?<![a-z0-9])" + re.escape(sp) + r"(?![a-z0-9])", text):
                found.append(name)
                break
    return found


def content_tokens(query: str, groups: List[str]) -> List[str]:
    """Question words minus filler words and minus the spellings already counted as a concept."""
    text = _normalise(query)
    for name in groups:
        for sp in sorted(ALIAS_GROUPS[name][0], key=len, reverse=True):
            text = re.sub(r"(?<![a-z0-9])" + re.escape(sp) + r"(?![a-z0-9])", " ", text)
    return [t for t in dict.fromkeys(_WORD.findall(text)) if t not in STOPWORDS and len(t) > 1]


def alias_score(query: str, doc_tokens: set) -> Optional[float]:
    """Weighted overlap in [0,1], or None when the question names no known policy concept the document also has."""
    groups = detect_groups(query)
    if not groups:
        return None
    matched_groups = [g for g in groups if ALIAS_GROUPS[g][1] & doc_tokens]
    if not matched_groups:
        return None
    words = content_tokens(query, groups)
    total = CONCEPT_WEIGHT * len(groups) + len(words)
    got = CONCEPT_WEIGHT * len(matched_groups) + sum(1 for w in words if w in doc_tokens)
    return min(1.0, got / total) if total else None
