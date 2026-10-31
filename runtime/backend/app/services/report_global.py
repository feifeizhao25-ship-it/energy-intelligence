"""International (English) report content and renderers.

One content model (``build_report``) feeds two renderers (PDF via ReportLab, DOCX via python-docx),
so both formats carry the same sections, tables and numbers. Nothing here is hard-coded as a finding:
every figure is computed from the project inputs and says so, anything that was not supplied is shown as
"Not provided", and compliance items stay "Not verified" until a person confirms them. No investment
advice, and nothing about future prices.
"""

from __future__ import annotations

import io
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

CJK = re.compile(r"[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]")
NOT_PROVIDED = "Not provided"
NO_UNIQUE_IRR = "No unique value (cash flows change sign more than once)"

# block kinds: ("h", level, text) ("p", text) ("bullets", [text]) ("table", header, rows, caption) ("bars", labels, values, caption)
Block = Tuple


def _en(text: Any) -> str:
    """User-entered free text is kept only if it is not Chinese (the international edition is English)."""
    t = "" if text is None else str(text)
    return "" if CJK.search(t) else t


def _num(v: Any, digits: int = 0) -> str:
    return f"{v:,.{digits}f}" if isinstance(v, (int, float)) and v == v else NOT_PROVIDED


def _money(v: Any, cur: str) -> str:
    if not isinstance(v, (int, float)) or v != v:
        return NOT_PROVIDED
    a = abs(v)
    if a >= 1e9:
        return f"{cur} {v / 1e9:,.2f} bn"
    if a >= 1e6:
        return f"{cur} {v / 1e6:,.2f} m"
    return f"{cur} {v:,.0f}"


def _pct(v: Any, digits: int = 1) -> str:
    if not isinstance(v, (int, float)) or v != v:
        return NO_UNIQUE_IRR
    return f"{v * 100:.{digits}f}%"


def _type_label(t: str) -> str:
    return {"solar_pv": "Solar PV", "wind": "Wind", "storage": "Energy storage", "hybrid": "Hybrid"}.get(t or "", (t or NOT_PROVIDED).replace("_", " ").title())


def _location(data: Dict[str, Any]) -> str:
    parts = [_en(data.get(k)) for k in ("city", "province_or_region", "country_code")]
    return ", ".join(p for p in parts if p) or NOT_PROVIDED


def citation(i: int, src: Dict[str, Any]) -> str:
    bits = [f"[{i}] {_en(src.get('title')) or 'Untitled source'}", str(src.get("url") or "no URL")]
    if src.get("authors"):
        bits.append(f"Authors: {_en(src['authors'])}")
    if src.get("version"):
        bits.append(f"Version: {_en(src['version'])}")
    if src.get("published_at"):
        bits.append(f"Published: {src['published_at']}")
    if src.get("locator"):
        bits.append(f"Locator: {_en(src['locator'])}")
    bits.append(f"Retrieved: {src.get('retrieved_at') or 'not recorded'}")
    return " | ".join(bits)


def _sensitivity(fin: Dict[str, Any], calc) -> List[List[str]]:
    rows = []
    tariff = fin.get("electricity_price")
    if not isinstance(tariff, (int, float)):
        return rows
    base = calc(fin)
    for delta in (-0.10, -0.05, 0.0, 0.05, 0.10):
        m = calc({**fin, "electricity_price": tariff * (1 + delta)})
        d_irr = (m["irr"] - base["irr"]) if (m["irr"] == m["irr"] and base["irr"] == base["irr"]) else None
        rows.append([f"{delta:+.0%}", _pct(m["irr"]), "-" if d_irr is None else f"{d_irr * 100:+.1f} pp", f"{m['npv']:,.0f}"])
    return rows


