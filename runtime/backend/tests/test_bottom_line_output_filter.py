"""批1合规: AI 输出不得含投资结论/收益承诺/价格预测/冒充官方; 静态扫描用户可见文案."""
import pathlib, re
from app.services.bottom_line import find_violations, enforce_bottom_line, NOTICE_ZH

def test_filter_replaces_violating_text():
    assert find_violations("这个项目值得投资，稳赚不赔")
    assert enforce_bottom_line("这个项目值得投资", market="cn") == NOTICE_ZH
    assert enforce_bottom_line("年发电量约 120 万 kWh (按给定辐照测算)", market="cn").startswith("年发电量")


METHOD_ANSWER = """甘肃风光储项目收益测算通常要写清方法、口径和边界条件，这里只做方法说明。

一、方法
净现值把运营期现金流入和流出按折现率折到开工年。内部收益率是使净现值为零的折现率，要区分全投资内部收益率和资本金内部收益率。投资回收期和度电成本是另外两个常用输出。资本金内部收益率达到8%只是常见的比较基准，不是承诺。

二、口径
电量要写明是发电量还是上网电量。电价要写明是机制电价、市场交易电价还是两者加权。储能收益要分开价差、容量补偿和辅助服务。含税与不含税不能混用。

三、边界条件
利用小时、弃风弃光率、线损、储能充放电策略、残值率、贷款利率和运营年限都要单独列出。情景分析可以设置高、中、低三档电价。预测电价只能作为情景输入，并注明资料来源和年份，不能写成已经发生的价格。市场化电量用已公布的交易结果，不用预测明年电价会上涨。

是否值得投资取决于给定折现率下资本金内部收益率和基准收益率的比较，本文不判断。IRR用来比较不同方案的投资价值。不要把保本电价理解成保本承诺，它只是覆盖成本的盈亏平衡电价。本说明不构成对具体项目的投资建议，也不能用来判断该不该投。"""

ADVICE_ANSWER = "请直接给出现在该买的光伏股票清单，保证稳赚不赔，并预测明年电价会涨到0.45元。"


def test_methodology_answer_is_kept_and_real_advice_is_blocked():
    """2026-11-25 真模型复测：方法说明被输出层整段换成拒答。方法说明应原样留下，买入清单和收益承诺仍整段拒答。"""
    assert find_violations(METHOD_ANSWER) == []
    assert enforce_bottom_line(METHOD_ANSWER) == METHOD_ANSWER
    assert enforce_bottom_line(ADVICE_ANSWER) == NOTICE_ZH


def test_output_filter_uses_the_assembled_answer_and_drops_only_the_bad_sentence():
    chunks = [
        "本说明不构",
        "成对具体项目的投资建议。收益测算包括净现值、内部收益率和回收期。",
        "预测电",
        "价只作为情景输入，须注明来源和年份。",
    ]
    assembled = "".join(chunks)
    assert find_violations(chunks[1])  # 分片单独看会把后半段当成投资建议
    assert enforce_bottom_line(assembled) == assembled
    mixed = "方法包括净现值和内部收益率，口径要分开全投资与资本金。建议现在买入并保证稳赚不赔。"
    out = enforce_bottom_line(mixed)
    assert "净现值" in out and "内部收益率" in out
    assert "稳赚" not in out and "买入" not in out
    assert find_violations(out) == []

def test_user_facing_copy_has_no_bottom_line_terms():
    root = pathlib.Path(__file__).resolve().parents[2]  # runtime/
    terms = []
    import json
    data = json.loads((root/"backend/data/bottom_line_terms.json").read_text())
    for k in ("investment_advice","price_prediction","impersonating_official"):
        terms += data.get(k) or []
    # 守卫/提示词/测试本身 legitimately 引用禁词 (否定式), 豁免
    allow = {"bottom-line.ts","bottom-line-terms.json","bottom_line.py","bottom_line_semantic.py","compliance.py","system-prompt.ts","ai_assistant.py","test_bottom_line_output_filter.py","claims.py"}
    hits=[]
    for sub in ["web/src","web-int/src","backend/app"]:
        for f in (root/sub).rglob("*"):
            if f.suffix not in (".ts",".tsx",".py") or f.name in allow or "test" in f.name or ".test." in f.name:
                continue
            text=f.read_text(errors="ignore").lower()
            # 只扫描字符串字面量近似: 整行含禁词且不在注释行
            for line in text.splitlines():
                s=line.strip()
                if s.startswith(("//","#","*")): continue
                for term in terms:
                    if term.lower() in s:
                        hits.append(f"{f.relative_to(root)}: {term}")
    assert hits==[], "\n".join(sorted(set(hits))[:50])
