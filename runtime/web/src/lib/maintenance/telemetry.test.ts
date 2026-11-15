import { monitoringSeries, parseTelemetryCsv, parseTelemetryJson, performanceFromSamples, ruleMatches } from './telemetry';

it('解析网关 JSON 与 CSV，缺列直接拒绝', () => {
  const points = parseTelemetryJson({
    source: 'modbus',
    points: [{ point_id: 'inv-1', timestamp: '2026-10-27T01:00:00+08:00', power_kw: 12.5, alarm_code: '' }],
  });
  expect(points[0]).toMatchObject({ pointId: 'inv-1', powerKw: 12.5, source: 'modbus' });
  const csv = parseTelemetryCsv('point_id,timestamp,power_kw\ninv-1,2026-10-27T02:00:00+08:00,3\n');
  expect(csv).toHaveLength(1);
  expect(() => parseTelemetryCsv('only,header\n')).toThrow(/point_id/);
  expect(() => parseTelemetryJson({ source: 'mqtt', points: [] })).toThrow(/source/);
});

it('无入库点时序列函数不会编造功率；阈值只比较已有值', () => {
  const series = monitoringSeries([{
    pointId: 'a', recordedAt: new Date('2026-10-27T00:00:00Z'), powerKw: null, energyKwh: null,
    irradiance: 10, alarmCode: 'E1', source: 'webhook',
  }]);
  expect(series.summary.currentPower).toBeNull();
  expect(series.timeSeries[0].power).toBeNull();
  expect(ruleMatches({ metric: 'power_kw', operator: 'gt', threshold: 1, severity: 'warning' }, seriesToPoint(series)).breached).toBe(false);
  expect(ruleMatches({ metric: 'alarm_code', operator: 'present', threshold: 0, severity: 'warning' }, seriesToPoint(series)).breached).toBe(true);
  expect(performanceFromSamples([seriesToPoint(series)]).performanceRatio).toBeUndefined();
  expect(performanceFromSamples([seriesToPoint(series)]).note).toMatch(/不算性能比/);
});

function seriesToPoint(series: ReturnType<typeof monitoringSeries>) {
  return {
    pointId: series.timeSeries[0].pointId,
    recordedAt: new Date(series.timeSeries[0].time),
    powerKw: series.timeSeries[0].power,
    energyKwh: null,
    irradiance: series.timeSeries[0].irradiance,
    alarmCode: series.timeSeries[0].alarmCode || '',
    source: 'webhook' as const,
  };
}
