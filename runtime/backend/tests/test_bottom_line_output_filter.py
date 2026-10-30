"""批1合规: AI 输出不得含投资结论/收益承诺/价格预测/冒充官方; 静态扫描用户可见文案."""
import pathlib, re
from app.services.bottom_line import find_violations, enforce_bottom_line, NOTICE_ZH

def test_filter_replaces_violating_text():
    assert find_violations("这个项目值得投资，稳赚不赔")
    assert enforce_bottom_line("这个项目值得投资", market="cn") == NOTICE_ZH
    assert enforce_bottom_line("年发电量约 120 万 kWh (按给定辐照测算)", market="cn").startswith("年发电量")

def test_user_facing_copy_has_no_bottom_line_terms():
    root = pathlib.Path(__file__).resolve().parents[2]  # runtime/
    terms = []
    import json
    data = json.loads((root/"backend/data/bottom_line_terms.json").read_text())
    for k in ("investment_advice","price_prediction","impersonating_official"):
        terms += data.get(k) or []
    # 守卫/提示词/测试本身 legitimately 引用禁词 (否定式), 豁免
    allow = {"bottom-line.ts","bottom-line-terms.json","bottom_line.py","bottom_line_semantic.py","compliance.py","system-prompt.ts","ai_assistant.py","test_bottom_line_output_filter.py"}
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
