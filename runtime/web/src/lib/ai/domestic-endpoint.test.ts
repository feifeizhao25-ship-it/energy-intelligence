import { domesticSiliconFlowBaseUrl } from './domestic-endpoint';
test.each(['https://api.siliconflow.cn/v1', 'https://api.siliconflow.cn/v1/'])('allows canonical domestic endpoint %s', value => {
    expect(domesticSiliconFlowBaseUrl(value)).toBe('https://api.siliconflow.cn/v1');
});
test.each(['http://api.siliconflow.cn/v1', 'https://api.siliconflow.com/v1', 'https://api.siliconflow.cn.evil.test/v1',
    'https://user:secret@api.siliconflow.cn/v1', 'https://api.siliconflow.cn:9443/v1', 'https://api.siliconflow.cn/v1?secret=x',
    'https://api.siliconflow.cn/v1#token', 'https://api.siliconflow.cn/proxy', '', 'not-a-url'])('rejects unsafe endpoint without reflecting its value: %s', value => {
    expect(() => domesticSiliconFlowBaseUrl(value)).toThrow(/国内模型服务地址/);
    try { domesticSiliconFlowBaseUrl(value); } catch (error) { if (value) expect(String(error)).not.toContain(value); }
});
