/**
 * 全站唯一的电网二氧化碳排放因子。所有减排量计算、页面和报告文字都从这里取，禁止再写数字。
 *
 * 数值：2023 年全国电力平均二氧化碳排放因子 0.5306 kgCO2/kWh
 * 来源：生态环境部、国家统计局公告 2025 年第 47 号（2025-12-31 发布）
 * 说明：碳市场配额核算使用的 0.5703 tCO2/MWh 属于另一口径，这里不用；区域电网因子未收录。
 * 更新：新公告发布后只改这一处，并同步更新 emission-factor.test.ts 里的门禁。
 */
export const GRID_EMISSION_FACTOR = {
    value: 0.5306,
    unit: 'kgCO2/kWh',
    year: 2023,
    scope: '全国电力平均二氧化碳排放因子',
    source: '生态环境部、国家统计局公告 2025 年第 47 号',
    publishedAt: '2025-12-31',
} as const;

/** 页面与报告统一的口径说明 */
export const EMISSION_FACTOR_NOTE =
    `按 ${GRID_EMISSION_FACTOR.year} 年全国电力平均排放因子 ${GRID_EMISSION_FACTOR.value} kg/kWh 计算`;

/** 减排量（kg CO2）= 发电量（kWh）× 0.5306 */
export function co2AvoidedKg(kwh: number): number {
    return kwh * GRID_EMISSION_FACTOR.value;
}

/** 减排量（吨 CO2） */
export function co2AvoidedTonnes(kwh: number): number {
    return co2AvoidedKg(kwh) / 1000;
}
