import { requestSolarPreview, solarPreviewPayload } from './solar-preview-client';
const input = { lat: '0', lng: '0', capacity: '100', unitCost: '3500', electricityPrice: '0' };
function response() {
    return { success: true, meta: { persisted: true, qualityTag: 'PREVIEW' }, data: {
        snapshotId: 'snapshot-1', result: { initialInvestment: 350000, annualGeneration: 120000, irr: null, paybackPeriod: null, npv: -350000, lcoe: 0.4 },
        assumptions: { lifetime: 25, performanceRatio: 0.8, annualOperatingCostRatio: 0.01, degradationRate: 0.005, discountRate: 0.08 },
        evidence: { dataProvenance: { solarResource: { timestamp: '2026-09-13T00:00:00Z', temporalCoverage: { start: '2025-01-01T00:00:00Z', end: '2025-12-31T23:59:59Z' }, metadata: { responseSha256: 'a'.repeat(64) } } } },
        limitations: ['历史数据不是未来收益承诺。'],
    } };
}
test('converts yuan per kW to yuan per W exactly once; zero coordinates and zero price are valid', () => {
    expect(solarPreviewPayload(input)).toEqual({ location: { lat: 0, lng: 0 }, capacity: 100, unitCost: 3.5, electricityPrice: 0, qualityTag: 'PREVIEW' });
});
test.each([{ lat: '' }, { lat: '91' }, { lng: '-181' }, { capacity: '0' }, { unitCost: '-5' }, { electricityPrice: 'NaN' }])('invalid inputs never call the API: %j', async invalid => {
    const fetcher = jest.fn();
    await expect(requestSolarPreview({ ...input, ...invalid }, fetcher)).rejects.toThrow('请填写');
    expect(fetcher).not.toHaveBeenCalled();
});
test('uses authenticated V2 save path and preserves null estimates', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify(response())));
    const result = await requestSolarPreview(input, fetcher);
    expect(fetcher).toHaveBeenCalledWith('/api/v2/solar/calculate', expect.objectContaining({ credentials: 'same-origin', method: 'POST' }));
    expect(result.snapshotId).toBe('snapshot-1');
    expect(result.result.irr).toBeNull();
    expect(result.result.paybackPeriod).toBeNull();
    expect(result.result.npv).toBe(-350000);
});
test.each([401, 429, 503])('HTTP %i cannot turn into success even with a success-shaped body', async status => {
    await expect(requestSolarPreview(input, jest.fn().mockResolvedValue(new Response(JSON.stringify(response()), { status })))).rejects.toThrow();
});
test.each(['unpersisted', 'no-id', 'no-source', 'missing-result', 'non-preview'])('rejects incomplete confirmation: %s', async kind => {
    const body = response();
    if (kind === 'unpersisted') body.meta.persisted = false;
    if (kind === 'no-id') body.data.snapshotId = '';
    if (kind === 'no-source') body.data.evidence.dataProvenance.solarResource.metadata.responseSha256 = '';
    if (kind === 'missing-result') (body.data.result as any).annualGeneration = null;
    if (kind === 'non-preview') body.meta.qualityTag = 'AUDIT_GRADE';
    await expect(requestSolarPreview(input, jest.fn().mockResolvedValue(new Response(JSON.stringify(body))))).rejects.toThrow('保存确认');
});
test('network uncertainty advises checking records and never auto retries', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('lost response'));
    await expect(requestSolarPreview(input, fetcher)).rejects.toThrow('避免重复扣减次数');
    expect(fetcher).toHaveBeenCalledTimes(1);
});
