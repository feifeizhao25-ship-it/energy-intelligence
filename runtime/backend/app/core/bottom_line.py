"""底线守卫：禁词表与前端 web/src/lib/compliance/bottom-line-terms.json 内容一致。"""
import json
import pathlib
from functools import lru_cache
from typing import Dict, List

_TERMS_PATH = pathlib.Path(__file__).resolve().parents[2] / "data" / "bottom_line_terms.json"
CATEGORIES = ("investment_advice", "price_prediction", "impersonating_official")


@lru_cache(maxsize=1)
def load_terms() -> Dict:
    return json.loads(_TERMS_PATH.read_text(encoding="utf-8"))


def find_violations(text: str) -> List[str]:
    terms = load_terms()
    lower = text.lower()
    return [t for c in CATEGORIES for t in terms[c] if t.lower() in lower]
