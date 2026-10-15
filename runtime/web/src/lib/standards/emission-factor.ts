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

/**
 * 审计 8-2：2023 年区域与省级电力平均二氧化碳排放因子（kgCO2/kWh）。
 * 来源同上：生态环境部、国家统计局公告 2025 年第 47 号附件表 2、表 3
 * https://www.mee.gov.cn/xxgk2018/xxgk/xxgk01/202512/W020251231726284332528.pdf （2026-10-15 核对）
 * 公告未发布西藏、港澳台省级因子，这些地区回落到全国平均。
 */
export const REGIONAL_EMISSION_FACTORS_2023: Readonly<Record<string, number>> = {
    华北: 0.6361, 东北: 0.5122, 华东: 0.5500, 华中: 0.5271, 西北: 0.5543, 南方: 0.4042, 西南: 0.2472,
};

export const PROVINCIAL_EMISSION_FACTORS_2023: Readonly<Record<string, number>> = {
    北京: 0.5554, 天津: 0.6796, 河北: 0.6516, 山西: 0.6634, 内蒙古: 0.6479,
    辽宁: 0.4878, 吉林: 0.4671, 黑龙江: 0.5229, 上海: 0.5737, 江苏: 0.5827,
    浙江: 0.4974, 安徽: 0.6553, 福建: 0.4211, 江西: 0.5836, 山东: 0.6191,
    河南: 0.5897, 湖北: 0.4044, 湖南: 0.4976, 广东: 0.4419, 广西: 0.4476,
    海南: 0.3648, 重庆: 0.5581, 四川: 0.1564, 贵州: 0.5683, 云南: 0.1333,
    陕西: 0.6335, 甘肃: 0.4471, 青海: 0.1796, 宁夏: 0.6187, 新疆: 0.6021,
};

/** 省份名规范化：去掉“省/市/自治区/壮族/回族/维吾尔”等后缀 */
export function normalizeProvince(name?: string | null): string | null {
    if (!name) return null;
    const n = String(name).trim()
        .replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/u, '');
    return n || null;
}

export interface ResolvedEmissionFactor {
    value: number;
    unit: 'kgCO2/kWh';
    year: 2023;
    scope: string;
    source: string;
    province: string | null;
}

/** 按项目所在省取省级因子；无省份或公告未收录时回落全国平均，并在 scope 中写明口径 */
export function resolveEmissionFactor(province?: string | null): ResolvedEmissionFactor {
    const p = normalizeProvince(province);
    const v = p ? PROVINCIAL_EMISSION_FACTORS_2023[p] : undefined;
    if (p && typeof v === 'number') {
        return { value: v, unit: 'kgCO2/kWh', year: 2023, scope: `${p}省级电力平均二氧化碳排放因子`, source: GRID_EMISSION_FACTOR.source, province: p };
    }
    return {
        value: GRID_EMISSION_FACTOR.value, unit: 'kgCO2/kWh', year: 2023,
        scope: p ? `全国电力平均二氧化碳排放因子（公告未收录${p}省级因子）` : GRID_EMISSION_FACTOR.scope,
        source: GRID_EMISSION_FACTOR.source, province: null,
    };
}

/** 按省份计算减排量（kg CO2） */
export function co2AvoidedKgForProvince(kwh: number, province?: string | null): number {
    return kwh * resolveEmissionFactor(province).value;
}

/** 报告/页面统一口径说明：按项目所在省（或全国平均）因子，例如“按 2023 年江苏省级电力平均二氧化碳排放因子 0.5827 kg/kWh 计算” */
export function emissionFactorNoteFor(province?: string | null): string {
    const f = resolveEmissionFactor(province);
    return `按 ${f.year} 年${f.scope} ${f.value} kg/kWh 计算`;
}

/** 按省份计算减排量（吨 CO2） */
export function co2AvoidedTonnesForProvince(kwh: number, province?: string | null): number {
    return co2AvoidedKgForProvince(kwh, province) / 1000;
}
