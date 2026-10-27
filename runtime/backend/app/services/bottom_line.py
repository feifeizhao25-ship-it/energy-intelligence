"""三条底线：事实、数据、政策分析与可复核计算。

精确词表来自 data/bottom_line_terms.json（与前端副本由测试校验一致）。
国内路径另有一层不调用模型的正则，覆盖改写后的投资结论、收益承诺和价格预测。
可选模型复核由 NENGJIAN_BOTTOM_LINE_MODEL_REVIEW=1 打开；没有密钥时不外呼。
命中后整段替换为标准说明，不做局部删词。
"""
from __future__ import annotations

import json
import os
import pathlib
import re

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

# 免责声明按最长跨度抹掉。「不提供投资建议」不能先于
# 「不提供投资建议、收益承诺或价格预测」，否则「价格预测」会漏出来。
_NEGATION_PATTERNS = (
    re.compile(r"不提供投资建议、收益承诺或价格预测"),
    re.compile(r"不构成投资建议、收益承诺或价格预测"),
    re.compile(r"不提供投资建议或价格预测"),
    re.compile(r"不构成投资建议或价格预测"),
    re.compile(r"不是投资建议或价格预测"),
    re.compile(r"(?:不构成|不提供|不做|不是|并非|不会|不进行)(?:任何)?价格预测"),
    re.compile(r"属于[^。\n]{0,24}价格预测[^。\n]{0,8}范畴"),
    re.compile(r"属于[^。\n]{0,24}投资建议[^。\n]{0,8}范畴"),
    re.compile(r"(?:无法|不能|不会|不可以|不便)(?:提供|给出|做|进行|回答)[^。\n]{0,12}(?:价格预测|投资建议|收益承诺)"),
    re.compile(r"涉及[^。\n]{0,16}(?:价格预测|投资建议)"),
    re.compile(r"(?:不构成|不提供|不做|不是|并非|不给|不作为)投资建议"),
    re.compile(r"(?:不构成|不提供|不做|不是|并非)收益承诺"),
    re.compile(r"并非投资建议"),
    re.compile(r"不得用于投资决策"),
    re.compile(r"不用于投资决策"),
    re.compile(r"不是投资结论"),
    re.compile(r"does not give investment advice", re.I),
    re.compile(r"not investment advice", re.I),
    re.compile(r"do not give investment advice", re.I),
    re.compile(r"not a price forecast", re.I),
    re.compile(r"will not rise", re.I),
    re.compile(r"will not fall", re.I),
)

# 不调用模型的改写层。只在国内市场启用，避免改变国际版既有精确匹配行为。
_PATTERNS = (
    (re.compile(r"推荐\s*投资"), "推荐投资"),
    (re.compile(r"暂缓\s*投资"), "暂缓投资"),
    (re.compile(r"强烈\s*推荐"), "强烈推荐"),
    (re.compile(r"值得\s*(投资|入手|买|配置|布局)"), "值得投资类"),
    (re.compile(r"(建议|推荐).{0,8}(买入|加仓|建仓|入手|配置|布局|投资)"), "建议买入类"),
    (re.compile(r"投资\s*建议"), "投资建议"),
    (re.compile(r"投资\s*结论"), "投资结论"),
    (re.compile(r"具备投资吸引力"), "投资吸引力"),
    (re.compile(r"回报可观"), "回报可观"),
    (re.compile(r"看涨|看跌"), "涨跌判断"),
    (re.compile(r"(预计|预测).{0,16}(电价|价格|硅料|组件价)"), "价格预测"),
    (re.compile(r"(电价|价格|硅料).{0,8}(将|会)(上涨|下跌|涨|跌)"), "价格涨跌"),
    (re.compile(r"会涨|会跌"), "涨跌判断"),
    (re.compile(r"(承诺|保证).{0,8}(收益|回报|年化)"), "收益承诺"),
    (re.compile(r"稳赚|保本|必赚|无风险收益|年化保底"), "收益承诺"),
    (re.compile(r"该不该投|能不能投|要不要投|值不值得投|可以投吗|值得\s*投(?!资|入|放|标)|该不该上(?!报|网|课|班|学)"), "投资询问"),
    # 「官方发布」只在把结论说成官方背书时命中。引用「官方发布的文件/通知」不算。
    (re.compile(r"(?:这是|属于|视为).{0,8}官方发布的(?!文件|通知|原文|政策|办法|公告|网页|链接|文本)|官方发布的(?:结论|认证|推荐|保证|承诺|背书)|官方发布(?:并|且)(?:保证|承诺|推荐)|经官方发布|国家认证|政府推荐|官方认证"), "冒充官方"),
    (re.compile(r"recommend(?:ed)?\s+invest", re.I), "recommend investing"),
    (re.compile(r"price\s+will\s+(?:rise|fall)", re.I), "price forecast"),
    (re.compile(r"guaranteed\s+returns?", re.I), "guaranteed return"),
)


