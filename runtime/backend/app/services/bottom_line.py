"""三条底线输出过滤: 投资结论/收益承诺/价格预测/冒充官方一律拦截.

禁词表唯一来源: backend/data/bottom_line_terms.json (与前端 bottom-line-terms.json 由测试校验一致).
流式与非流式回答在下发前都必须经过 enforce_bottom_line, 命中则整段替换为标准说明,
不做局部删词 (删词后仍可能构成结论).
"""
from __future__ import annotations
import json, pathlib

_TERMS_PATH = pathlib.Path(__file__).resolve().parents[2] / "data" / "bottom_line_terms.json"

def _load_terms() -> list[str]:
    try:
        data = json.loads(_TERMS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    terms: list[str] = []
    for key in ("investment_advice", "price_prediction", "impersonating_official"):
        terms.extend(data.get(key) or [])
    return terms

TERMS = _load_terms()
NOTICE_ZH = "我只能提供事实、数据、政策原文和可验证的计算，不提供投资建议、收益承诺或价格预测，也不代表任何政府或官方机构。"
NOTICE_EN = "I can provide facts, data, primary policy sources and verifiable calculations only, not investment advice, return guarantees or price predictions, and I do not speak for any government or official body."

def find_violations(text: str) -> list[str]:
    lower = (text or "").lower()
    return [t for t in TERMS if t.lower() in lower]

def enforce_bottom_line(text: str, market: str = "cn") -> str:
    if find_violations(text):
        return NOTICE_EN if market == "global" else NOTICE_ZH
    return text
