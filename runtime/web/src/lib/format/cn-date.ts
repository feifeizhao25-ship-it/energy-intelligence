/** 国内版日期：上海时区，年月日，不用美式月/日/年。 */
export function formatCnDate(value: Date | string | number | null | undefined): string {
    if (value == null || value === '') return '--';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}
