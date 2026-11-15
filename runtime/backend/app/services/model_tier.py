"""国内模型分层。价格是公开价测算，不是实时报价，也不发起调用。

批量摘要：DeepSeek Flash。
裁判与合规二审：通义千问 qwen-plus。
向量：text-embedding-v4。
"""
from __future__ import annotations

# 元 / 千 token。用于验收测算，改价时只改这里。
RATES = {
    "deepseek-flash": {"input": 0.001, "output": 0.002},
    "qwen-plus": {"input": 0.0008, "output": 0.002},
    "text-embedding-v4": {"input": 0.0005, "output": 0.0},
}

TIERS = {
    "summary": {"provider": "deepseek", "model": "deepseek-flash"},
    "judge": {"provider": "dashscope", "model": "qwen-plus"},
    "compliance": {"provider": "dashscope", "model": "qwen-plus"},
    "embedding": {"provider": "dashscope", "model": "text-embedding-v4"},
}


def tier_for(task: str) -> dict:
    if task not in TIERS:
        raise KeyError(task)
    return dict(TIERS[task])


def estimate_cost_cny(model: str, input_tokens: int, output_tokens: int = 0) -> float:
    rate = RATES[model]
    return (input_tokens / 1000) * rate["input"] + (output_tokens / 1000) * rate["output"]


def qa_within_budget(input_tokens: int = 2000, output_tokens: int = 800) -> bool:
    """单次问答按摘要模型测算，上限 0.03 元。"""
    return estimate_cost_cny("deepseek-flash", input_tokens, output_tokens) <= 0.03


def judge_within_budget(input_tokens: int = 1500, output_tokens: int = 8) -> bool:
    """裁判额外成本上限 0.01 元。"""
    return estimate_cost_cny("qwen-plus", input_tokens, output_tokens) <= 0.01
