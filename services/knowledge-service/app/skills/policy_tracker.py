"""KA-070（F-070）政策追踪与影响评估技能（恢复重建版）。

规则法结构化解析（确定性、可复算）：
1. 适用技术：关键词匹配（光伏/风电/储能/氢能/生物质，solar/wind/storage/...）；
2. 生效日期：正则抽取「自YYYY年M月D日起施行/实施/执行」或 ISO 日期，
   元数据 effective_date 显式提供时优先；
3. 补贴/电价要点：抽取含 补贴/电价/上网电价/元每千瓦时/subsidy/tariff/feed-in
   等关键词的句子；
4. impact_score（0-1，规则法权重，三类命中相加）：
   - 补贴变动（补贴退坡/取消补贴/电价调整/subsidy/tariff 等）：0.45
   - 并网规则（并网/电网接入/interconnection/grid connection 等）：0.35
   - 消纳权重（消纳/保障性收购/弃风弃光/curtailment 等）：0.20
   impact_score > 0.7 → alert=true。

LLM 策略：生产环境未配置 LLM API Key 时 fail-closed（拒绝仅以规则法
冒充完整政策解析结果）；开发环境回退规则法并标注 engine/estimated。
配置 LLM 时仍先跑规则法（当前实现未做 LLM 增强，engine 如实标注）。

输出键按政策文本语言选择：中文文本 → 中文键，英文文本 → 英文键。
检索佐证复用 后端/app/services/rag_service.py 的 RAGService，
用政策文本片段检索 RAG 注册表政策条目，附 hits（source_id/score/freshness）。
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    from app.services.rag_service import RAGService
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.services.rag_service import RAGService

# impact_score 规则权重（补贴变动 / 并网规则 / 消纳权重）
WEIGHT_SUBSIDY = 0.45
WEIGHT_GRID = 0.35
WEIGHT_CONSUMPTION = 0.20
ALERT_THRESHOLD = 0.7

_LLM_KEY_ENVS = (
    "DASHSCOPE_API_KEY",
    "DEEPSEEK_API_KEY",
    "GLM_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
)

_TECH_KEYWORDS = [
    ("solar_pv", ["光伏", "太阳能", "solar", "photovoltaic", "pv"]),
    ("wind", ["风电", "风力发电", "wind"]),
    ("storage", ["储能", "电池", "storage", "battery"]),
    ("hydrogen", ["氢能", "绿氢", "hydrogen"]),
    ("biomass", ["生物质", "biomass"]),
]

_SUBSIDY_KEYWORDS = [
    "补贴退坡", "取消补贴", "补贴", "上网电价", "电价调整", "标杆电价",
    "度电补贴", "subsidy", "subsidies", "tariff", "feed-in", "fit ",
]
_GRID_KEYWORDS = [
    "并网", "电网接入", "接入系统", "接网", "interconnection",
    "grid connection", "grid access",
]
_CONSUMPTION_KEYWORDS = [
    "消纳", "保障性收购", "全额收购", "弃风", "弃光",
    "curtailment", "consumption guarantee",
]

_CN_EFFECTIVE_RE = re.compile(
    r"自\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*起?\s*(?:施行|实施|执行|生效)"
)
_ISO_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")

_POINT_KEYWORDS = (
    "补贴", "电价", "上网", "千瓦时", "kwh", "元/",
    "subsidy", "tariff", "feed-in", "price", "rate",
)


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


def _llm_configured() -> bool:
    return any(os.getenv(env) for env in _LLM_KEY_ENVS)


def _is_chinese(text: str) -> bool:
    return any("一" <= ch <= "鿿" for ch in text)


def detect_technologies(text: str) -> List[str]:
    """按关键词识别适用技术，返回规范化技术代码列表。"""
    lowered = text.lower()
    found = []
    for code, keywords in _TECH_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            found.append(code)
    return found


def extract_effective_date(text: str) -> Optional[str]:
    """抽取生效日期，返回 ISO 字符串；抽不到返回 None。"""
    m = _CN_EFFECTIVE_RE.search(text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = _ISO_DATE_RE.search(text)
    if m:
        return m.group(1)
    return None


def extract_subsidy_points(text: str) -> List[str]:
    """抽取含补贴/电价关键词的句子（中英句读切分）。"""
    sentences = re.split(r"[。；;.!?\n]", text)
    points = []
    for sentence in sentences:
        s = sentence.strip()
        if not s:
            continue
        lowered = s.lower()
        if any(kw in lowered for kw in _POINT_KEYWORDS):
            points.append(s)
    return points


def compute_impact(text: str) -> Tuple[float, Dict[str, bool]]:
    """规则法影响评分：三类权重相加，返回 (score, 各类命中情况)。"""
    lowered = text.lower()
    hits = {
        "subsidy": any(kw in lowered for kw in _SUBSIDY_KEYWORDS),
        "grid": any(kw in lowered for kw in _GRID_KEYWORDS),
        "consumption": any(kw in lowered for kw in _CONSUMPTION_KEYWORDS),
    }
    score = 0.0
    if hits["subsidy"]:
        score += WEIGHT_SUBSIDY
    if hits["grid"]:
        score += WEIGHT_GRID
    if hits["consumption"]:
        score += WEIGHT_CONSUMPTION
    return round(min(score, 1.0), 4), hits


class PolicyTrackerSkill:
    """KA-070（F-070）政策追踪与影响评估。"""

    skill_id = "KA-070"
    aliases = ["F-070"]  # 运营规格首发编号：F-070 政策追踪
    name = "政策追踪与影响评估"
    description = (
        "对政策文本做结构化解析（适用技术/生效日期/补贴电价要点），"
        "规则法计算 impact_score 并在 >0.7 时触发 alert；"
        "附 RAG 注册表政策条目检索佐证。LLM 未配置时生产 fail-closed。"
    )
    category = "KA"
    references = [
        "国家发改委/能源局新能源上网电价与补贴政策文件",
        "国家能源局《电网公平开放监管办法》（并网规则）",
        "全国新能源消纳监测预警机制（消纳权重）",
    ]

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        text = params.get("policy_text") or params.get("text")
        if not text or not str(text).strip():
            raise ValueError("KA-070 需要 policy_text 参数")
        text = str(text)
        metadata = params.get("metadata") or {}
        market = params.get("market", "cn")

        # LLM 配置检查：生产 fail-closed，开发规则法降级并标注
        estimated = False
        if _llm_configured():
            engine = "rule_based+llm_available"
        else:
            if _is_production():
                raise RuntimeError(
                    "KA-070 生产环境未配置 LLM API Key，"
                    "拒绝仅以规则法结果冒充完整政策解析"
                )
            engine = "rule_based_fallback"
            estimated = True

        technologies = detect_technologies(text)
        effective_date = (
            str(metadata.get("effective_date"))
            if metadata.get("effective_date")
            else extract_effective_date(text)
        )
        points = extract_subsidy_points(text)
        score, hits = compute_impact(text)
        alert = score > ALERT_THRESHOLD
        related = self._rag_corroboration(text, market)

        chinese = _is_chinese(text)
        core: Dict[str, Any] = {
            "skill_id": self.skill_id,
            "impact_score": score,
            "alert": alert,
            "impact_categories": hits,
            "engine": engine,
            "estimated": estimated,
            "references": list(self.references),
        }
        if chinese:
            core.update(
                {
                    "适用技术": technologies,
                    "生效日期": effective_date,
                    "补贴电价要点": points,
                    "政策标题": metadata.get("title"),
                    "相关政策佐证": related,
                }
            )
        else:
            core.update(
                {
                    "applicable_technologies": technologies,
                    "effective_date": effective_date,
                    "subsidy_tariff_points": points,
                    "policy_title": metadata.get("title"),
                    "related_policies": related,
                }
            )
        if estimated:
            core["warning"] = (
                "规则法降级结果（未配置 LLM）——仅供开发环境演示"
                if chinese
                else "Rule-based fallback (no LLM configured) — development only"
            )
        return core

    def _rag_corroboration(self, text: str, market: str) -> List[Dict[str, Any]]:
        """用政策文本片段检索 RAG 注册表政策条目作为佐证；不可用时返回空列表。"""
        try:
            service = RAGService()
            query = re.sub(r"\s+", " ", text)[:80]
            result = service.search(query, top_k=3, market=market)
            return [
                {
                    "source_id": hit.source_id,
                    "title": hit.title,
                    "score": round(hit.score, 4),
                    "freshness_status": hit.metadata.get("freshness_status"),
                }
                for hit in result.hits
                if hit.score > 0
            ]
        except Exception:
            return []
