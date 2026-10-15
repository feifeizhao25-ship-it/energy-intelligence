/** 开放接口 v1 光伏测算：输入校验与事实描述（与路由分开，便于测试）。 */
import { normalizeSelfUseRatio } from '@/lib/calculator/solar';
import type { SolarCalculationInput, SolarCalculationOutput } from '@/types';

export class V1InputError extends Error {
    readonly zh: string;
    constructor(zh: string) { super(zh); this.zh = zh; }
}

function num(v: unknown, name: string, { min = -Infinity, max = Infinity } = {}): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (v === undefined || v === null || v === '' || !Number.isFinite(n) || n < min || n > max) {
        throw new V1InputError(`参数 ${name} 缺失或超出范围`);
    }
    return n;
}

/** 电价必须由调用方提供（元/kWh），本接口不替调用方假设电价。 */
export function parseV1SolarInput(body: any): SolarCalculationInput {
    if (!body || typeof body !== 'object') throw new V1InputError('请求体必须是 JSON 对象');
    const province = String(body.province ?? '').trim();
    if (!province) throw new V1InputError('参数 province 缺失');
    return {
        lat: num(body.lat, 'lat', { min: -90, max: 90 }),
        lng: num(body.lng, 'lng', { min: -180, max: 180 }),
        capacity: num(body.capacity, 'capacity(kWp)', { min: 0.1, max: 1_000_000 }),
        installationType: (['roof', 'ground', 'carport', 'bifacial'].includes(body.installationType) ? body.installationType : 'roof'),
        moduleType: (['economy', 'standard', 'premium'].includes(body.moduleType) ? body.moduleType : 'standard'),
        tilt: body.tilt !== undefined ? num(body.tilt, 'tilt', { min: 0, max: 90 }) : undefined,
        azimuth: body.azimuth !== undefined ? num(body.azimuth, 'azimuth', { min: -180, max: 360 }) : undefined,
        selfUseRatio: normalizeSelfUseRatio(body.selfUseRatio, 0),
        electricityPrice: num(body.electricityPrice, 'electricityPrice(元/kWh)', { min: 0, max: 10 }),
        feedInTariff: num(body.feedInTariff, 'feedInTariff(元/kWh)', { min: 0, max: 10 }),
        unitCost: body.unitCost !== undefined ? num(body.unitCost, 'unitCost(元/kW)', { min: 0 }) : undefined,
        province,
    };
}

/** 事实描述模板：只陈述输出数值，不出现投资结论。 */
export function describeSolarOutput(o: SolarCalculationOutput) {
    const f = o.financial;
    return {
        headline: `按所给输入测算：首年发电量 ${Math.round(o.energy.year1)} kWh，性能比 ${(o.energy.pr * 100).toFixed(1)}%，内部收益率 ${f.irr.toFixed(2)}%（测算值，随电价与成本假设变化）。`,
        keyMetrics: [
            { name: '首年发电量', value: o.energy.year1.toFixed(0), unit: 'kWh' },
            { name: '内部收益率', value: f.irr.toFixed(2), unit: '%' },
            { name: '静态回收期', value: Number.isFinite(f.paybackYears) ? f.paybackYears.toFixed(1) : '寿命期内未回收', unit: '年' },
            { name: '平准化度电成本', value: f.lcoe.toFixed(3), unit: '元/kWh' },
        ],
    };
}

/** 审计链接用本站地址（NEXT_PUBLIC_SITE_URL），未配置时返回相对路径。 */
export function auditUrlFor(path: string): string {
    return `${(process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')}${path}`;
}
