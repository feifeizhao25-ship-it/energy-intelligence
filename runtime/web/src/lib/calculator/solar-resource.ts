/**
 * 光伏测算统一使用的资源数据：NASA POWER 上一完整年的月度水平面辐照与气温，
 * 经 lib/api/verified-solar.ts 校验年份、坐标、单位、缺测后再换算。
 *
 * 快速测算（calculateSolar）、带证据链的初步估算（SolarCalculatorV2）与 /api/solar/nrel 的估算兜底
 * 都从这里取数，同一地点不会再因为一边取 2022 年、一边取上一完整年而得出不同发电量。
 * 资源地图等浏览器端展示仍用 lib/api/nasa-power.ts（不参与测算）。
 */
import { withCache } from '@/lib/cache';
import { verifiedSolar, toSolarResource } from '@/lib/api/verified-solar';
import type { SolarResource } from '@/types';

export const loadSolarResource = withCache('verified:solar', async (lat: number, lng: number): Promise<SolarResource> => {
    try {
        return toSolarResource(await verifiedSolar(lat, lng), lat);
    } catch {
        throw new Error('获取太阳能资源数据失败，请稍后重试');
    }
});
