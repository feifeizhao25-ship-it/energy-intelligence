from typing import Optional, List, Dict, Union
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class AIFallbackService:
    """AI服务降级策略"""
    
    def __init__(self):
        if (settings.APP_EDITION or "").lower() == "cn":
            # 国内编排只走深度求索、百炼和智谱。OpenAI 不在这条链上。
            self.providers = {
                'primary': ['deepseek'],
                'fallback': ['dashscope', 'glm'],
                'local': [],
            }
        else:
            self.providers = {
                'primary': ['dashscope'],
                'fallback': ['openai'],
                'local': ['ollama'],
            }
    
    async def chat_with_fallback(
        self,
        messages: List[dict],
        preferred_provider: str = None
    ) -> dict:
        """带降级的AI对话"""
        
        providers_to_try = []
        
        # 根据市场选择提供商
        if preferred_provider:
            providers_to_try.append(preferred_provider)
        
        # 添加其他提供商
        for tier in ['primary', 'fallback', 'local']:
            for provider in self.providers[tier]:
                if provider not in providers_to_try:
                    providers_to_try.append(provider)
        
        last_error = None
        
        for provider in providers_to_try:
            try:
                result = await self._call_provider(provider, messages)
                return {
                    'success': True,
                    'provider': provider,
                    'content': result
                }
            except Exception as e:
                last_error = e
                continue
        
        # 所有提供商都失败
        return {
            'success': False,
            'error': str(last_error),
            'fallback_response': self._get_static_fallback_response(messages)
        }
    
    async def _call_provider(self, provider: str, messages: List[dict]) -> str:
        """调用特定提供商"""
        if (settings.APP_EDITION or "").lower() == "cn" and provider in {"openai", "anthropic", "openrouter", "ollama"}:
            raise RuntimeError("overseas provider disabled in cn edition")
        if provider in {"deepseek", "dashscope", "glm"} and (settings.APP_EDITION or "").lower() == "cn":
            return await self._call_domestic(provider, messages)
        if provider == 'dashscope':
            from app.services.ai.dashscope import DashScopeService
            service = DashScopeService()
            return await service.chat(messages)
        
        elif provider == 'openai':
            from app.services.ai.openai import OpenAIService
            service = OpenAIService()
            return await service.chat(messages)
        
        elif provider == 'ollama':
            from app.services.ai.ollama import OllamaService
            service = OllamaService()
            return await service.chat(messages)
        
        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def _call_domestic(self, provider: str, messages: List[dict]) -> str:
        """国内兼容 OpenAI 协议的三家。没有密钥或端点落在境外主机时直接失败，不改道。"""
        from urllib.parse import urlparse
        from openai import AsyncOpenAI

        spec = {
            "deepseek": (settings.DEEPSEEK_API_KEY, settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL),
            "dashscope": (settings.DASHSCOPE_API_KEY, settings.DASHSCOPE_BASE_URL, settings.DASHSCOPE_MODEL),
            "glm": (settings.GLM_API_KEY, settings.GLM_BASE_URL, settings.GLM_MODEL),
        }
        key, base, model = spec[provider]
        host = (urlparse(base).hostname or "").lower()
        blocked = ("api.openai.com", "openrouter.ai", "api.anthropic.com", "api.moonshot.ai", "sentry.io")
        if host in blocked or host.endswith(".openai.com"):
            raise RuntimeError("overseas host blocked")
        if not key:
            raise RuntimeError(f"{provider} api key missing")
        client = AsyncOpenAI(api_key=key, base_url=base)
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
        )
        return response.choices[0].message.content or ""
    
    def _get_static_fallback_response(self, messages: List[dict]) -> str:
        """获取静态降级回复"""
        # 分析用户意图，返回预设回复
        last_message = messages[-1].get('content', '').lower()
        
        if 'irr' in last_message or '收益率' in last_message:
            return "抱歉，AI服务暂时不可用。关于IRR计算，请确保输入正确的现金流数据。您可以稍后再试。"
        
        if 'lcoe' in last_message or '度电成本' in last_message:
            return "抱歉，AI服务暂时不可用。LCOE计算需要CAPEX、OPEX和发电量数据。请稍后重试。"
        
        return "抱歉，AI服务暂时不可用，请稍后再试。您也可以查看帮助文档获取更多信息。"
    
    async def skill_execute_with_fallback(
        self,
        skill_id: str,
        params: dict
    ) -> dict:
        """带降级的Skill执行"""
        try:
            # 尝试正常执行
            result = await self._execute_skill(skill_id, params)
            return {'success': True, 'result': result}
        except Exception as e:
            if settings.ENVIRONMENT == "production":
                return {
                    "success": False,
                    "error": str(e),
                    "warning": "Skill execution failed; no synthetic result was generated.",
                }
            fallback_result = await self._get_skill_fallback(skill_id, params)
            return {
                'success': False,
                'degraded': True,
                'result': fallback_result,
                'warning': '开发环境降级占位值，不可作为专业结论'
            }
    
    async def _execute_skill(self, skill_id: str, params: dict) -> dict:
        """执行Skill — 调用技能注册表"""
        import skills
        return skills.execute_skill(skill_id, params=params)
    
    async def _get_skill_fallback(self, skill_id: str, params: dict) -> dict:
        """获取Skill降级结果"""
        # 简化计算或返回默认值
        if skill_id.startswith('financial.'):
            return {'value': 0, 'note': '服务降级中'}
        
        if skill_id.startswith('resource.'):
            return {'value': 0, 'note': '服务降级中'}
        
        return {'note': '服务降级中'}


# 使用示例
ai_fallback = AIFallbackService()