def build_report(data: Dict[str, Any], report_type: str, template, metrics: Dict[str, Any], title: str,
                 confidential: str, calc=None) -> Dict[str, Any]:
    fin = data.get("financial") or {}
    cur = _en(data.get("currency")) or "USD"
    name = _en(data.get("name")) or "the project"
    cap = data.get("capacity_mw")
    sources = [s for s in (data.get("data_sources") or []) if isinstance(s, dict)]
    life = fin.get("project_life_years", metrics.get("project_life"))
    gen = fin.get("annual_generation_mwh")
    hours = (gen / cap) if isinstance(gen, (int, float)) and isinstance(cap, (int, float)) and cap else None
    irr_txt = _pct(metrics.get("irr"))
    kpis = [
        ["Net present value (NPV)", _money(metrics.get("npv"), cur), "Sum of discounted net cash flows"],
        ["Internal rate of return (IRR)", irr_txt, "Rate at which NPV equals zero"],
        ["Payback period", f"{metrics['payback_years']:.1f} years" if isinstance(metrics.get("payback_years"), (int, float)) else NOT_PROVIDED, "First year cumulative cash flow is positive"],
        ["LCOE", f"{cur} {metrics['lcoe']:.4f} / kWh" if isinstance(metrics.get("lcoe"), (int, float)) else NOT_PROVIDED, "Lifetime cost PV / lifetime energy"],
    ]
    facts = [
        ["Project", name], ["Type", _type_label(data.get("project_type", ""))],
        ["Capacity", f"{_num(cap, 1)} MW"], ["Location", _location(data)], ["Currency", cur],
        ["Status", (_en(data.get("status")) or NOT_PROVIDED).replace("_", " ").title()],
        ["Project life", f"{life} years" if life else NOT_PROVIDED],
    ]
    assumptions = [
        ["Initial investment", _money(fin.get("initial_investment"), cur)],
        ["Annual generation", f"{_num(gen)} MWh" if gen is not None else NOT_PROVIDED],
        ["Equivalent full-load hours", f"{hours:,.0f} h / year" if hours else NOT_PROVIDED],
        ["Electricity price", f"{cur} {fin['electricity_price']:.4f} / kWh" if isinstance(fin.get("electricity_price"), (int, float)) else NOT_PROVIDED],
        ["Price escalation", _pct(fin.get("price_escalation_rate", 0.02))],
        ["Annual operating cost (year 1)", _money(fin.get("opex_annual"), cur)],
        ["Operating cost escalation", _pct(fin.get("opex_escalation_rate", 0.025))],
        ["Discount rate", _pct(fin.get("discount_rate"))],
    ]
    cfs = metrics.get("cashflows") or []
    first5 = [[f"Year {y}", f"{cur} {cfs[y]:,.0f}"] for y in range(1, min(6, len(cfs)))]
    sens = _sensitivity(fin, calc) if calc else []
    sens_table = ("table", ["Electricity price change", "IRR", "IRR change", f"NPV ({cur})"], sens, "Sensitivity of returns to the electricity price") if sens else None
    factor = fin.get("grid_emission_factor_tco2_per_mwh") or data.get("grid_emission_factor_tco2_per_mwh")

    def emissions() -> List[Block]:
        if isinstance(factor, (int, float)) and isinstance(gen, (int, float)):
            t = gen * factor
            return [("p", f"Avoided emissions are computed as annual generation x grid emission factor: {gen:,.0f} MWh x {factor} tCO2/MWh = {t:,.0f} tCO2 per year "
                          f"({t * (life or 0):,.0f} tCO2 over {life or '?'} years, before degradation). The result is a calculation under the stated factor, not a certification.")]
        return [("p", "No grid emission factor was supplied, so no avoided-emissions figure is stated. Provide the factor and its source (for example the national or regional grid operator's published value) to compute it.")]

    def sources_block() -> List[Block]:
        if not sources:
            return [("p", "No verifiable data sources are attached to this project. Figures rest on user-entered inputs only and should not be relied on for a decision until sources are added.")]
        return [("p", citation(i, s)) for i, s in enumerate(sources, 1)]

    S: List[Block] = []
    rt = report_type
    if rt == "feasibility":
        S += [("h", 1, "Project Overview"), ("table", ["Item", "Value"], facts, "Project facts"),
              ("p", _en(data.get("description")) or "No project description was provided.")]
        S += [("h", 1, "Resource Assessment"),
              ("p", "This report does not retrieve weather or resource data. The generation figures below are the inputs entered for the project; confirm them against a site-specific resource study."),
              ("table", ["Parameter", "Value"], [assumptions[1], assumptions[2]], "Generation inputs")]
        S += [("h", 1, "Technical Design"),
              ("p", f"Installed capacity {_num(cap, 1)} MW, {_type_label(data.get('project_type', ''))}, designed life {life or '?'} years. "
                    "Detailed equipment selection, layout and interconnection design were not supplied and are outside this report.")]
        S += [("h", 1, "Financial Analysis"), ("h", 2, "Key indicators"),
              ("table", ["Indicator", "Result", "Definition"], kpis, "Key financial indicators (calculated from the inputs)")]
        if first5:
            S += [("h", 2, "Net cash flow, first five years"), ("table", ["Year", f"Net cash flow ({cur})"], first5, "Net cash flow by year"),
                  ("bars", [r[0] for r in first5], [cfs[y] for y in range(1, len(first5) + 1)], "Net cash flow, first five years")]
        if sens_table:
            S += [("h", 2, "Price sensitivity"), sens_table]
        S += [("h", 1, "Risk Assessment"),
              ("p", "Exposure is stated from the model, not from a rating: the sensitivity table shows how much IRR moves when the electricity price changes by 10%. "
                    "Other risks to review with specialists are listed below."),
              ("bullets", ["Market and price: revenue depends on the realised electricity price and curtailment.",
                           "Resource: actual generation can differ from the entered annual generation.",
                           "Cost: capital and operating costs can move before financial close.",
                           "Financing: interest rate and debt terms change returns.",
                           "Regulatory: incentives, permits and grid rules can change."])]
        S += [("h", 1, "Methods and Assumptions"),
              ("table", ["Parameter", "Value"], assumptions, "Model assumptions"),
              ("bullets", ["NPV = sum over t of CF_t / (1 + r)^t.", "IRR: the rate r where NPV(r) = 0; reported only if it is unique.",
                           "LCOE = present value of lifetime costs / lifetime energy produced.", "Payback = first year in which cumulative cash flow turns positive."])]
    elif rt == "investment":
        S += [("h", 1, "Executive Summary"),
              ("p", f"{name} is a {_num(cap, 1)} MW {_type_label(data.get('project_type', '')).lower()} project in {_location(data)}. "
                    f"With the inputs listed in this report the model gives NPV {_money(metrics.get('npv'), cur)}, IRR {irr_txt} and LCOE "
                    f"{cur} {metrics.get('lcoe', 0):.4f}/kWh. These are calculation results, not a recommendation."),
              ("table", ["Indicator", "Result", "Definition"], kpis, "Key financial indicators")]
        S += [("h", 1, "Market Analysis"),
              ("p", "Only published data that is attached as a source is used; no market forecast is made. Sources attached to this project:")] + sources_block()
        S += [("h", 1, "Financial Model"), ("table", ["Parameter", "Value"], assumptions, "Model assumptions")]
        if first5:
            S += [("table", ["Year", f"Net cash flow ({cur})"], first5, "Net cash flow by year"),
                  ("bars", [r[0] for r in first5], [cfs[y] for y in range(1, len(first5) + 1)], "Net cash flow, first five years")]
        S += [("h", 1, "Sensitivity Analysis")] + ([sens_table] if sens_table else [("p", "Sensitivity could not be computed because no electricity price was supplied.")])
        S += [("h", 1, "Emissions Accounting")] + emissions()
        S += [("h", 1, "Calculation Result"),
              ("p", "The figures repeat the inputs and the stated formulas. Changing an input changes the result; the report is a calculation record and is neither a rating nor investment advice."),
              ("bullets", ["NPV = sum over t of CF_t / (1 + r)^t.", "IRR: the rate r where NPV(r) = 0; reported only if unique.", "LCOE = PV of lifetime costs / lifetime energy."])]
    elif rt == "compliance":
        items = [("Environmental impact assessment / permit", "Environmental authority"),
                 ("Land rights and land-use permission", "Land registry / local authority"),
                 ("Grid interconnection agreement and study", "Grid operator"),
                 ("Construction and building permits", "Local planning authority"),
                 ("Generation licence or registration (if required)", "Energy regulator"),
                 ("Incentive or tax-credit eligibility", "Tax authority / programme administrator")]
        S += [("h", 1, "Regulatory Checklist"),
              ("p", f"Items an international project in {_location(data)} normally has to address. Status is 'Not verified' until a person records evidence; this report does not determine compliance."),
              ("table", ["Requirement", "Authority", "Status"], [[a, b, "Not verified"] for a, b in items], "Regulatory checklist")]
        S += [("h", 1, "Permit Status"), ("p", "No permit records were supplied. Add permit numbers, issue and expiry dates to the project to show status here."),
              ("table", ["Permit", "Status"], [[a, "No record"] for a, _ in items[:5]], "Permit register")]
        S += [("h", 1, "Environmental Impact Assessment"), ("p", "No assessment document is attached. Environmental studies are performed by qualified consultants and approved by the competent authority.")]
        S += [("h", 1, "Land Use Analysis"), ("p", "Land area, ownership and zoning were not supplied. Confirm title, lease terms and zoning with local counsel.")]
        S += [("h", 1, "Grid Interconnection Plan"), ("p", "Interconnection capacity, voltage level and queue position were not supplied. Interconnection standards such as IEEE 1547 apply in the United States; confirm the standard for your market.")]
    else:  # esg
        S += [("h", 1, "Carbon Emissions & Reduction")] + emissions()
        S += [("h", 1, "Social Impact"), ("p", "Employment, community engagement and local procurement were not supplied. Add these records to report on them."),
              ("table", ["Topic", "Status"], [["Community consultation", "No record"], ["Local employment", "No record"], ["Health and safety plan", "No record"]], "Social topics")]
        S += [("h", 1, "Corporate Governance"), ("p", "Governance policies (anti-corruption, supply chain, reporting) were not supplied and are not assessed here.")]
        S += [("h", 1, "SDG Alignment"),
              ("p", "Renewable generation relates to these United Nations Sustainable Development Goals. This is a mapping of relevance, not a certification of impact."),
              ("table", ["Goal", "Relevance"], [["SDG 7 Affordable and clean energy", "Adds renewable generation capacity"], ["SDG 13 Climate action", "Avoids emissions when it displaces fossil generation"]], "SDG mapping")]
        S += [("h", 1, "Continuous Improvement"), ("bullets", ["Measure generation and availability monthly and compare with the assumptions.", "Recalculate avoided emissions each year with the current grid factor.", "Review the source list and refresh stale entries."])]

    S += [("h", 1, "Appendix"), ("h", 2, "A. Assumptions and evidence"),
          ("p", "Every figure in this report is calculated from the inputs below; none is a forecast or a guarantee. Sources are listed with the date they were retrieved."),
          ("table", ["Parameter", "Value"], assumptions, "Assumptions register"),
          ("h", 2, "B. Data sources")] + sources_block() + [
          ("h", 2, "C. Required validation before decision"),
          ("p", "Independent engineering review, grid interconnection confirmation and legal due diligence should be completed before any investment decision."),
          ("h", 2, "D. Disclaimer"),
          ("p", "This report is a calculation based on public information and the inputs provided. Results depend on those inputs and may differ from actual outcomes. It is not investment, legal or tax advice, and it says nothing about future prices.")]
    return {
        "title": _en(title) or template.name_en,
        "cover": [("Report", template.name_en), ("Project", name), ("Capacity", f"{_num(cap, 1)} MW"), ("Location", _location(data)),
                  ("Date", datetime.now().strftime("%d %B %Y")), ("Confidentiality", confidential.replace("_", " ").title())],
        "blocks": S,
    }


