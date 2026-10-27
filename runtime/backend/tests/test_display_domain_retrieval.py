"""显示与口径：排放单位、本地向量、按日期回看仍由语料现算。"""
from app.services.emission_units import avoided_kg, avoided_wan_ton, kg_to_wan_ton
from app.services.embeddings_cn import embed_texts
from app.services.local_embeddings import cosine_sparse, ngram_vector
from app.services.retrieval_eval import evaluate, load_corpus, load_questions, vector_scores_for


def test_wan_ton_is_ten_million_kilograms():
    kg = avoided_kg(1_000_000)
    assert kg == 530_600
    assert kg_to_wan_ton(kg) == 0.05306
    assert avoided_wan_ton(1_000_000) == 0.05306
    assert kg / 1_000_000 != kg_to_wan_ton(kg)


def test_local_embedding_runs_without_a_key(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "local")
    monkeypatch.setenv("EMBEDDING_LOCAL_ENGINE", "ngram")
    result = embed_texts(["弃风率", "弃风电量除以应发电量"])
    assert result["status"] == "ok"
    assert result["model"] == "local-char-ngram"
    assert cosine_sparse(ngram_vector("弃风率怎么计算"), ngram_vector("弃风率等于弃风电量")) > 0
    assert cosine_sparse(ngram_vector("zzzz"), ngram_vector("光伏电站")) == 0


def test_vector_weight_is_applied_on_the_corpus(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "local")
    monkeypatch.setenv("EMBEDDING_LOCAL_ENGINE", "ngram")
    docs = load_corpus()
    questions = load_questions()
    scores = vector_scores_for(questions[0]["question"], docs)
    assert scores["applied"] is True
    report = evaluate(docs, questions)
    assert report["vector_weight_applied"] is True
    assert report["hardcoded"] is False
    assert 0 <= report["recall_at_8"] <= 1
    probe = evaluate(docs, [{
        "id": "Z000",
        "category": "policy",
        "question": "zzzz",
        "required_sources": [{"source_id": "policy-cn-136"}],
    }])
    assert probe["recall_at_8"] == 0
