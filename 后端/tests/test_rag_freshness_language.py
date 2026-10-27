"""RAG provenance, freshness and market-language quality gates."""

import re
from datetime import date

from app.services.rag_service import RAGService


def test_rag_hits_expose_honest_freshness_metadata():
    hits = RAGService().search(
        "2026 distributed solar interconnection standard",
        top_k=5,
        market="global",
    ).hits
    assert hits
    for hit in hits:
        assert isinstance(hit.metadata.get("year"), int)
        assert hit.metadata.get("freshness_status") in {
            "current",
            "review_recommended",
            "stale",
        }
        assert "last_verified_at" in hit.metadata


def test_global_rag_context_does_not_contain_untranslated_chinese():
    # Deterministic reviewed fixtures: registry scope coverage is a separate gate.
    corpus = [dict(source_id=lang, lang=lang, title=title,
                   content='solar grid interconnection', year=2026,
                   last_verified_at=date.today().isoformat(),
                   applicability={'status':'reviewed','countries':['us']})
              for lang, title in [('cn','光伏并网'),('en','Solar interconnection')]]
    hits = RAGService(corpus=corpus).search(
        "solar grid interconnection tax incentive United States",
        top_k=8,
        market="global",
    ).hits
    assert hits
    leaked = [
        hit.source_id
        for hit in hits
        if re.search(r"[\u4e00-\u9fff]", hit.title + hit.content)
    ]
    assert leaked == []
