/** 同一套测算的两种展示。数值只来自传入的结果，模式不改计算。 */

export type ReadingMode = 'beginner' | 'professional';

export const BEGINNER_FIELDS = ['容量', '省份', '电价'] as const;

export const PROFESSIONAL_FIELDS = [
    '容量', '省份', '电价', '倾角', '方位角', '系统效率', '首年衰减', '年衰减',
    '运维费', '折现率', '评估年限', '贷款比例', '贷款利率', '残值',
] as const;

export function fieldsFor(mode: ReadingMode): readonly string[] {
    return mode === 'beginner' ? BEGINNER_FIELDS : PROFESSIONAL_FIELDS;
}

export function switchMode(current: ReadingMode): ReadingMode {
    return current === 'beginner' ? 'professional' : 'beginner';
}

/** 切换模式时保留已填输入，不用另一套默认值覆盖。 */
export function keepInputs<T extends Record<string, string>>(inputs: T): T {
    return { ...inputs };
}

export function shownNumbers(mode: ReadingMode, result: { annualKwh: number; lcoe: number; irr: number | null }): Record<string, number | null> {
    const shared = { 首年发电量: result.annualKwh, 平准化度电成本: result.lcoe, 内部收益率: result.irr };
    if (mode === 'beginner') return shared;
    return shared;
}
