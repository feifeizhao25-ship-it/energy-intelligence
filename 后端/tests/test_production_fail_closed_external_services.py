import asyncio
import importlib.util
import os
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(autouse=True)
def production_environment(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("FAL_KEY", raising=False)
    monkeypatch.delenv("YOUTUBE_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("GROK_API_KEY", raising=False)


def test_multimodal_and_video_skills_never_return_synthetic_production_results():
    module = _load_module(
        "production_v31_skills",
        PROJECT_ROOT / "services/ai-engine/app/skills/v31_new_skills.py",
    )
    image = asyncio.run(module.ImageRecognizeSkill().execute({"image_url": "https://invalid"}))
    video = asyncio.run(
        module.VideoSummarizerSkill().execute({"url": "https://youtu.be/dQw4w9WgXcQ"})
    )
    translation = asyncio.run(
        module.TranslatorSkill().execute({"text": "光伏", "target_lang": "en"})
    )

    for result in (image, video, translation):
        assert result["success"] is False
        assert result["status"] == "unavailable"
        assert result["error_code"] == "DEPENDENCY_NOT_CONFIGURED"
        assert "synthetic result was generated" in result["message"]


def test_knowledge_mock_loader_is_disabled_in_production():
    module = _load_module(
        "production_knowledge_skills",
        PROJECT_ROOT / "services/knowledge-service/app/skills/knowledge_management.py",
    )
    with pytest.raises(RuntimeError, match="synthetic fallback is disabled"):
        module._get_mock_data("policies")
