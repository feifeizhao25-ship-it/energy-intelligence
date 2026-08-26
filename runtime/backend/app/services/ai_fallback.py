from typing import Optional, List, Dict, Union
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class AIFallbackService:
    """AI服务降级策略"""
    
    def __init__(self):
        self.providers = {
            'primary': ['dashscope'],  # 国内主用
            'fallback': ['openai'],    # 备用
            'local': ['ollama']        # 本地模型
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
