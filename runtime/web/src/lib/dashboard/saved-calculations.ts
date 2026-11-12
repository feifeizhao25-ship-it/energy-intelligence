import type { SavedCalculationRef } from './personal-summary';

/** 只从快照里取出工作台列表需要的字段，电价和成本留在服务端。 */
export function savedCalculationRef(row: {
  id: string;
  calcType: string;
  projectId: string | null;
  createdAt: Date;
  inputSnapshot: unknown;
}): SavedCalculationRef {
  const input = row.inputSnapshot && typeof row.inputSnapshot === 'object' && !Array.isArray(row.inputSnapshot)
    ? row.inputSnapshot as Record<string, unknown>
    : {};
  const location = input.location && typeof input.location === 'object' && !Array.isArray(input.location)
    ? input.location as Record<string, unknown>
    : {};
  const address = typeof location.address === 'string' ? location.address.trim() : '';
  const capacity = typeof input.capacity === 'number' && Number.isFinite(input.capacity) ? input.capacity : null;
  const known: Record<string, { type: string; fallback: string }> = {
    SOLAR_REVENUE: { type: 'SOLAR', fallback: '光伏初步估算' },
    WIND_REVENUE: { type: 'WIND', fallback: '风电测算' },
    STORAGE_REVENUE: { type: 'STORAGE', fallback: '储能测算' },
  };
  const mapped = known[row.calcType] ?? { type: 'SOLAR', fallback: '已保存的测算' };
  return {
    id: row.id,
    name: address || mapped.fallback,
    type: mapped.type,
    capacity,
    projectId: row.projectId,
    createdAt: row.createdAt,
  };
}
