/** 与后端 as_of_view.effective_on 同一规则：生效日不晚于查询日，且尚未到期、未被已生效的新版本替代。 */

export interface VersionedRecord {
    source_id: string;
    effective_date?: string | null;
    expiry_date?: string | null;
    superseded_by?: string | null;
    [key: string]: unknown;
}

function parseDay(value: string | null | undefined): string | null {
    if (!value) return null;
    const day = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function effectiveOn<T extends VersionedRecord>(records: T[], day: string, key: keyof T & string = 'source_id'): T[] {
    const moment = parseDay(day);
    if (!moment) return [];
    const chosen = records.filter((record) => {
        const start = parseDay(record.effective_date as string | null | undefined);
        if (!start || start > moment) return false;
        const end = parseDay(record.expiry_date as string | null | undefined);
        if (end && end < moment) return false;
        return true;
    });
    const current = new Set(chosen.map((item) => String(item[key] ?? '')));
    const hidden = new Set(
        chosen
            .filter((item) => item.superseded_by && current.has(String(item.superseded_by)))
            .map((item) => String(item[key] ?? '')),
    );
    return chosen.filter((item) => !hidden.has(String(item[key] ?? '')));
}

export interface CohortGroup {
    province: string;
    role: string;
    count: number;
    items: string[];
}

export const COHORT_MINIMUM = 20;

/** 同省同角色不足 20 人不展示。示例分组必须由调用方标明，不能写成线上统计。 */
export function visibleCohorts(groups: CohortGroup[], minimum = COHORT_MINIMUM): CohortGroup[] {
    return groups
        .filter((group) => Number(group.count) >= minimum)
        .map((group) => ({
            province: group.province || '',
            role: group.role || '',
            count: Number(group.count),
            items: [...(group.items || [])],
        }));
}
