"""
诊断服务（恢复重建版）。

原文件只剩函数中段残片。保留残片中的核心不变式：
- 生产环境禁止使用合成规则评分（fail-closed）
- 诊断结果必须包含 score(0-100 int) / issues(list) / metrics(dict)
- 没有真实渲染器时不返回伪报告链接
"""

from typing import Any, Dict, Optional

from app.config import settings


def validate_diagnosis_result(data: Dict[str, Any]) -> Dict[str, Any]:
    """校验诊断引擎输出的完整性；不合法直接抛错（不兜底合成）。"""
    required = ("score", "issues", "metrics")
    if any(key not in data for key in required):
        raise ValueError("diagnosis engine returned an incomplete result")
    if not isinstance(data["score"], int) or not 0 <= data["score"] <= 100:
        raise ValueError("diagnosis engine returned an invalid score")
    if not isinstance(data["issues"], list) or not isinstance(data["metrics"], dict):
        raise ValueError("diagnosis engine returned invalid issues or metrics")
    return data


class DiagnosisService:
    async def run_diagnosis(self, diagnosis, project, llm_result=None) -> Dict[str, Any]:
        """执行诊断：优先 LLM 结果；无可用引擎时生产环境直接报错。"""
        if llm_result:
            diagnosis.result = llm_result
            diagnosis.result["engine"] = "llm"
        else:
            if settings.ENVIRONMENT == "production":
                raise RuntimeError(
                    "Verified diagnosis engine is unavailable; "
                    "synthetic rule scores are disabled in production"
                )
            ptype = getattr(project, "technology", "solar")
            capacity = getattr(project, "capacity_mw", 0) or 0
            rule_result = await self._rule_based_diagnosis(diagnosis, project, ptype, capacity)
            diagnosis.result = rule_result
            diagnosis.result["engine"] = "synthetic_rule_estimate_development_only"
        return validate_diagnosis_result(diagnosis.result)

    async def _rule_based_diagnosis(self, diagnosis, project, ptype: str, capacity: float) -> Dict[str, Any]:
        """开发环境专用的规则估算（输出带 engine 标记，绝不冒充真实诊断）。"""
        return {
            "score": 50,
            "issues": [],
            "metrics": {"technology": ptype, "capacity_mw": capacity},
        }

    def render_report_link(self, diagnosis) -> Optional[str]:
        """生成诊断报告；当前没有真实渲染器时不返回伪链接。"""
        return None


diagnosis_service = DiagnosisService()
