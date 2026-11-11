/**
 * SolarResource.annual.peakSunHours 与年总水平辐照同量级（kWh/m²/年 = 年峰值日照小时）。
 * 呼和浩特样本约 1620 h/年；面板上标成 h/天 会把它读成「每天 1620 小时」。
 */
export function formatPeakSunHours(hours: number): { value: string; unit: 'h/年' } {
    const value = Number.isFinite(hours) ? hours.toFixed(2) : '—';
    return { value, unit: 'h/年' };
}