# ── renderers ──────────────────────────────────────────────────────────────

def _font_path() -> Optional[str]:
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts", "NotoSansSC-Regular-subset.ttf")
    return p if os.path.exists(p) else None


def render_pdf(model: Dict[str, Any]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm, mm
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics.shapes import Drawing
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import PageBreak, Paragraph, Spacer, Table, TableStyle, KeepTogether

    from app.services import report_pdf_support as sup

    font = "Helvetica"
    fp = _font_path()
    if fp:
        try:
            pdfmetrics.registerFont(TTFont("ReportSans", fp))
            font = "ReportSans"
        except Exception:
            font = "Helvetica"
    primary = colors.HexColor("#1A2744")
    base = getSampleStyleSheet()
    st = {
        "title": ParagraphStyle("CoverTitle", parent=base["Title"], fontName=font, fontSize=28, textColor=primary, alignment=1, spaceAfter=18),
        "h1": ParagraphStyle("H1", parent=base["Heading1"], fontName=font, fontSize=17, textColor=primary, spaceBefore=16, spaceAfter=8),
        "h2": ParagraphStyle("H2", parent=base["Heading2"], fontName=font, fontSize=13, textColor=colors.HexColor("#2C3E50"), spaceBefore=10, spaceAfter=5),
        "p": ParagraphStyle("Body", parent=base["Normal"], fontName=font, fontSize=10, leading=15, spaceAfter=6),
        "cap": ParagraphStyle("Caption", parent=base["Normal"], fontName=font, fontSize=8.5, textColor=colors.HexColor("#555555"), alignment=1, spaceAfter=4),
        "toc": ParagraphStyle("TOCTitle", parent=base["Heading1"], fontName=font, fontSize=17, textColor=primary),
        "cell": ParagraphStyle("Cell", parent=base["Normal"], fontName=font, fontSize=9, leading=12),
        "cellh": ParagraphStyle("CellH", parent=base["Normal"], fontName=font, fontSize=9, leading=12, textColor=colors.white),
    }
    esc = lambda s: str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    story: List[Any] = [Spacer(1, 90), Paragraph(esc(model["title"]), st["title"]), Spacer(1, 30)]
    cover = Table([[Paragraph(f"<b>{esc(k)}</b>", st["cell"]), Paragraph(esc(v), st["cell"])] for k, v in model["cover"]], colWidths=[4 * cm, 11 * cm])
    cover.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story += [cover, PageBreak(), Paragraph("Contents", st["toc"]), Spacer(1, 8), sup.build_toc(font), PageBreak()]
    n = [0]
    for b in model["blocks"]:
        kind = b[0]
        if kind == "h":
            story.append(Paragraph(esc(b[2]), st["h1" if b[1] == 1 else "h2"]))
        elif kind == "p":
            story.append(Paragraph(esc(b[1]), st["p"]))
        elif kind == "bullets":
            for t in b[1]:
                story.append(Paragraph("\u2022 " + esc(t), ParagraphStyle("B", parent=st["p"], leftIndent=14, firstLineIndent=-8, spaceAfter=3)))
        elif kind == "table":
            _, header, rows, caption = b
            n[0] += 1
            cw = (A4[0] - 4 * cm) / len(header)
            data = [[Paragraph(esc(h), st["cellh"]) for h in header]] + [[Paragraph(esc(c), st["cell"]) for c in r] for r in rows]
            t = Table(data, colWidths=[cw] * len(header), repeatRows=1)
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), primary), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F7FA")])]))
            story.append(KeepTogether([Paragraph(f"Table {n[0]}. {esc(caption)}", st["cap"]), t, Spacer(1, 8)]))
        elif kind == "bars":
            _, labels, values, caption = b
            d = Drawing(420, 170)
            ch = VerticalBarChart()
            ch.x, ch.y, ch.width, ch.height = 50, 25, 340, 120
            ch.data = [list(values)]
            ch.categoryAxis.categoryNames = labels
            ch.categoryAxis.labels.fontName = font
            ch.valueAxis.labels.fontName = font
            ch.valueAxis.labels.fontSize = 7
            ch.bars[0].fillColor = colors.HexColor("#2E7D6B")
            d.add(ch)
            story.append(KeepTogether([d, Paragraph(esc(caption), st["cap"])]))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor("#888888"))
        canvas.drawString(20 * mm, A4[1] - 14 * mm, model["title"][:90])
        canvas.drawCentredString(A4[0] / 2, 11 * mm, f"Page {doc.page}")
        canvas.restoreState()

    buf = io.BytesIO()
    doc = sup.ReportDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2.2 * cm, bottomMargin=2 * cm, title=model["title"])
    doc.multiBuild(story, onFirstPage=on_page, onLaterPages=on_page)
    return buf.getvalue()


