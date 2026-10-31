"""Turn a model answer into a headline, key numbers, basis and risks, and explain jargon in plain words.

Nothing here adds facts. The headline and numbers are lifted from the answer text, the basis lists only the
sources the answer actually cited ([S1]...), and the glossary holds standard definitions of terms that appear
in the answer. When a part is not present in the answer it is returned empty rather than filled in."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Sequence

STYLES = ("plain", "pro")

_HEADLINE_RE = re.compile(r"^\s*(?:[#>\-*\s]*)(?:\*\*)?(一句话结论|结论|Bottom line|Short answer|In short)(?:\*\*)?\s*[:：]\s*(?:\*\*)?(.+?)\s*$", re.I)
_SENT_END = re.compile(r"(?<=[。！？!?])|(?<=[.])\s+(?=[A-Z0-9\[])")
_NUM = re.compile(
    r"(?P<num>[+-]?\d[\d,]*(?:\.\d+)?)\s*(?P<unit>%|MWh|GWh|kWh|MW|GW|kW|万元|亿元|元/kWh|元/W|元|USD|CNY|\$|¢|"
    r"tCO2e?|年|个月|years?|yrs?|months?)",
)
_CITE = re.compile(r"\[S(\d+)\]")
_MD = re.compile(r"(\*\*|__|`|^#{1,6}\s*|^\s*[-*]\s+)", re.M)

_RISK_WORDS_ZH = ("风险", "不确定", "假设", "注意", "可能", "波动", "限制")
_RISK_WORDS_EN = ("risk", "uncertain", "assum", "caveat", "may ", "volatil", "limitation")

# term -> (Chinese plain explanation, English plain explanation). Standard textbook definitions only.
GLOSSARY: Dict[str, tuple] = {
    "LCOE": ("平准化度电成本：把整个寿命期的总成本摊到每度电上的单价，用来比较不同电源。", "Levelised cost of energy: total lifetime cost spread over every unit of energy produced, used to compare sources."),
    "IRR": ("内部收益率：让项目净现值刚好为零的年化折现率，数值越高说明按此假设回收越快。", "Internal rate of return: the annual discount rate at which the project's net present value is zero."),
    "NPV": ("净现值：把未来每年的现金流按折现率换算成今天的钱后相加，减去初始投资。", "Net present value: future cash flows converted to today's money at the discount rate, minus the upfront cost."),
    "DSCR": ("偿债覆盖率：年度可用于还款的现金除以当年应还本息，低于 1 说明现金不够还。", "Debt service coverage ratio: cash available for repayment divided by the repayment due that year; below 1 means not enough cash."),
    "PPA": ("购电协议：发电方与购电方约定电量和价格的长期合同。", "Power purchase agreement: a long-term contract that fixes who buys the electricity and at what price."),
    "ITC": ("投资税收抵免：按设备投资额的一定比例抵减应缴税款（美国政策）。", "Investment tax credit: a share of the equipment cost deducted from tax owed (US policy)."),
    "PTC": ("产电税收抵免：按实际发电量抵减税款（美国政策）。", "Production tax credit: a per-unit-of-electricity deduction from tax owed (US policy)."),
    "CAPEX": ("资本性支出：建设期一次性投入的设备和工程费用。", "Capital expenditure: the one-off cost of equipment and construction."),
    "OPEX": ("运营成本：建成后每年的运维、保险、土地等费用。", "Operating expenditure: yearly cost of maintenance, insurance, land and so on."),
    "容量系数": ("容量系数：一年实际发电量与满功率运行一年发电量的比值。", "Capacity factor: actual yearly output divided by running at full power all year."),
    "平准化度电成本": ("平准化度电成本：把整个寿命期的总成本摊到每度电上的单价。", "Levelised cost of energy: total lifetime cost spread over every unit of energy produced."),
    "内部收益率": ("内部收益率：让项目净现值刚好为零的年化折现率。", "Internal rate of return: the discount rate at which net present value is zero."),
    "净现值": ("净现值：未来现金流折现到今天后相加，再减去初始投资。", "Net present value: future cash flows discounted to today, minus the upfront cost."),
    "折现率": ("折现率：把未来的钱换算成今天价值时使用的年化比率。", "Discount rate: the yearly rate used to convert future money into today's value."),
    "弃光": ("弃光：电网接不下时被迫少发、浪费掉的光伏电量。", "Curtailment: electricity a plant could have produced but was told to hold back because the grid could not take it."),
    "弃风": ("弃风：电网接不下时被迫少发、浪费掉的风电电量。", "Curtailment: electricity a plant could have produced but was told to hold back because the grid could not take it."),
    "GHI": ("GHI：水平面总辐照度，即单位面积地面接收到的太阳辐射总量。", "GHI: global horizontal irradiance, the total solar radiation reaching a flat surface."),
    "round-trip efficiency": ("往返效率：储能充入的电量中能再放出来的比例。", "Round-trip efficiency: the share of the energy put into storage that can be taken back out."),
    "往返效率": ("往返效率：储能充入的电量中能再放出来的比例。", "Round-trip efficiency: the share of the energy put into storage that can be taken back out."),
}


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", _MD.sub("", s)).strip()


def _first_sentence(text: str, limit: int = 120) -> str:
    for para in re.split(r"\n\s*\n|\n", text):
        p = _clean(para)
        if not p or p.startswith("|") or len(p) < 6:
            continue
        sent = _SENT_END.split(p)[0].strip()
        return (sent if len(sent) <= limit else sent[: limit - 1].rstrip() + "…")
    return ""


def extract_headline(text: str) -> tuple:
    """Return (headline, remaining body). A labelled line wins; otherwise the first sentence is used."""
    lines = (text or "").splitlines()
    for i, line in enumerate(lines):
        m = _HEADLINE_RE.match(line)
        if m and m.group(2).strip():
            rest = "\n".join(lines[:i] + lines[i + 1:]).strip()
            return _clean(_CITE.sub("", m.group(2))), rest
    return _CITE.sub("", _first_sentence(text)).strip(), (text or "").strip()


def extract_key_numbers(text: str, limit: int = 4) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    seen = set()
    for sentence in filter(None, (s.strip() for s in _SENT_END.split(_clean(_CITE.sub("", text or ""))))):
        for m in _NUM.finditer(sentence):
            value = f"{m.group('num')}{'' if m.group('unit') in ('%', '$') else ' '}{m.group('unit')}".strip()
            if value in seen:
                continue
            label = sentence[: m.start()].strip(" ，,：:；;（()）")
            label = label[-24:].strip() if len(label) > 24 else label
            out.append({"value": value, "label": label})
            seen.add(value)
            if len(out) >= limit:
                return out
    return out


def basis_from_citations(text: str, sources: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cited = sorted({int(n) for n in _CITE.findall(text or "")})
    items = []
    for n in cited:
        if 1 <= n <= len(sources):
            s = sources[n - 1]
            items.append({"ref": f"S{n}", "title": s.get("title"), "publisher": s.get("publisher"),
                          "published_at": s.get("published_at"), "url": s.get("url"),
                          "freshness_status": s.get("freshness_status")})
    return items


def extract_risks(text: str, en: bool, limit: int = 3) -> List[str]:
    words = _RISK_WORDS_EN if en else _RISK_WORDS_ZH
    out: List[str] = []
    for sentence in filter(None, (s.strip() for s in _SENT_END.split(_clean(_CITE.sub("", text or ""))))):
        low = sentence.lower()
        if any(w in low for w in words) and 10 <= len(sentence) <= 200 and sentence not in out:
            out.append(sentence)
        if len(out) >= limit:
            break
    return out


def glossary_for(text: str, en: bool, limit: int = 5) -> List[Dict[str, str]]:
    out, seen = [], set()
    for term, (zh, eng) in GLOSSARY.items():
        if re.search(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", text or "", re.I):
            definition = eng if en else zh
            if definition in seen:
                continue
            seen.add(definition)
            out.append({"term": term, "plain": definition})
        if len(out) >= limit:
            break
    return out


def style_instruction(market: str, style: str) -> str:
    """Prompt text for the answer shape. 'plain' = everyday words; 'pro' = technical wording."""
    en = market == "global"
    style = style if style in STYLES else ("pro" if en else "plain")
    if en:
        shape = ("Start the first line with 'Bottom line:' followed by one sentence. Then give the key figures, then the basis "
                 "(cite [S1]...), then 'Risks:' as a short list. Do not use LaTeX; write formulas in words.")
        tone = ("Use everyday words. Explain each technical term in brackets the first time it appears. Keep sentences short."
                if style == "plain" else "Use precise technical wording and standard abbreviations. Keep it concise.")
    else:
        shape = ("第一行以“一句话结论：”开头，只写一句话；然后给出关键数字，再写依据（使用 [S1] 标注），最后以“风险提示：”列出要点。"
                 "不要输出 LaTeX，公式用文字说明。")
        tone = ("用大白话回答，句子要短；每个专业术语第一次出现时在括号里用一句话解释，不用“当令”“运化”这类古语或行话。"
                if style == "plain" else "使用规范的专业术语和标准缩写，表述简洁。")
    return "\n\n" + shape + "\n" + tone


def structure_answer(text: str, market: str, sources: Sequence[Dict[str, Any]], style: str, limitations: Sequence[str] = ()) -> Dict[str, Any]:
    en = market == "global"
    style = style if style in STYLES else ("pro" if en else "plain")
    headline, body = extract_headline(text)
    return {
        "style": style,
        "headline": headline,
        "key_numbers": extract_key_numbers(body),
        "basis": basis_from_citations(text, sources),
        "risks": extract_risks(body, en),
        "limitations": list(limitations),
        "glossary": glossary_for(text, en) if style == "plain" else [],
        "has_sources": bool(basis_from_citations(text, sources)),
    }
