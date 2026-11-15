"""Growth kit wired into ops.seo.quality_gate behind SEO_PAGES_ENABLED (default OFF)."""
import pytest

from ops.seo import generate_pages, quality_gate
from ops.switches import SWITCHES

CLEAN = {"id": "p", "title": "江苏代理购电电价", "body": "方法与来源", "table": [["月份", "电价"]], "source_url": "https://example.gov/a"}
CLAIM = {**CLEAN, "id": "c", "body": "全网第一的电价查询工具"}


def test_flag_off_behaviour_is_unchanged(monkeypatch):
    monkeypatch.delenv("SEO_PAGES_ENABLED", raising=False)
    assert quality_gate(CLEAN) == []
    assert quality_gate(CLAIM) == []  # the kit scan is not applied while the flag is off


def test_flag_on_holds_claim_pages(monkeypatch):
    monkeypatch.setenv("SEO_PAGES_ENABLED", "1")
    assert quality_gate(CLEAN) == []
    assert "claim:absolute" in quality_gate(CLAIM)


def test_flag_on_keeps_existing_reasons(monkeypatch):
    monkeypatch.setenv("SEO_PAGES_ENABLED", "1")
    bad = {**CLAIM, "table": [], "source_url": ""}
    problems = quality_gate(bad)
    assert "missing unique data table" in problems and "missing source citation" in problems
    assert "claim:absolute" in problems


def test_generate_pages_still_needs_the_switch_and_the_flag(monkeypatch):
    monkeypatch.setenv("SEO_PAGES_ENABLED", "1")
    SWITCHES["seo_generate"] = False
    assert generate_pages([CLEAN])["generated"] == []  # seo_generate switch stays authoritative
    SWITCHES["seo_generate"] = True
    try:
        out = generate_pages([CLEAN, CLAIM])
    finally:
        SWITCHES["seo_generate"] = False
    assert [p["id"] for p in out["generated"]] == ["p"]
    assert out["rejected"][0]["id"] == "c"
