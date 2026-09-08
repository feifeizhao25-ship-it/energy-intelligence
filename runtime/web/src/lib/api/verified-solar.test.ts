import { verifiedSolar } from './verified-solar';
import { SolarCalculatorV2 } from '../calculator/solar-v2';
const now = new Date('2025-06-01T00:00:00Z');
function fixture(year = 2024, lat = 0, lng = 0) {
    return { geometry: { coordinates: [lng, lat] }, parameters: { ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day' } }, header: { fill_value: -999, start: `${year}0101`, end: `${year}1231`, time_standard: 'UTC' },
        properties: { parameter: { ALLSKY_SFC_SW_DWN: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(year) + String(i + 1).padStart(2, '0'), 4])) } } };
}
afterEach(() => jest.restoreAllMocks());
test('complete leap year uses exact day counts and retains source evidence', async () => {
    const raw = JSON.stringify(fixture());
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(raw));
    const result = await verifiedSolar(0, 0, now);
    expect(result.annualGHI).toBe(366 * 4);
    expect(result.rawResponse).toBe(raw);
    expect(result.responseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.requestUrl).toContain('start=2024');
    expect(fetcher).toHaveBeenCalledTimes(1);
});
test.each(['missing', 'fill', 'unit', 'string'])('rejects %s response without fallback', async kind => {
    const data = fixture(2024, 30, 120);
    if (kind === 'missing') delete data.properties.parameter.ALLSKY_SFC_SW_DWN['202402'];
    if (kind === 'fill') data.properties.parameter.ALLSKY_SFC_SW_DWN['202402'] = -999;
    if (kind === 'unit') data.parameters.ALLSKY_SFC_SW_DWN.units = 'W/m²';
    if (kind === 'string') (data.properties.parameter.ALLSKY_SFC_SW_DWN as any)['202402'] = '4';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(data)));
    await expect(verifiedSolar(30, 120, now)).rejects.toThrow();
});
test('invalid coordinates do not trigger network calls', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(verifiedSolar(91, 0, now)).rejects.toThrow('INVALID_COORDINATES');
    expect(fetcher).not.toHaveBeenCalled();
});
test('upstream failure cannot become a successful fixed estimate', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await expect(verifiedSolar(0, 0, now)).rejects.toThrow('SOLAR_DATA_UNAVAILABLE');
});
test('calculator uses verified data and labels user prices and preview assumptions', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(fixture(new Date().getUTCFullYear() - 1, 30, 120))));
    const result = await SolarCalculatorV2.calculate({ location: { lat: 30, lng: 120 }, capacity: 100, unitCost: 3, electricityPrice: 0.5, subsidyPrice: 0.1 });
    expect(result.auditMeta.qualityTag).toBe('PREVIEW');
    expect(result.auditMeta.hash).toHaveLength(64);
    expect(result.evidence.regulatoryCompliance).toEqual([]);
    expect(result.evidence.dataProvenance.electricityPrice.source).toBe('用户输入');
    expect(result.result.annualGeneration).toBeGreaterThan(0);
});
test('audit grade cannot be purchased or requested into existence', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(SolarCalculatorV2.calculate({ location: { lat: 30, lng: 120 }, capacity: 100, unitCost: 3, electricityPrice: 0.5, qualityTag: 'AUDIT_GRADE' })).rejects.toThrow('AUDIT_GRADE_UNAVAILABLE');
    expect(fetcher).not.toHaveBeenCalled();
});
test.each(['year', 'coordinates'])('rejects mismatched %s evidence', async kind => {
    const data = fixture();
    if (kind === 'year') data.header.start = '20220101';
    else data.geometry.coordinates = [10, 10];
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(data)));
    await expect(verifiedSolar(0, 0, now)).rejects.toThrow();
});
