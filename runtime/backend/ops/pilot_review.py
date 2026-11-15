"""搜索试点的人工样本。周报默认关闭，只读已经落盘的结果，不改检索参数。"""

from __future__ import annotations

import json
import os
from pathlib import Path

# 人工列出的站内页面，供检索试点对照。不是自动生成的营销文案。
SEO_SAMPLE = [
    "测算首页", "资源地图", "项目列表", "项目运维", "运维诊断", "文献检索", "文献图谱",
    "政策检索", "数据集", "每日一数", "政策提醒", "季度简报", "会员方案", "订单确认",
    "服务状态", "充电测算", "排放测算", "审计记录", "问答社区", "避坑指南",
    "企业空间", "开发者中心", "登录", "注册", "服务条款", "隐私政策", "发票申请",
    "工单列表", "遥测接入", "告警阈值", "性能比", "组件曲线", "逆变器代码",
    "并网图层", "用地图层", "省级资源样本", "对比地点", "测算报告", "假设清单",
    "短信登录", "支付宝订单", "微信订单", "对账差额", "心跳状态", "管理台",
    "文献上传", "开放语料", "知识节点", "引用连线", "导出表格", "导出幻灯",
    "个人数据导出", "账号注销",
]


def seo_sample_pages() -> list[str]:
    if len(SEO_SAMPLE) < 50:
        raise RuntimeError("人工样本不足 50 条")
    return list(SEO_SAMPLE)


def geo_weekly_report(path: str | None = None) -> dict:
    if os.environ.get("NENGJIAN_GEO_WEEKLY") != "1":
        return {"enabled": False, "rows": [], "note": "周报默认关闭"}
    target = Path(path or os.environ.get("NENGJIAN_GEO_WEEKLY_FILE", ""))
    if not target.is_file():
        return {"enabled": True, "rows": [], "note": "没有已落盘的检索结果"}
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"enabled": True, "rows": [], "note": "结果文件无法读取"}
    rows = payload.get("rows") if isinstance(payload, dict) else None
    return {"enabled": True, "rows": rows if isinstance(rows, list) else [], "note": "只列出已保存的结果"}
