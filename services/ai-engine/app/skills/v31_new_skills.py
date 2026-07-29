"""v3.1 AI-engine skills: translation, multimodal analysis, transcripts.

Each skill calls a real upstream adapter. When the adapter is not configured,
non-production environments return an explicit placeholder; production
returns an unavailable response stating that no synthetic result was
generated, so fabricated output can never be presented as real analysis.
"""

import os
from typing import Any


def _production_mode() -> bool:
    return os.getenv("ENVIRONMENT", "").lower() == "production"


def _unavailable(skill_id: str, adapter: str) -> dict[str, Any]:
    return {
        "skill": skill_id,
        "status": "unavailable",
        "adapter": adapter,
        "result": None,
        "message": (
            f"The {adapter} is not configured. "
            "No synthetic result was generated."
        ),
    }


def _placeholder(skill_id: str, payload: Any) -> dict[str, Any]:
    return {
        "skill": skill_id,
        "status": "placeholder",
        "result": payload,
        "message": "development placeholder; not a real model result",
    }


class TranslationSkill:
    skill_id: str = "translation"

    def run(self, text: str, target_language: str = "en") -> dict[str, Any]:
        endpoint = os.getenv("TRANSLATION_ENDPOINT")
        if not endpoint:
            if _production_mode():
                return _unavailable(self.skill_id, "production translation adapter")
            return _placeholder(self.skill_id, {"text": text, "lang": target_language})
        return self._call(endpoint, {"text": text, "target": target_language})

    def _call(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        return _invoke_adapter(self.skill_id, endpoint, payload)


class MultimodalSkill:
    skill_id: str = "multimodal_analysis"

    def run(self, image_url: str, prompt: str) -> dict[str, Any]:
        endpoint = os.getenv("MULTIMODAL_ENDPOINT")
        if not endpoint:
            if _production_mode():
                return _unavailable(self.skill_id, "production multimodal adapter")
            return _placeholder(self.skill_id, {"image_url": image_url})
        return _invoke_adapter(
            self.skill_id, endpoint, {"image_url": image_url, "prompt": prompt}
        )


class TranscriptSummarySkill:
    skill_id: str = "transcript_summary"

    def run(self, audio_url: str) -> dict[str, Any]:
        endpoint = os.getenv("TRANSCRIPT_ENDPOINT")
        if not endpoint:
            if _production_mode():
                return _unavailable(self.skill_id, "production transcript and summarization adapter")
            return _placeholder(self.skill_id, {"audio_url": audio_url})
        return _invoke_adapter(self.skill_id, endpoint, {"audio_url": audio_url})


def _invoke_adapter(
    skill_id: str, endpoint: str, payload: dict[str, Any]
) -> dict[str, Any]:
    import json
    import urllib.request

    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        result = json.loads(response.read().decode("utf-8"))
    return {"skill": skill_id, "status": "ok", "result": result}


SKILLS = [TranslationSkill(), MultimodalSkill(), TranscriptSummarySkill()]


# ── V3.1 新版技能接口（async execute 契约）──────────────────────────────────
def _is_production() -> bool:
    return (
        os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or ""
    ).lower() == "production"


def _fail_closed(skill_id: str, dependency: str) -> dict:
    return {
        "skill": skill_id,
        "success": False,
        "status": "unavailable",
        "error_code": "DEPENDENCY_NOT_CONFIGURED",
        "result": None,
        "message": (
            f"The {dependency} dependency is not configured. "
            "No synthetic result was generated."
        ),
    }


class TranslatorSkill:
    """真实翻译适配器；未配置时生产环境 fail-closed，绝不返回合成译文。"""

    skill_id = "translator"

    async def execute(self, params: dict) -> dict:
        endpoint = os.getenv("TRANSLATION_ENDPOINT")
        if not endpoint:
            if _is_production():
                return _fail_closed(self.skill_id, "translation provider")
            return _placeholder(self.skill_id, {"text": params.get("text", "")})
        return _invoke_adapter(self.skill_id, endpoint, params)


class ImageRecognizeSkill:
    """真实图像识别适配器；未配置时生产环境 fail-closed。"""

    skill_id = "image_recognize"

    async def execute(self, params: dict) -> dict:
        endpoint = os.getenv("IMAGE_RECOGNITION_ENDPOINT")
        if not endpoint:
            if _is_production():
                return _fail_closed(self.skill_id, "image recognition provider")
            return _placeholder(self.skill_id, {"image_url": params.get("image_url", "")})
        return _invoke_adapter(self.skill_id, endpoint, params)


class VideoSummarizerSkill:
    """真实视频摘要适配器；未配置时生产环境 fail-closed。"""

    skill_id = "video_summarizer"

    async def execute(self, params: dict) -> dict:
        endpoint = os.getenv("VIDEO_SUMMARY_ENDPOINT")
        if not endpoint:
            if _is_production():
                return _fail_closed(self.skill_id, "video summarization provider")
            return _placeholder(self.skill_id, {"url": params.get("url", "")})
        return _invoke_adapter(self.skill_id, endpoint, params)


SKILLS = SKILLS + [TranslatorSkill(), ImageRecognizeSkill(), VideoSummarizerSkill()]
