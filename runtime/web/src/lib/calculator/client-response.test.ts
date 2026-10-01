import { readCalculationResponse } from './client-response';

describe('calculation response shown to users', () => {
    it.each([401, 403, 429, 500])('rejects HTTP %s without leaking the upstream body', async status => {
        const response = new Response('private upstream diagnostic', {status});
        await expect(readCalculationResponse(response)).rejects.toThrow(/登录|会员|额度|服务/);
        expect(response.bodyUsed).toBe(false);
    });
    it.each(['not json', '{}', '{"success":false}', '{"success":true,"data":null}', '{"success":true,"data":[]}'])('rejects unusable response %s', async body => {
        await expect(readCalculationResponse(new Response(body))).rejects.toThrow(/结果/);
    });
    it('returns the actual payload for a successful calculation', async () => {
        const data = {energy: {annual: 123}, financial: {irr: null}};
        await expect(readCalculationResponse(new Response(JSON.stringify({success:true,data})))).resolves.toEqual(data);
    });
    it('额度/权益类拒绝显示服务端给出的具体中文原因', async () => {
        const body = JSON.stringify({ error: 'USAGE_LIMIT_EXCEEDED', message: '今日收益测算次数已用完（2 次），请升级会员或等待明日 0 点重置' });
        await expect(readCalculationResponse(new Response(body, { status: 429 }))).rejects.toThrow('今日收益测算次数已用完（2 次）');
    });
    it('服务端给的是英文或内部报错时仍回退为中文兜底', async () => {
        const body = JSON.stringify({ message: 'Request failed with status code 502' });
        await expect(readCalculationResponse(new Response(body, { status: 429 }))).rejects.toThrow(/额度/);
    });
});
