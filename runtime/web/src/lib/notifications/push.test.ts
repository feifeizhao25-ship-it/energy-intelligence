import { generateEveningReport, generateMorningReport, checkAlerts, generateAlertReport, defaultPushConfig, type StationData } from './push';

const stations: StationData[] = [{
    id: 'station-1',
    name: '示例电站',
    type: 'solar',
    capacity: 100,
    todayGeneration: 120,
    todayRevenue: 96,
    monthGeneration: 3000,
    yearGeneration: 30000,
    efficiency: 95,
}];

describe('generateEveningReport', () => {
    it('没有真实昨日数据时不伪造环比', () => {
        const report = generateEveningReport(stations);

        expect(report.content).toContain('暂无昨日可比数据');
        expect(report.content).not.toContain('比昨日高');
    });

    it('仅使用调用方提供的真实昨日汇总计算环比', () => {
        const report = generateEveningReport(stations, '2026-09-04', 100);

        expect(report.content).toContain('比昨日高 20.0%');
    });

    it('昨日为零时不产生 Infinity 环比', () => {
        const report = generateEveningReport(stations, '2026-09-04', 0);

        expect(report.content).toContain('昨日发电量为 0，暂不计算环比');
        expect(report.content).not.toContain('Infinity');
    });
});

describe('notification evidence boundaries', () => {
    it('does not fabricate totals for missing or invalid readings', () => {
        for (const input of [[], [{ ...stations[0], todayGeneration: NaN }], [{ ...stations[0], todayRevenue: Infinity }]]) {
            expect(generateEveningReport(input).summary).toEqual({});
        }
    });
    it('does not fabricate forecasts or tariffs from weather labels', () => {
        const report = generateMorningReport(stations, {
            date: '2026-09-05', condition: 'sunny', temperature: { min: 20, max: 30 },
        });
        expect(report.summary.forecast).toBeUndefined();
        expect(report.content).toContain('暂不提供');
    });
    it('does not infer alarms or historical declines from a station snapshot', () => {
        expect(checkAlerts({ ...stations[0], efficiency: 50, todayGeneration: 0 })).toEqual([]);
        expect(generateAlertReport(stations[0], 'efficiency').content).not.toContain('下降5%');
        expect(generateAlertReport(stations[0], 'fault').content).not.toContain('检测到逆变器异常');
    });
    it('requires opt-in before notifications', () => {
        expect(defaultPushConfig.enabled).toBe(false);
    });
    it('handles flat, declining and invalid comparison baselines', () => {
        expect(generateEveningReport(stations, '2026-09-05', 120).content).toContain('持平');
        expect(generateEveningReport(stations, '2026-09-05', 150).content).toContain('低 20.0%');
        for (const baseline of [NaN, Infinity, -1]) {
            expect(generateEveningReport(stations, '2026-09-05', baseline).content).toContain('暂无昨日可比数据');
        }
    });
});
