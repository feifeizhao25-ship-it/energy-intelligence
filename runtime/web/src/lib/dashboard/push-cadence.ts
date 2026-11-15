import { PRODUCT_ROLES } from './personalization';

export const HOLIDAY_SOURCE = 'https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm';

export const HOLIDAYS_2026 = [
    '2026-01-01', '2026-01-02', '2026-01-03',
    '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
    '2026-04-04', '2026-04-05', '2026-04-06',
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
    '2026-06-19', '2026-06-20', '2026-06-21',
    '2026-09-25', '2026-09-26', '2026-09-27',
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
];

export const MAKEUP_WORKDAYS_2026 = ['2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10'];

const SUFFIX: Record<string, string> = {
    ci_owner: '总',
    developer: '经理',
    researcher: '老师',
    government: '老师',
    epc: '老师',
    student: '同学',
};

export function salutation(role: string, surname: string, mode: 'role' | 'none' = 'role', subRole = ''): string {
    if (mode === 'none' || !surname.trim()) return '';
    if (subRole === 'student' || role === 'student') return '同学';
    const suffix = SUFFIX[role];
    return suffix ? `${surname.trim()}${suffix}` : '';
}

export function allowPush(iso: string, kind: '即时' | '周报' = '即时'): boolean {
    const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso);
    if (!matched) return false;
    const [, day, hourText, minuteText] = matched;
    const minutes = Number(hourText) * 60 + Number(minuteText);
    if (minutes < 8 * 60 || minutes > 21 * 60 + 30) return false;
    const date = new Date(`${day}T12:00:00+08:00`);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const quiet = HOLIDAYS_2026.includes(day) || (weekend && !MAKEUP_WORKDAYS_2026.includes(day));
    if (quiet && kind !== '周报') return false;
    return PRODUCT_ROLES.length > 0;
}
