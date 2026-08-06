import json

import httpx
import pytest

from app.services.continuous_improvement import (
    ImprovementCandidate,
    ImprovementWorkflow,
)
from app.services.openrouter_client import (
    OpenRouterClient,
    OpenRouterConfigurationError,
    configured_models,
)


def test_model_list_is_ordered_and_configurable():
    assert configured_models("x-ai/grok-4.5, openai/gpt-5-mini") == [
        "x-ai/grok-4.5",
        "openai/gpt-5-mini",
    ]


def test_openrouter_requires_secret(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(OpenRouterConfigurationError):
        OpenRouterClient(models=["x-ai/grok-4.5"]).chat(
            [{"role": "user", "content": "test"}]
        )


def test_openrouter_sends_privacy_routing_without_leaking_key():
    seen = {}

    def handler(request):
        seen["authorization"] = request.headers["authorization"]
        seen["payload"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "ok"}}]},
        )

    result = OpenRouterClient(
        api_key="unit-test-secret",
        models=["x-ai/grok-4.5", "openai/gpt-5-mini"],
        transport=httpx.MockTransport(handler),
    ).chat([{"role": "user", "content": "test"}])
    assert result["choices"][0]["message"]["content"] == "ok"
    assert seen["authorization"] == "Bearer unit-test-secret"
    assert seen["payload"]["provider"]["data_collection"] == "deny"
    assert seen["payload"]["provider"]["zdr"] is True
    assert "unit-test-secret" not in json.dumps(seen["payload"])


def test_improvement_requires_evaluation_and_human_approval():
    flow = ImprovementWorkflow()
    item = ImprovementCandidate("candidate-1", "https://example.test")
    item = flow.transition(item, "license_checked")
    item = flow.transition(item, "quarantined")
    item = flow.transition(
        item, "evaluated", evidence_score=0.91, safety_score=0.93
    )
    with pytest.raises(PermissionError):
        flow.transition(item, "approved")
    approved = flow.transition(item, "approved", actor="reviewer@example.test")
    assert approved.approved_by == "reviewer@example.test"
    assert flow.transition(approved, "published").state == "published"


def test_low_score_candidate_cannot_publish():
    flow = ImprovementWorkflow()
    item = ImprovementCandidate(
        "candidate-2",
        "https://example.test",
        state="evaluated",
        evidence_score=0.84,
        safety_score=0.99,
    )
    with pytest.raises(ValueError, match="0.85"):
        flow.transition(item, "approved", actor="reviewer")
