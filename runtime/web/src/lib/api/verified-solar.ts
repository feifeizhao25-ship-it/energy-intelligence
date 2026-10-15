import { createHash } from 'crypto';
import type { SolarResource } from '@/types';
import { empiricalOptimalTilt } from '@/lib/calculator/transposition';

/**
 * 仅请求上一完整公历年，不用旧年份或缺失月份静默补值。
 * 同时取月均气温 T2M：统一光伏引擎（lib/calculator/solar.ts simulateSolar）按组件工作温度逐月计温度损失，
 * 缺气温就无法按同一口径计算，所以气温缺失与辐照缺失一样直接报错。
 */
export async function verifiedSolar(lat: number, lng: number, now = new Date()) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('INVALID_COORDINATES');
    const year = now.getUTCFullYear() - 1;
    const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/point');
    url.search = new URLSearchParams({ parameters: 'ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF,T2M', community: 'RE',
        start: String(year), end: String(year), latitude: String(lat), longitude: String(lng),
        'time-standard': 'UTC', format: 'JSON' }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('SOLAR_DATA_UNAVAILABLE');
    const raw = await response.text();
    const data = JSON.parse(raw);
    if (data.header?.start !== `${year}0101` || data.header?.end !== `${year}1231` || data.header?.time_standard !== 'UTC') {
        throw new Error('SOLAR_PERIOD_UNVERIFIED');
    }
    const coordinates = data.geometry?.coordinates;
    if (!Array.isArray(coordinates) || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])
        || Math.abs(coordinates[0] - lng) > 0.001 || Math.abs(coordinates[1] - lat) > 0.001) throw new Error('SOLAR_LOCATION_UNVERIFIED');
    const units = data.parameters?.ALLSKY_SFC_SW_DWN?.units;
    if (units !== 'kW-hr/m^2/day') throw new Error('SOLAR_UNITS_UNVERIFIED');
    if (data.parameters?.T2M?.units !== 'C') throw new Error('SOLAR_UNITS_UNVERIFIED');
    const values = data.properties?.parameter?.ALLSKY_SFC_SW_DWN;
    const temperatures = data.properties?.parameter?.T2M;
    // 水平面散射（用于组件平面换算）；缺测时留空，由 Erbs 分离估算，不填 0 冒充
    const diffuse = data.properties?.parameter?.ALLSKY_SFC_SW_DIFF ?? {};
    if (!values || typeof values !== 'object' || !temperatures || typeof temperatures !== 'object') throw new Error('SOLAR_DATA_INCOMPLETE');
    const monthly = Array.from({ length: 12 }, (_, index) => {
        const key = String(year) + String(index + 1).padStart(2, '0');
        const value = values[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value === data.header?.fill_value) throw new Error('SOLAR_DATA_INCOMPLETE');
        const temperature = temperatures[key];
        if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature === data.header?.fill_value
            || temperature < -80 || temperature > 60) throw new Error('SOLAR_DATA_INCOMPLETE');
        const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
        const d = diffuse[key];
        const dhi = typeof d === 'number' && Number.isFinite(d) && d >= 0 && d !== data.header?.fill_value ? d : undefined;
        return { month: index + 1, dailyMeanGhi: value, dhi, days, totalGhi: value * days, temperature };
    });
    const annualGHI = monthly.reduce((sum, month) => sum + month.totalGhi, 0);
    if (!Number.isFinite(annualGHI) || annualGHI <= 0) throw new Error('SOLAR_DATA_INVALID');
    return { source: 'NASA POWER' as const, annualGHI, monthly, year, units: 'kWh/m²/年',
        timestamp: new Date(), cacheHit: false, requestUrl: url.toString(),
        rawResponse: raw, responseSha256: createHash('sha256').update(raw).digest('hex'),
        temporalCoverage: { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1) - 1) },
    };
}

/** 年发电量最佳倾角经验式 0.76·|纬度| + 3.1°（与后端 resource_service 同一口径；原 |纬度|+10° 偏向冬季，年发电量偏低）。 */
export function estimateOptimalTilt(lat: number): number {
    return empiricalOptimalTilt(lat);
}

export function solarResourceClass(annualGhi: number): SolarResource['annual']['resourceClass'] {
    if (annualGhi >= 1800) return 'I';
    if (annualGhi >= 1600) return 'II';
    if (annualGhi >= 1400) return 'III';
    if (annualGhi >= 1200) return 'IV';
    return 'V';
}

/**
 * 把核验过的 NASA POWER 月度数据换成统一光伏引擎的输入。
 * 取水平面辐照、水平面散射与气温；散射缺测时留空（dhi 为 undefined），由换算模型按 Erbs 分离估算。
 */
export function toSolarResource(verified: Awaited<ReturnType<typeof verifiedSolar>>, lat: number): SolarResource {
    return {
        lat,
        monthly: verified.monthly.map(m => ({ month: m.month, ghi: m.dailyMeanGhi, dhi: m.dhi, temperature: m.temperature, days: m.days })),
        annual: {
            ghi: verified.annualGHI,
            peakSunHours: verified.annualGHI,
            optimalTilt: estimateOptimalTilt(lat),
            resourceClass: solarResourceClass(verified.annualGHI),
        },
    };
}
