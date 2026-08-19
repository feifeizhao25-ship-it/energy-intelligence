"""UI 故事板渲染端点（演示专用）。

用与 personalization_v2 引擎完全相同的数据渲染真实 HTML（内联 CSS），
供 5 人设 × 7 天演化故事板截图使用。全部内容来自引擎的演示数据，
页面上明示演示标注；未知人设/非法天数返回 404，绝不编造内容。
"""

from __future__ import annotations

import html

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.services.personalization_v2 import (
    PersonalizationEngine,
    _STAGE_LABELS,
    _STAGE_SEQUENCE,
)

router = APIRouter()

_engine = PersonalizationEngine()

_CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "Segoe UI", sans-serif;
  background: #f2f5f0; color: #1e2a1e; padding: 28px;
  -webkit-font-smoothing: antialiased;
}
.frame { max-width: 860px; margin: 0 auto; }
.topbar { display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px; }
.identity { font-size: 14px; color: #5a6b5a; }
.identity strong { color: #1e2a1e; font-size: 16px; }
.demo-badge { background: #fff4e0; color: #9a6b00; border: 1px solid #f0d9a8;
  border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 600; }
.stage-track { display: flex; gap: 6px; margin-bottom: 18px; }
.stage-step { flex: 1; text-align: center; font-size: 11px; padding: 6px 2px;
  border-radius: 8px; background: #e4eae2; color: #7a8a7a; }
.stage-step.done { background: #cfe3cf; color: #2f5d33; }
.stage-step.now { background: #2f7d3b; color: #ffffff; font-weight: 700; }
.hero { background: linear-gradient(135deg, #1f5c2e 0%, #2f7d3b 100%);
  color: #ffffff; border-radius: 18px; padding: 28px 30px; margin-bottom: 18px;
  box-shadow: 0 8px 24px rgba(31, 92, 46, .22); }
.hero .day-tag { font-size: 13px; opacity: .82; margin-bottom: 10px; }
.hero h1 { font-size: 24px; line-height: 1.35; margin-bottom: 10px;
  font-weight: 700; }
.hero p.sub { font-size: 14px; line-height: 1.7; opacity: .92;
  margin-bottom: 18px; }
.hero .next-action { display: inline-block; background: #ffffff;
  color: #1f5c2e; font-size: 14px; font-weight: 700; border-radius: 10px;
  padding: 9px 18px; text-decoration: none; }
.hero .evidence { margin-top: 14px; font-size: 12px; opacity: .72; }
.section-title { font-size: 13px; font-weight: 700; color: #5a6b5a;
  letter-spacing: .08em; margin: 6px 2px 10px; }
.widgets { display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; margin-bottom: 18px; }
.widget { background: #ffffff; border: 1px solid #dfe7dc; border-radius: 14px;
  padding: 16px; position: relative; }
.widget .prio { position: absolute; top: 12px; right: 14px; font-size: 11px;
  color: #9db09b; font-weight: 700; }
.widget h3 { font-size: 15px; margin-bottom: 8px; color: #1f5c2e; }
.widget p { font-size: 12.5px; line-height: 1.6; color: #5a6b5a; }
.widget .bar { height: 6px; border-radius: 3px; background: #e9f0e7;
  margin-top: 12px; overflow: hidden; }
.widget .bar i { display: block; height: 100%; background: #58a45f; }
.reco { background: #ffffff; border: 1px dashed #b9cbb6; border-radius: 14px;
  padding: 18px 20px; }
.reco h3 { font-size: 15px; color: #1f5c2e; margin-bottom: 10px; }
.reco ul { list-style: none; }
.reco li { font-size: 13.5px; padding: 7px 0; color: #33413a;
  border-bottom: 1px solid #eef3ec; }
.reco li:last-child { border-bottom: none; }
.reco li a { color: #2f7d3b; text-decoration: none; font-weight: 600; }
.reco .evidence { margin-top: 10px; font-size: 11.5px; color: #9aa89a; }
"""


def _esc(value: object) -> str:
    return html.escape(str(value))


def _render_layout(layout: dict) -> str:
    hero = layout["hero"]
    day = layout["day"]
    lang = "cn" if layout["market"] == "cn" else "en"
    locale = "zh-CN" if lang == "cn" else "en"

    steps = []
    seen_now = False
    for idx, stage in enumerate(dict.fromkeys(_STAGE_SEQUENCE), start=0):
        label = _STAGE_LABELS[stage][lang]
        if stage == hero["day_stage"] and not seen_now:
            cls = "now"
            seen_now = True
        elif not seen_now:
            cls = "done"
        else:
            cls = ""
        steps.append(f'<div class="stage-step {cls}">{_esc(label)}</div>')

    widgets = []
    for order, widget in enumerate(layout["widgets"]):
        width = 72 - order * 14  # 纯装饰进度条，示意组件占位
        widgets.append(
            '<div class="widget">'
            f'<span class="prio">P{widget["priority"]}</span>'
            f'<h3>{_esc(widget["title"])}</h3>'
            f'<p>{_esc(widget["summary"])}</p>'
            f'<div class="bar"><i style="width:{width}%"></i></div>'
            "</div>"
        )

    reco = layout["recommendation"]
    reco_items = "".join(
        f'<li><a href="{_esc(item["href"])}">{_esc(item["title"])}</a></li>'
        for item in reco["items"]
    )

    next_action = hero["next_action"]
    return f"""<!DOCTYPE html>
<html lang="{locale}">
<head>
<meta charset="utf-8">
<title>{_esc(hero["title"])}</title>
<style>{_CSS}</style>
</head>
<body>
<div class="frame">
  <div class="topbar">
    <div class="identity"><strong>{_esc(layout["display_name"])}</strong>
      · {_esc(layout["persona_id"])} · day {day}/7</div>
    <div class="demo-badge">{_esc(hero["evidence_note"])}</div>
  </div>
  <div class="stage-track">{"".join(steps)}</div>
  <div class="hero">
    <div class="day-tag">{_esc(hero["title"])}</div>
    <h1>{_esc(hero["headline"])}</h1>
    <p class="sub">{_esc(hero["subtext"])}</p>
    <a class="next-action" href="{_esc(next_action["href"])}">{_esc(next_action["label"])} →</a>
    <div class="evidence">evidence_status: {_esc(hero["evidence_status"])}</div>
  </div>
  <div class="section-title">WIDGETS · 按人设优先级排序 / ORDERED BY PERSONA PRIORITY</div>
  <div class="widgets">{"".join(widgets)}</div>
  <div class="reco">
    <h3>{_esc(reco["title"])}</h3>
    <ul>{reco_items}</ul>
    <div class="evidence">evidence_status: {_esc(reco["evidence_status"])} · {_esc(hero["evidence_note"])}</div>
  </div>
</div>
</body>
</html>"""


@router.get("/storyboard/{persona_id}/{day}", response_class=HTMLResponse)
def storyboard_page(persona_id: str, day: int) -> HTMLResponse:
    layout = _engine.get_daily_layout(persona_id, day)
    if layout is None:
        raise HTTPException(status_code=404, detail="unknown persona or day")
    return HTMLResponse(_render_layout(layout))