def _mask(text: str) -> str:
    """按最长、互不重叠的跨度抹掉免责声明。短句不能先吃掉长句的前缀。"""
    if not text:
        return ""
    spans: list[tuple[int, int]] = []
    for pattern in _NEGATION_PATTERNS:
        spans.extend((match.start(), match.end()) for match in pattern.finditer(text))
    for phrase in (NOTICE_ZH, NOTICE_EN):
        start = 0
        while True:
            idx = text.find(phrase, start)
            if idx < 0:
                break
            spans.append((idx, idx + len(phrase)))
            start = idx + len(phrase)
    if not spans:
        return text
    spans.sort(key=lambda span: (-(span[1] - span[0]), span[0]))
    chosen: list[tuple[int, int]] = []
    for start, end in spans:
        if any(not (end <= kept_start or start >= kept_end) for kept_start, kept_end in chosen):
            continue
        chosen.append((start, end))
    chars = list(text)
    for start, end in chosen:
        for index in range(start, end):
            chars[index] = " "
    return "".join(chars)


def find_exact_violations(text: str) -> list[str]:
    lower = _mask(text or "").lower()
    return [term for term in TERMS if term.lower() in lower]


def find_paraphrase_violations(text: str) -> list[str]:
    masked = _mask(text or "")
    found = []
    for pattern, label in _PATTERNS:
        if pattern.search(masked) and label not in found:
            found.append(label)
    return found


def find_violations(text: str, *, market: str = "cn") -> list[str]:
    found = find_exact_violations(text)
    if market != "global":
        for label in find_paraphrase_violations(text):
            if label not in found:
                found.append(label)
    return found


def enforce_bottom_line(text: str, market: str = "cn") -> str:
    if find_violations(text, market=market):
        try:
            from app.services.feedback_samples import record_sample
            record_sample("blocked_output", text or "")
        except Exception:
            pass
        return NOTICE_EN if market == "global" else NOTICE_ZH
    return text


def optional_model_review_enabled() -> bool:
    """模型复核默认关闭。打开后仍只在已配置国内密钥时调用，测试与离线环境不外呼。"""
    return os.environ.get("NENGJIAN_BOTTOM_LINE_MODEL_REVIEW") == "1"


def review_bottom_line_with_model(text: str, poster=None) -> str | None:
    """可选的国内模型复核。未开启或没有百炼密钥时返回 None，不访问任何境外服务。

    打开后调用百炼兼容 chat/completions（qwen3.5-plus）。模型只回答 yes 或 no。
    """
    if not optional_model_review_enabled():
        return None
    key = os.environ.get("NENGJIAN_DASHSCOPE_API_KEY") or os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        return None
    model = os.environ.get("DASHSCOPE_MODEL", "qwen3.5-plus")
    base = os.environ.get("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1").rstrip("/")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": "判断文本是否包含投资结论、收益承诺或价格预测。只回答 yes 或 no。"},
            {"role": "user", "content": (text or "")[:4000]},
        ],
    }

    def _post(payload: dict, api_key: str) -> str:
        import json
        import urllib.request
        req = urllib.request.Request(
            base + "/chat/completions",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode() or "{}")
        return ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""

    try:
        answer = (poster or _post)(body, key).strip().lower()
    except Exception:
        return None
    if answer.startswith("yes"):
        return NOTICE_ZH
    return None
