import { callDomesticBackend, normalizeToolCalls } from './router';
import { stripLeakedModelTags } from './leaked-tags';

const tools = [{ type: 'function', function: { name: 'query_knowledge_base', parameters: { type: 'object' } } }];

describe('CN 专业助手带工具的往返（2026-11-21 实测回归）', () => {
    const original = global.fetch;
    beforeEach(() => {
        process.env.BACKEND_INTERNAL_URL = 'http://backend.test';
        process.env.NENGJIAN_INTERNAL_TOKEN = 'fixture';
        global.fetch = jest.fn();
    });
    afterEach(() => { global.fetch = original; delete process.env.BACKEND_INTERNAL_URL; delete process.env.NENGJIAN_INTERNAL_TOKEN; });

    it('透传 tools/tool_choice，并把 tool_calls 还原给 agent（空正文不等于失败）', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ content: '', model: 'deepseek-flash', provider: 'deepseek', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'query_knowledge_base', arguments: '{"query":"GB50797"}' } }] }) });
        const res = await callDomesticBackend({ messages: [{ role: 'user', content: 'GB50797？' }], tools, tool_choice: 'auto' });
        expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({ tools, tool_choice: 'auto' });
        expect(res.choices[0].message.tool_calls?.[0].id).toBe('c1');
        expect(res.choices[0].finish_reason).toBe('tool_calls');
    });
    it('带工具结果回来的消息不被改写；正文里的 ds_* 成对内容被滤掉', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ content: '根据检索原文，要求如下 [S1]。\n<ds_safety>内部分析</ds_safety><ds_tool>假调用</ds_tool>', model: 'deepseek-flash', provider: 'deepseek' }) });
        const messages = [{ role: 'tool', tool_call_id: 'c1', content: '[S1] GB50797-2012' }];
        const res = await callDomesticBackend({ messages, tools, tool_choice: 'auto' });
        expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).messages).toEqual(messages);
        expect(res.choices[0].message.content).toBe('根据检索原文，要求如下 [S1]。');
    });
    it('没有工具的调用保持原样（请求体里没有 tools）', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ content: '正文', model: 'm' }) });
        const res = await callDomesticBackend({ messages: [{ role: 'user', content: '你好' }] });
        expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).tools).toBeUndefined();
        expect(res.choices[0].message.content).toBe('正文');
    });
});

test('tool_calls 的参数统一为字符串，缺函数名的丢掉', () => {
    expect(normalizeToolCalls([{}, { id: 'x', function: { name: 'q', arguments: { x: 1 } } }])).toEqual([{ id: 'x', type: 'function', function: { name: 'q', arguments: '{"x":1}' } }]);
});
test.each([
    ['正常文本 [S1]。', '正常文本 [S1]。'],
    ['前言。<ds_safety>内部\n内容</ds_safety>结论。', '前言。结论。'],
    ['前言。<ds_tool>未关闭内部内容', '前言。'],
    ['结论。</ds_tool>', '结论。'],
])('不展示模型内部伪标签：%s', (input, expected) => expect(stripLeakedModelTags(input)).toBe(expected));
