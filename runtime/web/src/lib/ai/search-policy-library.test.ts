/** 2026-11-23 真模型复测：网页专业助手只有「用户上传文档」检索，问 688 号文说知识库没有、问容量电价凭记忆给数字。
 *  现在国内专业助手多一个 search_policy_library，走后端资料库检索。fetch 全部 mock。 */
import { searchPolicyLibrary } from './tool-executor';
import { cnOnlyAssistantToolDefinitions } from '@/lib/assistant/tools';
import { modelToolNames } from './tool-catalog';

const saved = { base: process.env.BACKEND_INTERNAL_URL, token: process.env.NENGJIAN_INTERNAL_TOKEN };
const realFetch = global.fetch;
afterEach(() => {
    global.fetch = realFetch;
    if (saved.base === undefined) delete process.env.BACKEND_INTERNAL_URL; else process.env.BACKEND_INTERNAL_URL = saved.base;
    if (saved.token === undefined) delete process.env.NENGJIAN_INTERNAL_TOKEN; else process.env.NENGJIAN_INTERNAL_TOKEN = saved.token;
});

describe('search_policy_library', () => {
    it('只给国内专业助手', () => {
        expect(modelToolNames('cn', 'assistant')).toContain('search_policy_library');
        expect(modelToolNames('global', 'assistant')).not.toContain('search_policy_library');
        expect(cnOnlyAssistantToolDefinitions[0].function.description).toContain('必须先调用');
    });

    it('命中时给编号上下文和来源，带内部令牌调后端', async () => {
        process.env.BACKEND_INTERNAL_URL = 'http://backend.test/';
        process.env.NENGJIAN_INTERNAL_TOKEN = 'tok';
        const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ sources: [
            { ref: 'S1', title: '关于完善发电侧容量电价机制的通知（发改价格〔2026〕114号）', source_org: '国家发展改革委', dates: '发文日期：2026-01-30', url: 'https://www.ndrc.gov.cn/x', content: '煤电容量电价回收固定成本比例……' },
        ] }) }));
        global.fetch = fetchMock as unknown as typeof fetch;
        const out = await searchPolicyLibrary('发电侧容量电价现在是怎么定的？') as any;
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('http://backend.test/api/v1/ai/library-search');
        expect((init.headers as Record<string, string>)['X-Internal-Token']).toBe('tok');
        expect(out.count).toBe(1);
        expect(out.context).toMatch(/^\[S1\] 关于完善发电侧容量电价机制的通知/);
        expect(out.sources[0]).toMatchObject({ ref: 'S1', url: 'https://www.ndrc.gov.cn/x', source_org: '国家发展改革委' });
    });

    it('没命中时明确要求说未收录；后端不可用时不让模型凭记忆答', async () => {
        process.env.BACKEND_INTERNAL_URL = 'http://backend.test';
        process.env.NENGJIAN_INTERNAL_TOKEN = 'tok';
        global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ sources: [] }) })) as unknown as typeof fetch;
        const empty = await searchPolicyLibrary('日本FIT 2026年太阳能收购价格') as any;
        expect(empty.count).toBe(0);
        expect(empty.context).toContain('本库尚未收录');
        global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
        const down = await searchPolicyLibrary('688号文') as any;
        expect(down.success).toBe(false);
        expect(down.error).toContain('不要凭记忆');
    });
});
