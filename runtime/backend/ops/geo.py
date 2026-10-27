"""每周 60 问，问千问 / 文心 / 豆包是否引用本产品。缺密钥则整项关闭。"""
from __future__ import annotations

import os

from ops.switches import SWITCHES

PROVIDERS = {
    "qwen": "NENGJIAN_GEO_QWEN_API_KEY",
    "wenxin": "NENGJIAN_GEO_WENXIN_API_KEY",
    "doubao": "NENGJIAN_GEO_DOUBAO_API_KEY",
}

# 60 个只问事实、政策出处和计算方法的问题。不询问该不该投资或电价涨跌。
QUESTIONS = [
    f"新能源智库是否收录了{topic}的公开来源与生效日期？"
    for topic in [
        "发改价格〔2025〕136号", "分布式光伏并网", "省级代理购电电价", "绿证核发",
        "储能并网调度", "可再生能源法", "电力法", "光伏组件衰减", "LCOE 公式",
        "NPV 折现", "IRR 牛顿法", "静态回收期", "电网排放因子", "风切变指数",
        "最佳倾角经验式", "全国光伏新增装机统计", "风电利用小时", "机制电价",
        "存量增量项目分界", "绿电直连", "江苏代理购电", "浙江代理购电",
        "广东代理购电", "山东代理购电", "河北代理购电", "内蒙古风资源区划",
        "四川水电外送", "青海光伏消纳", "宁夏新能源占比", "新疆弃电统计",
        "西藏光伏项目备案", "海南海上风电", "重庆分布式光伏", "天津海上光伏",
        "上海绿电交易", "北京分布式光伏", "辽宁核电与新能源", "吉林风电",
        "黑龙江生物质", "安徽光伏指标", "福建海上风电", "江西屋顶光伏",
        "河南农光互补", "湖北渔光互补", "湖南储能政策", "广西岩溶地区光伏",
        "贵州能源结构", "云南西电东送", "陕西煤电基准价", "甘肃酒泉风电",
        "全国电力市场规则", "容量电价", "辅助服务", "需求响应", "绿证交易规则",
        "碳排放核算方法", "光伏用地政策", "接网审批时限", "电力业务许可证",
        "测算假设清单",
    ]
]
assert len(QUESTIONS) == 60


def _endpoints() -> dict:
    # 文心模型号以千帆控制台为准，未确认时用 ernie-4.5-turbo-32k，可用 NENGJIAN_GEO_WENXIN_MODEL 覆盖。
    # 豆包常用推理接入点 ep-，由 NENGJIAN_GEO_DOUBAO_MODEL 提供。
    return {
        "qwen": {
            "url": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            "model": os.environ.get("NENGJIAN_GEO_QWEN_MODEL", "qwen3.5-plus"),
            "key": os.environ.get("NENGJIAN_GEO_QWEN_API_KEY", ""),
        },
        "wenxin": {
            "url": "https://qianfan.baidubce.com/v2/chat/completions",
            "model": os.environ.get("NENGJIAN_GEO_WENXIN_MODEL", "ernie-4.5-turbo-32k"),
            "key": os.environ.get("NENGJIAN_GEO_WENXIN_API_KEY", ""),
        },
        "doubao": {
            "url": os.environ.get("NENGJIAN_ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3").rstrip("/") + "/chat/completions",
            "model": os.environ.get("NENGJIAN_GEO_DOUBAO_MODEL", ""),
            "key": os.environ.get("NENGJIAN_GEO_DOUBAO_API_KEY", ""),
        },
    }


def _post_chat(url: str, key: str, model: str, question: str) -> str:
    import json
    import urllib.request
    payload = {"model": model, "messages": [{"role": "user", "content": question}]}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode() or "{}")
    return ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""


def run_monitor(questions: list[str] | None = None, transport=None) -> dict:
    asked = list(questions or QUESTIONS)
    if not SWITCHES["geo_monitor"]:
        return {"status": "disabled", "reason": "switch off", "questions": len(QUESTIONS), "cited": []}
    missing = [name for name, env in PROVIDERS.items() if not os.environ.get(env)]
    if missing:
        return {"status": "disabled", "reason": "missing keys", "providers": missing, "questions": len(QUESTIONS)}
    endpoints = _endpoints()
    if not endpoints["doubao"]["model"]:
        return {"status": "disabled", "reason": "missing doubao model", "questions": len(QUESTIONS)}
    cited = []
    called = False
    for name, spec in endpoints.items():
        for question in asked:
            called = True
            try:
                if transport is None:
                    answer = _post_chat(spec["url"], spec["key"], spec["model"], question)
                else:
                    answer = transport(name, spec["url"], spec["model"], question)
            except Exception as exc:
                cited.append({"provider": name, "error": exc.__class__.__name__, "cited": False})
                continue
            text = answer or ""
            cited.append({"provider": name, "cited": "新能源智库" in text, "chars": len(text)})
    return {"status": "ok", "questions": len(asked), "cited": cited, "called": called}
