/**
 * Solar screening kernel — same formulas as the CN canonical kernel
 * (runtime/web/src/lib/calculator/solar.ts): Hay-Davies plane-of-array
 * transposition (transposition.ts), itemised system losses, monthly SAPM
 * cell-temperature correction and IEC 61724-1 performance ratio. The previous
 * international page used a hard-coded `capacity * resource * 0.82` factor;
 * that is removed.
 *
 * web-int is built from its own Docker context, so it keeps a copy instead of
 * importing the CN files. runtime/web/src/lib/calculator/intl-kernel-consistency.test.ts
 * checks that the copy gives the same numbers as the CN kernel.
 *
 * Screening limitation, stated on the page: monthly GHI is derived from the
 * annual total by each month's extraterrestrial share until monthly resource
 * data is supplied, so results are screening-grade, not bankable.
 */
import { poaDaily, empiricalOptimalTilt, monthGeometry } from './transposition';

export const LOSS_ASSUMPTIONS = { soilingLoss: 0.02, acLoss: 0.015, cellTempRise: 20, tempCoefficient: 0.004 } as const;
// Ground-mounted fixed installation factors, identical to CN INSTALLATION_FACTORS.ground.
export const INSTALLATION = { shadingLoss: 0.01, mismatchLoss: 0.02, dcLoss: 0.015, inverterEfficiency: 0.97 } as const;
// Cell temperature: the CN kernel's monthly SAPM model (pvlib open_rack_glass_glass, wind 1 m/s)
// and module power coefficient, so both editions correct for heat the same way.
// runtime/web/src/lib/calculator/solar.ts: MODULE_GAMMA_PER_C, SAPM_MOUNT.ground, monthTemperatureFactor.
export const MODULE_GAMMA_PER_C = -0.0034;
const SAPM_GROUND = { a: -3.47, b: -0.0594, deltaT: 3 } as const;
const DEFAULT_WIND_MS = 1;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daylightHours(lat: number, month: number): number {
  const day = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1] ?? 172;
  const decl = 23.45 * Math.sin((2 * Math.PI * (284 + day)) / 365) * Math.PI / 180;
  const latR = lat * Math.PI / 180;
  const cosH = -Math.tan(latR) * Math.tan(decl);
  const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosH)));
  return (2 * hourAngle * 180 / Math.PI) / 15;
}

function energyWeightedIrradianceWm2(dailyKwhM2: number, hours: number): number {
  if (!(dailyKwhM2 > 0) || !(hours > 0)) return 0;
  return (dailyKwhM2 * 1000) * (Math.PI ** 2) / (8 * hours);
}

/** Same as the CN monthTemperatureFactor for a ground-mounted array. */
export function monthTemperatureFactor(airC: number, dailyPoaKwhM2: number, lat: number, month: number): number {
  const poaWm2 = energyWeightedIrradianceWm2(dailyPoaKwhM2, daylightHours(lat, month));
  const { a, b, deltaT } = SAPM_GROUND;
  const cellC = poaWm2 * Math.exp(a + b * DEFAULT_WIND_MS) + airC + (poaWm2 / 1000) * deltaT;
  return 1 + MODULE_GAMMA_PER_C * (cellC - 25);
}

export interface SolarScreeningInput { capacityKw: number; annualGhiKwhPerM2: number; latitude: number; tiltDeg?: number; ambientTempC?: number }
export interface SolarScreeningResult { annualGenerationKwh: number; monthlyGenerationKwh: number[]; planeIrradiationKwhPerM2: number; performanceRatio: number; specificYieldKwhPerKw: number; tiltDeg: number; method: string }

/** Monthly mean daily GHI (kWh/m²/day) from the annual total, by each month's extraterrestrial share. */
export function monthlyGhiDaily(annualGhiKwhPerM2: number, latitude: number): number[] {
  const h0 = Array.from({ length: 12 }, (_, i) => monthGeometry(latitude, i + 1, 0, 180).H0 * DAYS_IN_MONTH[i]);
  const h0Total = h0.reduce((a, b) => a + b, 0) || 1;
  return h0.map((v, i) => (annualGhiKwhPerM2 * (v / h0Total)) / DAYS_IN_MONTH[i]);
}

export function solarScreening(input: SolarScreeningInput): SolarScreeningResult {
  const tilt = input.tiltDeg ?? empiricalOptimalTilt(input.latitude);
  const ambient = input.ambientTempC ?? 20;
  const systemEfficiency = (1 - INSTALLATION.shadingLoss) * (1 - INSTALLATION.mismatchLoss) * (1 - INSTALLATION.dcLoss)
    * INSTALLATION.inverterEfficiency * (1 - LOSS_ASSUMPTIONS.soilingLoss) * (1 - LOSS_ASSUMPTIONS.acLoss);
  // Monthly GHI is not spread evenly (that overstates winter POA at tilted planes):
  // distribute the annual total by each month's extraterrestrial irradiation share,
  // the same Klein representative-day geometry the CN kernel uses.
  const ghi = monthlyGhiDaily(input.annualGhiKwhPerM2, input.latitude);
  let planeAnnual = 0;
  const monthly: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const days = DAYS_IN_MONTH[m - 1];
    const monthPlane = poaDaily({ lat: input.latitude, month: m, ghi: ghi[m - 1], tilt, azimuth: 180 }) * days;
    planeAnnual += monthPlane;
    const tempFactor = monthTemperatureFactor(ambient, monthPlane / days, input.latitude, m);
    // Rounded per month, then summed — the CN kernel's order, so totals match to the kWh.
    monthly.push(Math.round(input.capacityKw * monthPlane * systemEfficiency * tempFactor));
  }
  const generation = monthly.reduce((a, b) => a + b, 0);
  const reference = input.capacityKw * planeAnnual;
  return { annualGenerationKwh: generation, monthlyGenerationKwh: monthly, planeIrradiationKwhPerM2: Math.round(planeAnnual),
    performanceRatio: reference > 0 ? Math.round((generation / reference) * 1000) / 1000 : 0,
    specificYieldKwhPerKw: input.capacityKw > 0 ? Math.round(generation / input.capacityKw) : 0,
    tiltDeg: tilt, method: 'Hay-Davies POA (Klein representative days) + CN kernel loss, SAPM cell-temperature and PR formulas; monthly GHI distributed by extraterrestrial share (screening)' };
}
