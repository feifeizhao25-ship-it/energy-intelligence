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
});
