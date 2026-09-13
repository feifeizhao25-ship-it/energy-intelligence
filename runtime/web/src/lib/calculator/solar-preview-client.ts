export interface SolarPreviewInput {
    lat: string; lng: string; capacity: string; unitCost: string; electricityPrice: string;
}

export function solarPreviewPayload(input: SolarPreviewInput) {
    const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim() ? Number(value) : NaN]));
    if (!Object.values(values).every(Number.isFinite) || Math.abs(values.lat) > 90 || Math.abs(values.lng) > 180
        || values.capacity <= 0 || values.unitCost <= 0 || values.electricityPrice < 0) {
        throw new Error('请填写有效的位置、装机容量、单位投资和电价。');
    }
    return { location: { lat: values.lat, lng: values.lng }, capacity: values.capacity,
        unitCost: values.unitCost / 1000, electricityPrice: values.electricityPrice, qualityTag: 'PREVIEW' };
}

export interface SolarPreview {
    snapshotId: string;
    result: { initialInvestment: number; annualGeneration: number; irr: number | null; paybackPeriod: number | null; npv: number; lcoe: number };
    source: { start: string; end: string; fetchedAt: string; hash: string };
    assumptions: { lifetime: number; performanceRatio: number; annualOperatingCostRatio: number; degradationRate: number; discountRate: number };
    limitations: string[];
}

/** 只接受已持久化、结构完整的初步估算；错误响应不转换成结果。 */
export async function requestSolarPreview(input: SolarPreviewInput, fetcher: typeof fetch = fetch): Promise<SolarPreview> {
    const payload = solarPreviewPayload(input);
    let response: Response;
    try {
        response = await fetcher('/api/v2/solar/calculate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify(payload),
        });
    } catch { throw new Error('网络连接中断，无法确认是否保存。请先查看计算记录，再决定是否重试，避免重复扣减次数。'); }
    if (!response.ok) {
        const messages: Record<number, string> = { 401: '请先登录后再进行测算。', 400: '测算参数无效，请检查输入。',
            429: '今日测算次数已用完，请明天再试。', 404: '关联项目不存在或无法访问。' };
        throw new Error(messages[response.status] || '服务暂不可用，未取得完整结果，请稍后再试。');
    }
    const body = await response.json().catch(() => null);
    const data = body?.data;
    const result = data?.result;
    const resource = data?.evidence?.dataProvenance?.solarResource;
    const assumptions = data?.assumptions;
    const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
    if (body?.success !== true || body?.meta?.persisted !== true || body?.meta?.qualityTag !== 'PREVIEW'
        || typeof data?.snapshotId !== 'string' || !data.snapshotId.trim()
        || !result || !['initialInvestment', 'annualGeneration', 'npv', 'lcoe'].every(key => Number.isFinite(result[key]))
        || !['irr', 'paybackPeriod'].every(key => result[key] === null || Number.isFinite(result[key]))
        || !assumptions || !['lifetime', 'performanceRatio', 'annualOperatingCostRatio', 'degradationRate', 'discountRate'].every(key => Number.isFinite(assumptions[key]))
        || !date(resource?.temporalCoverage?.start) || !date(resource?.temporalCoverage?.end) || !date(resource?.timestamp)
        || !/^[a-f0-9]{64}$/.test(resource?.metadata?.responseSha256 ?? '')
        || !Array.isArray(data?.limitations) || !data.limitations.length || !data.limitations.every((v: unknown) => typeof v === 'string')) {
        throw new Error('未收到完整的保存确认与来源信息，无法展示结果。请先查看计算记录，避免重复提交。');
    }
    return { snapshotId: data.snapshotId, result, assumptions, limitations: data.limitations,
        source: { start: resource.temporalCoverage.start, end: resource.temporalCoverage.end,
            fetchedAt: resource.timestamp, hash: resource.metadata.responseSha256 } };
}
