"""三条底线：事实、数据、政策分析与可复核计算。

精确词表来自 data/bottom_line_terms.json（与前端副本由测试校验一致）。
国内路径另有两层不调用模型的检查：改写正则，以及归一化后的词族匹配（bottom_line_semantic，覆盖拆字、全半角、繁体、评级、保本类、数字化收益承诺、点位预测）。
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
    # 免责声明的任意组合：「不提供投资建议或收益承诺」「不构成投资建议、价格预测」……（模型常把系统提示里的
    # 固定句改写成这种变体附在正常回答后面，逐条枚举会漏，整段回答被误换成拒答）。
    re.compile(r"(?:不构成|不提供|不做|不是|并非|不给|不作为|不会给出|不进行|无法提供|不能提供)(?:任何)?"
               r"(?:投资建议|收益承诺|价格预测|投资结论)(?:\s*[、，,或和及与]\s*(?:投资建议|收益承诺|价格预测|投资结论))*"),
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
    re.compile(r"不(?:提供|承诺|给)碳收益"),
    # 名词本身：解释术语不是建议。「保本电价/保本点」是盈亏平衡的算法，「无风险收益率」是折现基准，
    # 「碳收益是指……」是概念说明。只抹这些固定搭配；「保本收益」「稳赚」「碳收益稳定」仍照常拦截。
    re.compile(r"保本(?:电价|点|价格|价|线)"),
    re.compile(r"无风险(?:收益率|利率|资产|回报率)"),
    re.compile(r"碳收益(?=是指|是什么|什么意思|指什么|怎么(?:算|理解)|如何(?:计算|核算|理解)|的(?:计算|核算|测算|来源|构成|定义|含义|概念)|主要来源|来源于|有哪些)"),
    # 风险提示里的否定：「过去的表现不能保证未来的收益」「无法保证回报」「不承诺收益」不是承诺。
    re.compile(r"(?:不能|无法|不可|不会|并不|不|没有|难以|从不)(?:对此|对其|做到)?(?:保证|承诺|确保)(?:(?![。！？!?\n；;，,、]|保证|承诺|确保|不).){0,8}?(?:收益|回报|盈利|赚钱|利润)"),
    # 「是否/值不值得投资」是问句或评估对象，不是结论。
    re.compile(r"(?:是否|能否|值不值得|要不要|该不该)\s*(?:值得\s*)?(?:投资|入手|买入|配置|布局)"),
    # 定义/科普里的常见搭配（语义层会把它们当成承诺或建议）：
    #  - 比较基准：「比无风险投资更有吸引力」；钱「可以投资并产生收益」；
    #  - 行业基准：「IRR 达到 8%-12% 通常被认为是较好的水平」；
    #  - 目的从句：「需要控制成本以确保盈利」（后面跟数字时不抹，「为了保证收益不低于8%」仍然拦截）。
    re.compile(r"(?:比|相对于|对比|高于|优于|好于)无风险(?:投资|产品|债券|资产|收益|回报)"),
    re.compile(r"(?:钱|资金|资本|现金|本金)可以投资"),
    re.compile(r"(?:IRR|内部收益率|收益率|回报率)(?:(?![。！？!?\n；;]).){0,12}?(?:达到|超过|高于|不低于|至少)(?:(?![。！？!?\n；;]).){0,16}?"
               r"(?:通常|一般|往往|普遍)(?:会)?(?:被)?(?:认为|视为|看作|算)", re.I),
    re.compile(r"(?:以|来|从而|才能|为了|需要|旨在|便于)(?:便)?(?:保证|确保)(?:项目|电站|系统|运营)?(?:的)?(?:盈利|收益|回报|利润)(?!(?:(?![。！？!?\n；;]).){0,6}\d)"),
    # 风险提示/定义里谈到「无风险」：「不存在完全无风险的投资」「国债被视为无风险（资产）」是说明，不是保本承诺；
    # 「这个项目完全无风险」「稳赚不赔」仍照常拦截。
    re.compile(r"(?:并非|并不是|不是|不存在|并不存在|没有|不代表|并不代表|不意味着|并不意味着|不等于|无法做到|不可能)(?:任何|一种|这样的)?(?:绝对|完全|真正)?(?:的)?(?:无风险|零风险)(?:的)?(?:投资|资产|产品)?"),
    re.compile(r"所谓(?:的)?(?:无|零)风险"),
    re.compile(r"(?:在|当)(?:没有|不存在|不承担|不承受|无)(?:任何)?风险(?:的)?(?:情况|前提|条件|状态)下"),
    re.compile(r"(?:才能|以|来|从而|为了)(?:保证|确保)(?:套利|项目|电站|系统|运营)?(?:的)?(?:盈利|利润|套利)空间"),
    re.compile(r"(?:被|通常|一般|常被|常|往往)?(?:认为|视为|看作|称为|称之为|假定为|假设为)(?:是)?(?:近似|几乎|相对|基本|理论上)?(?:无|零)风险(?:的)?"),
    # 盈亏平衡的说明：「NPV=0 表示项目不会产生收益也不会亏损」是定义，不是不会亏的承诺。
    re.compile(r"(?:既|也|同时)?不会(?:产生|带来|有)(?:任何)?(?:收益|盈利|利润)[，,、]?(?:也|同时又?|又)?不会(?:亏损|亏本|亏)"),
    # 概念定义：「无风险意味着……」「无风险是指……」是在解释术语。
    re.compile(r"(?:无|零)风险\**\s*[：:，,]?\s*(?:意味着|是指|指的是|即|就是|表示|代表)"),
    # 判断规则里的否定：「NPV < 0：项目预期亏损，不建议投资」是教科书决策规则；后面带「该/本/这个/你」的仍是对具体项目的结论。
    re.compile(r"(?:NPV|净现值|IRR|内部收益率)\**\s*(?:[<>＜＞=＝≤≥]|小于|大于|低于|高于|为负|为正)[^。！？!?\n；;]{0,28}?不建议(?:进行)?投资(?!(?:(?![。！？!?\n；;]).){0,6}(?:该|本|此|这个|你|您))", re.I),
    # 术语的名词用法：「无风险投资的年化回报率」「国债收益率也只是相对无风险」「几乎可以保证偿还债务」描述的是国债/基准，不是对某个项目的承诺。
    re.compile(r"(?:相对|近似|几乎|基本)(?:无|零)风险"),
    re.compile(r"(?:无|零)风险(?:投资|产品|债券|资产)?(?:的)?(?:年化)?(?:回报率|收益率|利率|基准)"),
    re.compile(r"(?:几乎|基本|完全)?(?:可以|能够)?(?:保证|确保)(?:按时)?(?:偿还|兑付|还本付息|偿付)(?:债务|本息|债券)?"),
    # 判断规则的省略写法：「如果为负，则不建议投资」承接上一句的 NPV/IRR。
    re.compile(r"(?:如果|若|当)(?:其|它|结果|该值|数值)?(?:为负|为正|小于零|小于0|大于零|大于0|低于[^，,。！？\n]{0,8}|高于[^，,。！？\n]{0,8})[，,]?(?:则|就|那么)?不建议(?:进行)?投资(?!(?:(?![。！？!?\n；;]).){0,6}(?:该|本|此|这个|你|您))"),
    re.compile(r"(?:完全|绝对|真正)(?:的)?(?:无|零)风险(?:的)?(?:投资|资产|产品)?(?:是|都)?不存在"),
    re.compile(r"(?:是否|能否|有无|有没有)(?:具有|具备|拥有|有)?投资价值"),
    # 风险提示：「建议在做出投资决策前咨询专业的财务顾问」是让读者去核实，不是荐股。
    re.compile(r"建议(?:您|你|投资者|读者|用户|大家)?(?:在|先|务必|自行|于)?(?:(?![。！？!?\n；;]).){0,8}?(?:投资决策|做出决策|决策|投资)前[，,]?(?:先|务必)?(?:咨询|征求|听取|请教|参考)"),
    re.compile(r"does not give investment advice", re.I),
    re.compile(r"not investment advice", re.I),
    re.compile(r"do not give investment advice", re.I),
    re.compile(r"not a price forecast", re.I),
    re.compile(r"will not rise", re.I),
    re.compile(r"will not fall", re.I),
)

# 解释判断规则不是对某个项目下结论：「IRR 高于资金成本，项目通常值得投资」「如果 NPV 为负就不值得投资」。
# 逐句判断：句中出现「该/本/这个项目」「你的」「建议/推荐」就当作对具体项目的结论，不抹；否则只抹
# 「指标 + 比较/条件 + 值得投资/投资价值」这一小段。
_METRIC = r"(?:IRR|NPV|内部收益率|净现值|收益率|资金成本|折现率|回收期|度电成本|LCOE|基准收益率|预期收益率)"
_WORTH = r"(?:不|没有|有)?(?:值得\s*(?:投资|入手|买|配置|布局)|投资价值)"
_CRITERION_PATTERNS = (
    re.compile(r"(?:如果|若|当|一旦|通常|一般(?:来说)?|往往|越高|越低).{0,50}?" + _METRIC + r".{0,50}?" + _WORTH),
    re.compile(_METRIC + r"\**.{0,30}?(?:高于|低于|大于|小于|超过|不足|为负|为正|[><＞＜]).{0,30}?" + _WORTH),
    # 规则的省略写法：「如果是负数，说明项目可能不值得投资」「反之，则可能不值得投资」（句中没有「该/本/这个项目」「你」「建议」）。
    re.compile(r"(?:如果|若|当|一旦|反之|否则)[^。！？!?\n；;]{0,50}?" + _WORTH),
    # 指标的用途说明：「IRR 通常用来比较不同项目的投资价值」。
    re.compile(_METRIC + r"[^。！？!?\n；;]{0,40}?(?:用来|用于|可以|能够|能)(?:比较|衡量|评估|判断|反映)[^。！？!?\n；;]{0,14}?投资价值"),
)
# 举例演算的收尾：「所以这个光伏电站项目是值得投资的」只在整段有「举例/假设/示例」时才算示例结论。
_EXAMPLE_CONCLUSION = re.compile(r"(?:所以|因此|因而|由此可见|可见|故)[^。！？!?\n；;]{0,40}?" + _WORTH)
_LIST_ITEM = re.compile(r"^\s*(?:[-*•]|\d+[.、])")
_SPECIFIC_PROJECT = re.compile(r"该项目|本项目|这个项目|此项目|你的项目|您的项目|你的方案|您的方案|你们的项目|建议|推荐|你问我|我认为|我觉得|我的判断")
# 举例/假设的演算里「这个项目」是示例项目，不是用户的项目；本项目、你的项目、建议、推荐仍照常算作具体结论。
_EXAMPLE_MARKER = re.compile(r"举个例子|举例|例如|比如说|假设|示例|这个例子|该例子|上面的例子|例子中|worked example|for example", re.I)
_SPECIFIC_IN_EXAMPLE = re.compile(r"本项目|你的项目|您的项目|你的方案|您的方案|你们的项目|建议|推荐")
_HYPOTHETICAL_SENTENCE = re.compile(r"假设|设想|比如|例如|举个例子|举例|示例|for example", re.I)
_HYPOTHETICAL_NUMBERS = re.compile(
    r"(?:每年|每月|每日|年)(?:稳定)?(?:收益|回报|分红|现金流)\s*[：:]?\s*\d+(?:\.\d+)?\s*(?:万|亿|千)?(?:元|美元)?"
    r"|(?:IRR|内部收益率|收益率|回报率)(?:是|为|约为|达到|超过)\s*\d+(?:\.\d+)?\s*%?", re.I)
_SENTENCE = re.compile(r"[^。！？!?\n；;]+")

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
    # 词表不再单列「价格预测」，以免源码扫描误伤免责声明。运行时仍拦住没被抹掉的这个说法。
    (re.compile(r"价格预测"), "价格预测"),
    (re.compile(r"(电价|价格|硅料).{0,8}(将|会)(上涨|下跌|涨|跌)"), "价格涨跌"),
    (re.compile(r"会涨|会跌"), "涨跌判断"),
    (re.compile(r"(承诺|保证).{0,8}(收益|回报|年化)"), "收益承诺"),
    (re.compile(r"稳赚|保本|必赚|无风险收益|年化保底"), "收益承诺"),
    (re.compile(r"闭眼冲|躺赚|回本神器"), "收益黑话"),
    (re.compile(r"目标价|这只股票|买入评级|个股代码|证券投资咨询"), "证券咨询"),
    (re.compile(r"碳收益"), "收益承诺"),
    (re.compile(r"该不该投|能不能投|要不要投|值不值得投|可以投吗|值得\s*投(?!资|入|放|标)|该不该上(?!报|网|课|班|学)"), "投资询问"),
    # 「官方发布」只在把结论说成官方背书时命中。引用「官方发布的文件/通知」不算。
    (re.compile(r"(?:这是|属于|视为).{0,8}官方发布的(?!文件|通知|原文|政策|办法|公告|网页|链接|文本)|官方发布的(?:结论|认证|推荐|保证|承诺|背书)|官方发布(?:并|且)(?:保证|承诺|推荐)|经官方发布|国家认证|政府推荐|官方认证"), "冒充官方"),
    (re.compile(r"以.{0,8}(?:能源局|发改委|国务院|政府)名义"), "冒充官方"),
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
    has_example = bool(_EXAMPLE_MARKER.search(text))
    specific = _SPECIFIC_IN_EXAMPLE if has_example else _SPECIFIC_PROJECT
    for sentence in _SENTENCE.finditer(text):
        if specific.search(sentence.group()):
            continue
        if _HYPOTHETICAL_SENTENCE.search(sentence.group()) or (has_example and _LIST_ITEM.match(sentence.group())):
            spans.extend((sentence.start() + m.start(), sentence.start() + m.end()) for m in _HYPOTHETICAL_NUMBERS.finditer(sentence.group()))
        for pattern in _CRITERION_PATTERNS:
            spans.extend((sentence.start() + m.start(), sentence.start() + m.end()) for m in pattern.finditer(sentence.group()))
        if has_example:
            spans.extend((sentence.start() + m.start(), sentence.start() + m.end()) for m in _EXAMPLE_CONCLUSION.finditer(sentence.group()))
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


def find_semantic_violations(text: str) -> list[str]:
    """第三层：归一化 + 词族（见 bottom_line_semantic）。先抹免责声明，再匹配。"""
    from app.services.bottom_line_semantic import find_semantic_violations as _find

    return [f"语义:{family}" for family in _find(_mask(text or ""))]


def find_violations(text: str, *, market: str = "cn") -> list[str]:
    found = find_exact_violations(text)
    if market != "global":
        for label in find_paraphrase_violations(text):
            if label not in found:
                found.append(label)
        for label in find_semantic_violations(text):
            if label not in found:
                found.append(label)
    return found


def blocked_input_text(text: str, market: str = "cn"):
    """输入层的拒答路径：命中底线则返回标准说明，且不再把原文交给模型；否则返回 None。

    接口层 blocked_model_text 和评测的 refusal_accuracy 共用这一个函数，评测测的就是线上走的路径。
    """
    if not find_violations(text or "", market=market):
        return None
    return NOTICE_EN if market == "global" else NOTICE_ZH


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