def render_docx(model: Dict[str, Any]) -> bytes:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor

    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(10.5)
    for lvl, size in ((1, 17), (2, 13)):
        s = doc.styles[f"Heading {lvl}"]
        s.font.name = "Calibri"
        s.font.size = Pt(size)
        s.font.color.rgb = RGBColor(0x1A, 0x27, 0x44)

    def field(par, instr, placeholder=""):
        run = par.add_run()
        for t, val in (("begin", None), ("instr", instr), ("separate", None), ("text", placeholder), ("end", None)):
            if t == "instr":
                el = OxmlElement("w:instrText"); el.set(qn("xml:space"), "preserve"); el.text = val
            elif t == "text":
                el = OxmlElement("w:t"); el.text = val
            else:
                el = OxmlElement("w:fldChar"); el.set(qn("w:fldCharType"), t)
            run._element.append(el)

    t = doc.add_paragraph(); t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run(model["title"]); r.bold = True; r.font.size = Pt(26); r.font.color.rgb = RGBColor(0x1A, 0x27, 0x44)
    for _ in range(3):
        doc.add_paragraph()
    ct = doc.add_table(rows=0, cols=2)
    for k, v in model["cover"]:
        cells = ct.add_row().cells
        cells[0].text = k; cells[1].text = v
        cells[0].paragraphs[0].runs[0].bold = True
    doc.add_page_break()
    doc.add_paragraph().add_run("Contents").bold = True
    field(doc.add_paragraph(), 'TOC \\o "1-3" \\h \\z \\u', "Right-click and choose Update Field to show page numbers.")
    st = doc.settings.element
    if st.find(qn("w:updateFields")) is None:
        uf = OxmlElement("w:updateFields"); uf.set(qn("w:val"), "true"); st.append(uf)
    doc.add_page_break()
    sec = doc.sections[0]
    sec.header.paragraphs[0].text = model["title"][:90]
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fp.add_run("Page "); field(fp, "PAGE", "1")
    n = 0
    for b in model["blocks"]:
        kind = b[0]
        if kind == "h":
            doc.add_heading(b[2], level=b[1])
        elif kind == "p":
            doc.add_paragraph(b[1])
        elif kind == "bullets":
            for x in b[1]:
                doc.add_paragraph(x, style="List Bullet")
        elif kind == "table":
            _, header, rows, caption = b
            n += 1
            cp = doc.add_paragraph(f"Table {n}. {caption}"); cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in cp.runs:
                run.font.size = Pt(9); run.italic = True
            tb = doc.add_table(rows=1, cols=len(header)); tb.style = "Light Grid Accent 1"
            for i, h in enumerate(header):
                tb.rows[0].cells[i].text = h
            for row in rows:
                cells = tb.add_row().cells
                for i, c in enumerate(row):
                    cells[i].text = str(c)
            doc.add_paragraph()
        elif kind == "bars":
            _, labels, values, caption = b
            peak = max(abs(v) for v in values) or 1
            tb = doc.add_table(rows=1, cols=3); tb.style = "Light Grid Accent 1"
            for i, h in enumerate(("Year", "Net cash flow", "Relative size")):
                tb.rows[0].cells[i].text = h
            for lab, v in zip(labels, values):
                cells = tb.add_row().cells
                cells[0].text = lab; cells[1].text = f"{v:,.0f}"; cells[2].text = "\u2588" * max(1, round(abs(v) / peak * 20))
            doc.add_paragraph(caption)
    buf = io.BytesIO(); doc.save(buf)
    return buf.getvalue()
