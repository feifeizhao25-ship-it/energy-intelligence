// Shared with the CN calculator kernel (runtime/web/src/lib/calculator/transposition.ts).
// Keep the two copies in sync; the international assessment must not use its own ad-hoc factor.
/**
 * 组件平面辐照（POA）换算：月均日值 Hay-Davies 模型（各向异性散射）+ Klein (1977) 月代表日。
 *
 *   H_T = (H − H_d + H_d·A_i)·R_b + H_d·(1 − A_i)·(1 + cos β)/2 + H·ρ·(1 − cos β)/2
 *   A_i = (H − H_d) / H_0（各向异性指数），R_b 为代表日直射倾斜因子（对时角数值积分，支持任意方位角）
 *
 * 参考：Hay & Davies (1980)；Duffie & Beckman, Solar Engineering of Thermal Processes 第 2、4 章；
 * 月代表日取 Klein (1977)。无散射数据时用 Erbs et al. (1982) 月均直散分离。
 * 这是"月均近似"：与 pvlib Perez 逐时复算（北京 1.186、广州 1.042、乌鲁木齐 1.224）相差约 ±3%。
 * 输入单位：H、H_d 为月均日辐照 kWh/m²/day；返回同单位的组件平面月均日辐照。
 */

const KLEIN_MEAN_DAY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];
const GSC_KW = 1.367; // 太阳常数 kW/m²
const DEG = Math.PI / 180;
export const DEFAULT_ALBEDO = 0.2;
export const TRANSPOSITION_METHOD = 'Hay-Davies（月均日值，Klein 代表日；无散射数据时 Erbs 分离）';

/** 年最佳倾角经验式（与后端 resource_service 一致）：0.76·|φ| + 3.1 */
export function empiricalOptimalTilt(lat: number): number {
    return Math.round((0.76 * Math.abs(lat) + 3.1) * 10) / 10;
}

export interface MonthGeometry { H0: number; Rb: number; ws: number }

/** 代表日的地外日辐照 H0（kWh/m²/day）与直射倾斜因子 Rb。azimuth：180 = 正南，90 = 正东。 */
export function monthGeometry(lat: number, month: number, tilt: number, azimuth: number): MonthGeometry {
    const n = KLEIN_MEAN_DAY[month - 1];
    const d = 23.45 * Math.sin((360 * (284 + n) / 365) * DEG) * DEG;
    const phi = lat * DEG;
    const b = tilt * DEG;
    const g = (azimuth - 180) * DEG;
    const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(d))));
    const E0 = 1 + 0.033 * Math.cos((2 * Math.PI * n) / 365);
    const H0 = (24 / Math.PI) * GSC_KW * E0 * (Math.cos(phi) * Math.cos(d) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(d));
    const N = 360;
    let num = 0;
    let den = 0;
    for (let i = 0; i < N; i++) {
        const w = -ws + ((i + 0.5) * 2 * ws) / N;
        const cz = Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(phi) * Math.cos(w);
        if (cz <= 0) continue;
        const ct = Math.sin(d) * Math.sin(phi) * Math.cos(b)
            - Math.sin(d) * Math.cos(phi) * Math.sin(b) * Math.cos(g)
            + Math.cos(d) * Math.cos(phi) * Math.cos(b) * Math.cos(w)
            + Math.cos(d) * Math.sin(phi) * Math.sin(b) * Math.cos(g) * Math.cos(w)
            + Math.cos(d) * Math.sin(b) * Math.sin(g) * Math.sin(w);
        num += Math.max(0, ct);
        den += cz;
    }
    return { H0, Rb: den > 0 ? num / den : 0, ws };
}

/** Erbs et al. (1982) 月均直散分离：H_d/H 由清晰度指数 K_T 求得。 */
export function erbsMonthlyDiffuse(H: number, H0: number, ws: number): number {
    if (!(H > 0) || !(H0 > 0)) return 0;
    const kt = Math.min(0.8, Math.max(0.3, H / H0));
    const wsDeg = ws / DEG;
    const frac = wsDeg <= 81.4
        ? 1.391 - 3.560 * kt + 4.189 * kt ** 2 - 2.137 * kt ** 3
        : 1.311 - 3.022 * kt + 3.427 * kt ** 2 - 1.821 * kt ** 3;
    return H * Math.min(1, Math.max(0, frac));
}

/** 组件平面月均日辐照（kWh/m²/day）。dhi 缺失或非正时用 Erbs 估算。 */
export function poaDaily(params: {
    lat: number; month: number; ghi: number; dhi?: number; tilt: number; azimuth: number; albedo?: number;
}): number {
    const { lat, month, ghi, tilt, azimuth } = params;
    if (!(ghi > 0)) return 0;
    const rho = params.albedo ?? DEFAULT_ALBEDO;
    const { H0, Rb, ws } = monthGeometry(lat, month, tilt, azimuth);
    const Hd = params.dhi && params.dhi > 0 ? Math.min(params.dhi, ghi) : erbsMonthlyDiffuse(ghi, H0, ws);
    const Hb = ghi - Hd;
    const Ai = H0 > 0 ? Math.min(1, Math.max(0, Hb / H0)) : 0;
    const b = tilt * DEG;
    return (Hb + Hd * Ai) * Rb + Hd * (1 - Ai) * (1 + Math.cos(b)) / 2 + ghi * rho * (1 - Math.cos(b)) / 2;
}
