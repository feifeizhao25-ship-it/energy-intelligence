import { BANNED_OVERSEAS, presentOverseas } from './banned-overseas';

describe('海外变量名单', () => {
    it('覆盖文献与支付供应商，不误伤国内模型', () => {
        expect(BANNED_OVERSEAS).toEqual(expect.arrayContaining(['OPENAI_API_KEY', 'CORE_API_KEY', 'OPENALEX_CONTACT_EMAIL', 'OPENROUTER_API_KEY']));
        expect(BANNED_OVERSEAS).not.toEqual(expect.arrayContaining(['DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY']));
        expect(presentOverseas({ OPENAI_API_KEY: '', CORE_API_KEY: 'x' })).toEqual(['CORE_API_KEY']);
    });
});
