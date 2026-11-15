.PHONY: eval

# 每晚发布门禁：单测由调用方另行执行；本目标跑黄金集、红队、calc-verify 与 32 个场景。
eval:
	PYTHONPATH=runtime/backend python3 runtime/scripts/run_eval.py
