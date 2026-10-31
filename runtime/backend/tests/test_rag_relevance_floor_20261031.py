"""Sources attached to an answer must be relevant: weak word-overlap matches are dropped, strong ones are kept."""

import pytest

from app.api.v1 import ai_assistant as aa


class _Hit:
    def __init__(self, score, title="t"):
        self.score = score
        self.title = title
        self.metadata = {}
        self.content = "c"


class _Result:
    def __init__(self, hits):
        self.hits = hits


def _patch(monkeypatch, hits):
    monkeypatch.setattr(aa._RAG_SERVICE, "search", lambda *a, **k: _Result(hits))


def test_weak_matches_are_dropped(monkeypatch):
    _patch(monkeypatch, [_Hit(0.31), _Hit(0.14)])
    assert aa._retrieve("苹果手机多少钱", "cn") == []


def test_strong_matches_are_kept_in_order(monkeypatch):
    _patch(monkeypatch, [_Hit(1.0, "a"), _Hit(0.62, "b"), _Hit(0.2, "c")])
    assert [h.title for h in aa._retrieve("q", "global")] == ["a", "b"]


def test_floor_boundary(monkeypatch):
    _patch(monkeypatch, [_Hit(aa.MIN_SOURCE_RELEVANCE), _Hit(aa.MIN_SOURCE_RELEVANCE - 0.01)])
    assert len(aa._retrieve("q", "cn")) == 1


@pytest.mark.parametrize("market,phrase", [("cn", "本库尚未收录"), ("global", "no matching document")])
def test_no_hits_tells_the_model_not_to_cite(market, phrase):
    prompt = aa._grounded_prompt("base", [], market)
    assert phrase in prompt


def test_real_library_unrelated_question_has_no_sources():
    assert aa._retrieve("苹果手机多少钱", "cn") == []
    assert aa._retrieve("North Sea offshore wind LCOE vs onshore", "global") == []


def test_real_library_related_question_keeps_the_right_source():
    hits = aa._retrieve("IEEE 1547 interconnection", "global")
    assert hits and "1547" in hits[0].title
    obbba = aa._retrieve("What is the OBBBA ITC phase-out for solar", "global")
    assert obbba and "tax credit" in obbba[0].title.lower()


def test_scrub_removes_markers_without_a_retrieved_source():
    assert aa._scrub_citations("A [S1] and B [S3].", 2) == "A [S1] and B."
    assert aa._scrub_citations("A [S1].", 0) == "A."
    assert aa._scrub_citations("A [S1][S2].", 2) == "A [S1][S2]."
    assert aa._scrub_citations("", 3) == ""
