/** 2026-11-23 真模型复测：套餐默认 deepseek-v3 经后端发给 DeepSeek 官方接口会 400。 */
import { AI_MODEL_TIERS, getDefaultModel } from './plans';

describe('套餐默认模型', () => {
    it('没有套餐默认用 deepseek-v3 / deepseek-chat', () => {
        for (const tier of Object.values(AI_MODEL_TIERS)) {
            expect(['deepseek-v3', 'deepseek-chat']).not.toContain(tier.defaultModel);
            expect(tier.allowedModels as readonly string[]).toContain(tier.defaultModel);
            expect(tier.allowedModels as readonly string[]).not.toContain('deepseek-v3');
        }
    });
    it('高级套餐默认 deepseek-flash', () => {
        expect(getDefaultModel('FULL' as never)).toBe('deepseek-flash');
        expect(getDefaultModel('ENTERPRISE' as never)).toBe('deepseek-flash');
    });
});
