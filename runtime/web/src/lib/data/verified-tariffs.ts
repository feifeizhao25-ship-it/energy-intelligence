import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface VerifiedTariff {
  province: string;
  month: string;
  priceYuanPerKwh: number;
  sourceUrl: string;
  asOf: string;
  licenseNote: string;
}

const EMPTY_NOTE = '尚未载入带来源链接和 asOf 的已核验电价。空表不是电价。';

export function tariffStorePath() {
  return process.env.NENGJIAN_TARIFF_STORE?.trim()
    || join(process.cwd(), 'src/data/verified-tariffs.json');
}

export function readVerifiedTariffs(path = tariffStorePath()): { loaded: boolean; note: string; rows: VerifiedTariff[] } {
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    const rows = Array.isArray(payload?.rows) ? payload.rows.map(normalize).filter(Boolean) as VerifiedTariff[] : [];
    return { loaded: rows.length > 0, note: rows.length ? '以下每条都有来源链接和 asOf。' : EMPTY_NOTE, rows };
  } catch {
    return { loaded: false, note: EMPTY_NOTE, rows: [] };
  }
}

export function importVerifiedTariffs(rows: unknown, path = tariffStorePath()): VerifiedTariff[] {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
    throw new Error('请提供 1 到 200 条已核验电价');
  }
  const normalized = rows.map((row) => {
    const item = normalize(row);
    if (!item) throw new Error('每条电价都需要省份、月份、数字价格、http(s) 来源和 asOf');
    return item;
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ loaded: true, rows: normalized }, null, 2));
  return normalized;
}

function normalize(row: any): VerifiedTariff | null {
  const province = String(row?.province || '').trim();
  const month = String(row?.month || '').trim();
  const price = Number(row?.priceYuanPerKwh ?? row?.price_yuan_per_kwh);
  const sourceUrl = String(row?.sourceUrl || row?.source_url || '').trim();
  const asOf = String(row?.asOf || row?.as_of || '').trim();
  const licenseNote = String(row?.licenseNote || row?.license_note || '来源页面原文为准').trim();
  if (!province || !/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(price) || price < 0) return null;
  if (!/^https?:\/\//.test(sourceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null;
  return { province, month, priceYuanPerKwh: price, sourceUrl, asOf, licenseNote };
}
