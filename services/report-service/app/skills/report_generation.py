"""RP-090（F-090）项目报告生成技能（恢复重建版）。

复用 后端/app/routers/reports.py 的真实生成器：
- generate_docx / generate_pdf（market=global 走全英文分支）
- calc_financial_metrics 由 project["financial"] 计算 NPV/IRR/LCOE 等指标
- TEMPLATES 提供四种报告模板（feasibility/investment/compliance/esg）

进程工作目录为 后端/ 时直接 import；注册表从其他工作目录加载时补后端路径。

输入：project（项目数据 dict）、report_type、market（cn/global）、
output_format（docx/pdf）、title/confidential/storage_dir 可选。
输出：文件字节长度、格式、存储路径参数（不直接落盘，由调用方决定写入）。

fail-closed：project 缺关键数据（name/capacity_mw/financial.initial_investment）
时，生产环境抛 RuntimeError（拒绝用示例数据冒充真实项目报告）；
开发环境回退 _demo_data() 示例数据并标注 engine/estimated。
"""

from __future__ import annotations

import os
import uuid
from typing import Any, Dict

try:
    from app.routers.reports import (
        HAS_DOCX,
        HAS_REPORTLAB,
        TEMPLATES,
        _demo_data,
        calc_financial_metrics,
        generate_docx,
        generate_pdf,
    )
except ImportError:  # 注册表从其他工作目录加载本文件时，补后端路径
    import sys
    from pathlib import Path

    _BACKEND_DIR = Path(__file__).resolve().parents[4] / "后端"
    if str(_BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(_BACKEND_DIR))
    from app.routers.reports import (
        HAS_DOCX,
        HAS_REPORTLAB,
        TEMPLATES,
        _demo_data,
        calc_financial_metrics,
        generate_docx,
        generate_pdf,
    )

_REQUIRED_PROJECT_FIELDS = ("name", "capacity_mw")


def _is_production() -> bool:
    return (
        os.getenv("ENVIRONMENT", "").lower() == "production"
        or os.getenv("APP_ENV", "").lower() == "production"
    )


class ReportGenerationSkill:
    """RP-090（F-090）项目报告生成。"""

    skill_id = "RP-090"
    aliases = ["F-090"]  # 运营规格首发编号：F-090 项目报告生成
    name = "项目报告生成"
    description = (
        "基于项目数据调用报告引擎生成 docx/pdf 报告，market=global 输出全英文版本；"
        "返回文件字节长度与存储路径参数。项目数据缺失时生产环境 fail-closed。"
    )
    category = "RP"
    references = [
        "NB/T 32043-2018 光伏发电工程可行性研究报告编制规程",
        "《投资项目可行性研究指南》（报告章节结构）",
        "IRENA Project Facilitation 报告模板（global 英文分支）",
    ]

    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        project = params.get("project")
        report_type = str(params.get("report_type", "feasibility"))
        market = str(params.get("market", "cn"))
        output_format = str(params.get("output_format", "docx")).lower()

        if report_type not in TEMPLATES:
            raise ValueError(
                f"RP-090 不支持的 report_type: {report_type}（可选: {sorted(TEMPLATES)}）"
            )
        if output_format not in ("docx", "pdf"):
            raise ValueError(f"RP-090 不支持的 output_format: {output_format}")

        # ── 项目数据：缺关键字段时生产 fail-closed，开发回退示例数据 ──
        engine = "reports.generate_" + output_format
        estimated = False
        if not isinstance(project, dict) or not self._has_required_data(project):
            if _is_production():
                raise RuntimeError(
                    "RP-090 生产环境缺少项目关键数据"
                    "（name/capacity_mw/financial.initial_investment），"
                    "拒绝用示例数据冒充真实项目报告"
                )
            demo = _demo_data()
            if isinstance(project, dict):
                demo.update({k: v for k, v in project.items() if v is not None})
            project = demo
            engine += "+demo_data_fallback"
            estimated = True

        template_info = TEMPLATES[report_type]
        metrics = calc_financial_metrics(project.get("financial", {}))

        global_market = market in ("global", "en", "int")
        if params.get("title"):
            title = str(params["title"])
        else:
            title = (
                f"{template_info.name_en} — {project.get('name', 'Project')}"
                if global_market
                else f"{project.get('name', '项目')}{template_info.name_zh}"
            )
        confidential = str(
            params.get("confidential", "Confidential" if global_market else "内部")
        )

        if output_format == "docx":
            if not HAS_DOCX:
                raise RuntimeError("RP-090 需要 python-docx，当前环境未安装")
            file_bytes = generate_docx(
                project, report_type, template_info, metrics, title, confidential,
                market=market,
            )
        else:
            if not HAS_REPORTLAB:
                raise RuntimeError("RP-090 需要 reportlab，当前环境未安装")
            file_bytes = generate_pdf(
                project, report_type, template_info, metrics, title, confidential,
                market=market,
            )

        report_id = str(params.get("report_id") or uuid.uuid4())
        storage_dir = str(params.get("storage_dir", "generated_reports"))
        filename = f"{report_id}.{output_format}"
        storage_path = os.path.join(storage_dir, filename)

        result: Dict[str, Any] = {
            "skill_id": self.skill_id,
            "report_id": report_id,
            "report_type": report_type,
            "market": market,
            "format": output_format,
            "file_size_bytes": len(file_bytes),
            "storage": {
                "directory": storage_dir,
                "filename": filename,
                "path": storage_path,
            },
            "title": title,
            "template_name": (
                template_info.name_en if global_market else template_info.name_zh
            ),
            "metrics": metrics,
            "engine": engine,
            "estimated": estimated,
            "references": list(self.references),
        }
        if estimated:
            result["warning"] = (
                "示例数据降级结果——非真实项目数据，仅供开发环境演示"
                if not global_market
                else "Demo-data fallback result — development only"
            )
        return result

    @staticmethod
    def _has_required_data(project: Dict[str, Any]) -> bool:
        for field in _REQUIRED_PROJECT_FIELDS:
            if not project.get(field):
                return False
        try:
            if float(project.get("capacity_mw") or 0) <= 0:
                return False
        except (TypeError, ValueError):
            return False
        financial = project.get("financial") or {}
        return bool(financial.get("initial_investment"))
