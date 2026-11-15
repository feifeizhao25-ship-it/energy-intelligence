"""把测算报告示例输入写成 PDF。数字只读已生成的 inputs json，不另算一套。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "docs" / "report-samples" / "cn" / "测算报告.inputs.json"
TARGET = ROOT / "docs" / "report-samples" / "cn" / "测算报告.pdf"


def main() -> int:
    if not SOURCE.is_file():
        print("缺少测算报告.inputs.json", file=sys.stderr)
        return 2
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.cidfonts import UnicodeCIDFont
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_LEFT
    except ImportError:
        print("reportlab 未安装", file=sys.stderr)
        return 2
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    style = ParagraphStyle("cn", fontName="STSong-Light", fontSize=11, leading=18, alignment=TA_LEFT)
    title = ParagraphStyle("title", fontName="STSong-Light", fontSize=16, leading=24, alignment=TA_LEFT)
    inputs = payload["inputs"]
    energy = payload["energy"]
    financial = payload["financial"]
    story = [
        Paragraph("新能源智库 · 测算报告", title),
        Spacer(1, 6 * mm),
        Paragraph(inputs["note"], style),
        Spacer(1, 4 * mm),
        Paragraph("一、示例输入", title),
        Paragraph(f"装机 {inputs['capacityKw']} kW，屋顶，标准组件，倾角 {inputs['tiltDeg']} 度，方位角 {inputs['azimuthDeg']} 度。", style),
        Paragraph(f"水平面年辐照 {inputs['annualGhiKWhPerM2']} kWh/m²（各月日均 {inputs['monthlyDailyGhiKWhPerM2']:.4f} kWh/m²，示例假设）。气温 {inputs['temperatureC']} ℃（示例假设）。", style),
        Paragraph(f"自用电价 {inputs['selfUsePriceYuanPerKwh']} 元/度，上网电价 {inputs['feedInPriceYuanPerKwh']} 元/度，自用比例 {inputs['selfUseRatio']}。单位投资 {inputs['unitCostYuanPerKw']} 元/kW。这些电价是示例输入，不是省级电价表。", style),
        Spacer(1, 4 * mm),
        Paragraph("二、计算器输出", title),
        Paragraph(f"引擎：{payload['engine']}。生成时间：{payload['generatedAt']}。", style),
        Paragraph(f"首年发电量 {energy['year1KWh']:.2f} kWh。等效利用小时 {energy['equivalentHours']:.2f} h。组件平面辐照 {energy['planeIrradiation']:.2f} kWh/m²。性能比 {energy['pr']:.4f}。", style),
        Paragraph(f"内部收益率 {financial['irr']:.2f}%。静态回收期 {financial['paybackYears']:.2f} 年。平准化度电成本 {financial['lcoe']:.4f} 元/度。总投资 {financial['investmentYuan']:.0f} 元。", style),
        Spacer(1, 4 * mm),
        Paragraph("以上为测算值，不构成投资建议。示例数据已标明。", style),
    ]
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    SimpleDocTemplate(str(TARGET), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=18 * mm).build(story)
    print(json.dumps({"wrote": str(TARGET)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
