/** 遥测点与阈值。没有入库点时调用方保持 503，这里不补曲线。 */

export interface TelemetryPoint {
  pointId: string;
  recordedAt: Date;
  powerKw: number | null;
  energyKwh: number | null;
  irradiance: number | null;
  alarmCode: string;
  source: 'csv' | 'webhook' | 'modbus';
}

export interface AlarmRuleInput {
  id?: string;
  metric: 'power_kw' | 'irradiance' | 'alarm_code';
  operator: 'gt' | 'lt' | 'present';
  threshold: number;
  severity: string;
  enabled?: boolean;
}

const SOURCES = new Set(['csv', 'webhook', 'modbus']);

export function parseTelemetryJson(body: unknown): TelemetryPoint[] {
  const sourceRaw = (body as { source?: string })?.source;
  const source = SOURCES.has(String(sourceRaw)) ? sourceRaw as TelemetryPoint['source'] : null;
  const points = (body as { points?: unknown })?.points;
  if (!source || !Array.isArray(points) || points.length === 0 || points.length > 5000) {
    throw new Error('请提供 source（csv、webhook 或 modbus）以及 1 到 5000 个点');
  }
  return points.map((row) => parsePoint(row, source));
}

export function parseTelemetryCsv(text: string): TelemetryPoint[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('CSV 至少要有表头和一行数据');
  const header = lines[0].split(',').map((cell) => cell.trim());
  const index = (name: string) => header.indexOf(name);
  if (index('point_id') < 0 || index('timestamp') < 0) throw new Error('CSV 需要 point_id 和 timestamp 列');
  if (lines.length < 2) throw new Error('CSV 至少要有表头和一行数据');
  const points = lines.slice(1, 5001).map((line) => {
    const cells = line.split(',');
    return parsePoint({
      point_id: cells[index('point_id')],
      timestamp: cells[index('timestamp')],
      power_kw: index('power_kw') >= 0 ? cells[index('power_kw')] : undefined,
      energy_kwh: index('energy_kwh') >= 0 ? cells[index('energy_kwh')] : undefined,
      irradiance: index('irradiance') >= 0 ? cells[index('irradiance')] : undefined,
      alarm_code: index('alarm_code') >= 0 ? cells[index('alarm_code')] : '',
    }, 'csv');
  });
  if (!points.length) throw new Error('CSV 没有数据行');
  return points;
}

function parsePoint(row: any, source: TelemetryPoint['source']): TelemetryPoint {
  const pointId = String(row?.point_id ?? row?.pointId ?? '').trim();
  const recordedAt = new Date(row?.timestamp ?? row?.recordedAt ?? '');
  if (!pointId || pointId.length > 64 || Number.isNaN(recordedAt.getTime())) {
    throw new Error('每个点都需要点位编号和时间');
  }
  return {
    pointId,
    recordedAt,
    powerKw: optionalNumber(row?.power_kw ?? row?.powerKw),
    energyKwh: optionalNumber(row?.energy_kwh ?? row?.energyKwh),
    irradiance: optionalNumber(row?.irradiance),
    alarmCode: String(row?.alarm_code ?? row?.alarmCode ?? '').slice(0, 64),
    source,
  };
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('功率、电量或辐照必须是数字');
  return number;
}

export function ruleMatches(rule: AlarmRuleInput, point: TelemetryPoint): { breached: boolean; observed: number | null } {
  if (rule.enabled === false) return { breached: false, observed: null };
  if (rule.metric === 'alarm_code') {
    return { breached: rule.operator === 'present' && point.alarmCode.trim().length > 0, observed: null };
  }
  const observed = rule.metric === 'power_kw' ? point.powerKw : point.irradiance;
  if (observed === null) return { breached: false, observed: null };
  if (rule.operator === 'gt') return { breached: observed > rule.threshold, observed };
  if (rule.operator === 'lt') return { breached: observed < rule.threshold, observed };
  return { breached: false, observed };
}

export function monitoringSeries(points: TelemetryPoint[]) {
  const ordered = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const latest = ordered[ordered.length - 1];
  return {
    source: 'ingested_telemetry',
    summary: {
      sampleCount: ordered.length,
      currentPower: latest?.powerKw ?? null,
      from: ordered[0]?.recordedAt.toISOString() ?? null,
      to: latest?.recordedAt.toISOString() ?? null,
    },
    timeSeries: ordered.map((point) => ({
      time: point.recordedAt.toISOString(),
      power: point.powerKw,
      irradiance: point.irradiance,
      pointId: point.pointId,
      alarmCode: point.alarmCode || null,
    })),
    note: '曲线只包含已入库的遥测点，缺失功率保持为空，不补模拟值。',
  };
}

export function performanceFromSamples(points: TelemetryPoint[]) {
  const usable = points.filter((point) => point.powerKw !== null && point.irradiance !== null && point.irradiance > 0);
  if (!usable.length) {
    return { note: '已有遥测，但没有同时具备功率和正辐照的点，因此不算性能比。' };
  }
  const energy = usable.reduce((sum, point) => sum + (point.energyKwh ?? 0), 0);
  const irradianceHours = usable.reduce((sum, point) => sum + (point.irradiance as number), 0) / 1000;
  return {
    pointsUsed: usable.length,
    energyKwh: Math.round(energy * 1000) / 1000,
    irradianceSumKwhPerM2: Math.round(irradianceHours * 1000) / 1000,
    note: '这里汇总已入库点的电量和辐照。性能比还需要调用方给出装机容量下的理论发电量，本接口不估算容量。',
  };
}
