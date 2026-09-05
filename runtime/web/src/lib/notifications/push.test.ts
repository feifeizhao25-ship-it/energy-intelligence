import { generateEveningReport, type StationData } from './push';

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
