jest.mock('./tools', () => ({ AI_TOOLS: [] }));
jest.mock('./tool-executor', () => ({ executeTool: jest.fn() }));
const priorKey = process.env.SILICONFLOW_API_KEY;
const priorUrl = process.env.SILICONFLOW_BASE_URL;
let service: typeof import('./qianwen');
beforeAll(() => { process.env.SILICONFLOW_API_KEY = 'test-only-key'; service = require('./qianwen'); });
afterEach(() => { jest.restoreAllMocks(); delete process.env.SILICONFLOW_BASE_URL; });
afterAll(() => {
    if (priorKey === undefined) delete process.env.SILICONFLOW_API_KEY; else process.env.SILICONFLOW_API_KEY = priorKey;
    if (priorUrl === undefined) delete process.env.SILICONFLOW_BASE_URL; else process.env.SILICONFLOW_BASE_URL = priorUrl;
});
test('nonstream requests reject overseas override before any network call', async () => {
    process.env.SILICONFLOW_BASE_URL = 'https://api.siliconflow.com/v1';
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(service.chat([])).rejects.toThrow('允许范围');
    expect(fetcher).not.toHaveBeenCalled();
});
test('stream requests reject overseas override before any network call', async () => {
    process.env.SILICONFLOW_BASE_URL = 'https://api.siliconflow.com/v1';
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(service.chatStream([]).next()).rejects.toThrow('允许范围');
    expect(fetcher).not.toHaveBeenCalled();
});
test.each(['chat', 'stream'])('%s errors neither follow redirects nor expose response body', async mode => {
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('private prompt and token', { status: 502 }));
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    const request = mode === 'chat' ? service.chat([]) : service.chatStream([]).next();
    await expect(request).rejects.toThrow('状态码 502');
    expect(fetcher).toHaveBeenCalledWith('https://api.siliconflow.cn/v1/chat/completions', expect.objectContaining({ redirect: 'error' }));
    expect(logger).not.toHaveBeenCalled();
});
test('failed tool follow-up cannot yield a successful done event', async () => {
    const event = { choices: [{ delta: { tool_calls: [{ index: 0, id: 'test-tool', type: 'function', function: { name: 'test-only', arguments: '{}' } }] } }] };
    const fetcher = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`))
        .mockResolvedValueOnce(new Response('private follow-up body', { status: 503 }));
    const events: string[] = [];
    async function consume() { for await (const event of service.chatStream([])) events.push(event.type); }
    await expect(consume()).rejects.toThrow('后续回答未完成');
    expect(events).not.toContain('done');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ redirect: 'error' });
});
