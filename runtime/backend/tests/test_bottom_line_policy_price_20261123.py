"""2026-11-23 真模型复测：「发电侧容量电价现在是怎么定的？」13 次里 1 次正常回答被整段换成免责句。
政策电价机制的事实说明（有文件/机制依据、无个人判断、无未来时点/点位/涨跌幅）不拦；真正的价格预测仍拦。"""
import pytest

from app.services.bottom_line import NOTICE_ZH, enforce_bottom_line, find_violations

POLICY_FACTS = [  # 政策电价机制事实，不应拦
 "根据发改价格〔2026〕114号，煤电容量电价回收固定成本的比例2026年起提高到不低于50%，预计各地容量电价标准将相应调整。",
 "容量电费纳入系统运行费用，由工商业用户按电量分摊，因此执行后工商业用户电价会上涨。",
 "抽水蓄能容量电价按经营期定价法核定，预计通过省级电网输配电价回收。",
 "文件明确，电力现货市场连续运行地区，容量电价将逐步转向按可靠容量补偿的机制。",
 "按照114号文，独立储能容量电价参照煤电标准执行，电网侧储能的容量电价会随煤电标准调整而调整。",
 "通知规定，各地价格主管部门预计在2026年3月底前公布本省容量电价标准。",
 "136号文实施后，新能源上网电价将全面由市场形成，存量项目通过机制电价衔接。",
 "根据政策，容量电价上调后电量电价会相应下降，用户总电价不一定上涨。",
]
REAL_FORECASTS = [  # 真正的价格预测，仍要拦
 "我预计明年电价会上涨10%左右，建议尽快签长协。",
 "预计2027年组件价格将跌到0.6元/W。",
 "电价将上涨，建议尽快锁定价格。",
 "未来半年硅料价格必然下跌。",
 "价格预测：明年绿证价格会涨。",
 "根据114号文，预计明年工商业电价会上涨5%。",
 "按照政策走向，我判断容量电价会涨到每千瓦每年200元。",
 "根据市场情况，预测下半年现货电价将上涨。",
]
NEG_EXTRA = [
    "根据政策，电价会上涨20%。",
    "依据136号文，预测电价将上涨。",
    "按照文件，下个月电价会涨。",
    "政策出台后硅料价格必将上涨。",
]


@pytest.mark.parametrize("text", POLICY_FACTS)
def test_policy_price_mechanism_facts_pass(text):
    assert find_violations(text) == []
    assert enforce_bottom_line(text) == text


@pytest.mark.parametrize("text", REAL_FORECASTS + NEG_EXTRA)
def test_real_price_forecasts_still_blocked(text):
    assert find_violations(text)
    assert enforce_bottom_line(text) == NOTICE_ZH


def test_whole_capacity_price_answer_passes():
    answer = (
        "一句话结论：发电侧容量电价目前是分类定、分省定、按比例回收固定成本 [S1]。\n"
        "关键数字：根据发改价格〔2026〕114号，煤电容量电价回收固定成本的比例2026年起提高到不低于50%，预计各地容量电价标准将相应调整 [S1]。\n"
        "容量电费纳入系统运行费用，由工商业用户按电量分摊，因此执行后工商业用户电价会上涨；抽水蓄能容量电价按经营期定价法核定 [S3]。"
    )
    assert enforce_bottom_line(answer) == answer


def test_same_answer_with_forecast_sentence_is_blocked():
    answer = "根据114号文，容量电价按比例回收固定成本。我预计明年电价会上涨10%。"
    assert enforce_bottom_line(answer) == NOTICE_ZH
