"""2026-11-01 (phase 3): multi-country global candidates + the primary-source upgrade of en-intl-s03.
Offline and deterministic. Candidates stay 'Pending review' and invisible; nothing here approves anything."""
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from app.library import store
from app.self_improve import bm25 as H
from app.self_improve import promote_gate as PG
from app.self_improve.sources import SourcePolicy

TODAY = date(2026, 11, 1)
FIX = Path(__file__).parent / "fixtures" / "en_global_heldout.json"
NEW = [f"en-intl-s{n:02d}" for n in range(4, 12)]
CJK = re.compile(r"[\u3400-\u9fff]")


def staged():
    return {e["id"]: e for e in store.load_staged("global")}


def policy():
    src = json.loads((Path(store.HERE) / "data" / "sources.json").read_text("utf-8"))
    return SourcePolicy(allowed_domains=tuple(src["extra_allowed_domains"]))


def test_all_global_staged_pass_the_gate_and_countries_are_covered():
    st = staged()
    assert set(NEW) <= set(st)
    rep = PG.evaluate_all(list(st.values()), store.load_document("global")["entries"], today=TODAY, lang="en", domain_ok=policy().domain_ok)
    verdict = {r["id"]: r["decision"] for r in rep["rows"]}
    assert all(v == "keep" for v in verdict.values()), verdict
    tags = {t for i in NEW for t in st[i]["tags"]}
    assert {"United States", "United Kingdom", "European Union", "Germany", "Australia", "Japan", "India", "Netherlands"} <= tags


def test_sources_are_official_english_and_pending():
    pol = policy()
    for i, e in staged().items():
        if i not in NEW and i != "en-intl-s03":
            continue
        s = e["source"]
        assert s["url"].startswith("https://") and pol.domain_ok(urlparse(s["url"]).hostname), i
        assert s["tier"] == "A" and s["read_via"] and s["read_scope"] and s["publisher"], i
        assert e["review_status"] == "Pending review" and e["retrieved_at"] == "2026-11-01", i
        assert not CJK.search(json.dumps(e, ensure_ascii=False)), i
        assert e["caution"] and len(e["probes"]) >= 3, i
    visible = {e["id"] for e in store.annotated("global", TODAY, include_hidden=True)}
    assert not visible & set(staged())


def test_s03_now_rests_on_the_court_opinion_itself():
    e = staged()["en-intl-s03"]
    s = e["source"]
    assert urlparse(s["url"]).hostname == "storage.courtlistener.com" and "287847.50.0.pdf" in s["url"]
    assert "ECF No. 50" in s["doc_no"] and "57 pages" in s["title"] and s["tier"] == "A"
    assert e["second_source"]["publisher"].startswith("McGuireWoods") and "second_source_needed" not in e
    text = json.dumps(e)
    assert "vacate" in text and "remand" in text and "4 July 2026" in text and "HUC and OPC" in text
    assert e["status"] == "Contested" and "docket" in e["status_note"]
    assert "law-firm reports" not in text  # the claim no longer rests on the alert


def test_key_figures_are_pinned_to_what_was_read():
    st = staged()
    assert "86 GW" in st["en-intl-s04"]["summary"] and "43.4 GW solar (51%)" in st["en-intl-s04"]["points"][0]
    assert "above zero" in st["en-intl-s05"]["summary"]
    assert "42.5%" in st["en-intl-s06"]["title"] and "2023/2413" in st["en-intl-s06"]["summary"]
    assert "60%" in st["en-intl-s07"]["points"][0] and "25 kW" in st["en-intl-s07"]["points"][0] and "2 kW" in st["en-intl-s07"]["points"][1]
    assert "14 kWh" in st["en-intl-s08"]["points"][2] and "6.8" in st["en-intl-s08"]["points"][1]
    assert "22.9%" in st["en-intl-s09"]["points"][1] and "40-50%" in st["en-intl-s09"]["summary"]
    assert "Rs 78,000" in st["en-intl-s10"]["title"] and "75,021" in st["en-intl-s10"]["points"][3]
    assert "1 January 2027" in st["en-intl-s11"]["title"] and "50%" in st["en-intl-s11"]["points"][2]
    # Japan's entry carries an open request for the METI original; the German entry must not state commissioning dates it did not read
    assert "METI / ANRE" in st["en-intl-s09"]["second_source_needed"]
    assert "not stated here" in st["en-intl-s07"]["status_note"]


def test_heldout_retrieval_ratchet_over_working_plus_staged():
    docs = store.load_document("global")["entries"] + store.load_staged("global")
    ids = [e["id"] for e in docs]
    idx = H.BM25Index([PG._index_text(e) for e in docs], "en")
    queries = json.loads(FIX.read_text("utf-8"))["queries"]
    n = r1 = r3 = 0
    mrr = 0.0
    for target, qs in queries.items():
        for q in qs:
            res = [ids[i] for i, _ in idx.query(q, top_k=10)]
            rank = res.index(target) + 1 if target in res else None
            n += 1
            r1 += rank == 1
            r3 += bool(rank and rank <= 3)
            mrr += 1 / rank if rank else 0
    assert n == 18
    assert r3 / n == 1.0 and r1 / n >= 0.85 and mrr / n >= 0.9  # measured: R@3 1.00, R@1 0.889, MRR 0.935
