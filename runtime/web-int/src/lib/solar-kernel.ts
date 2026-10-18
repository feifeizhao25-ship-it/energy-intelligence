/**
 * Solar screening kernel — same formulas as the CN canonical kernel
 * (runtime/web/src/lib/calculator/solar.ts): Hay-Davies plane-of-array
 * transposition (transposition.ts), itemised system losses, temperature
 * correction and IEC 61724-1 performance ratio. The previous international
 * page used a hard-coded `capacity * resource * 0.82` factor; that is removed.
 *
 * Screening limitation, stated on the page: monthly GHI is approximated by
 * spreading the annual total evenly across months until monthly resource
 * data is supplied, so results are screening-grade, not bankable.
 */
import { poaDaily, empiricalOptimalTilt, monthGeometry } from './transposition';

export const LOSS_ASSUMPTIONS = { soilingLoss: 0.02, acLoss: 0.015, cellTempRise: 20, tempCoefficient: 0.004 } as const;
// Ground-mounted fixed installation factors, identical to CN INSTALLATION_FACTORS.ground.
const INSTALLATION = { shadingLoss: 0.01, mismatchLoss: 0.02, dcLoss: 0.015, inverterEfficiency: 0.97 } as const;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface SolarScreeningInput { capacityKw: number; annualGhiKwhPerM2: number; latitude: number; tiltDeg?: number; ambientTempC?: number }
export interface SolarScreeningResult { annualGenerationKwh: number; planeIrradiationKwhPerM2: number; performanceRatio: number; specificYieldKwhPerKw: number; tiltDeg: number; method: string }

export function solarScreening(input: SolarScreeningInput): SolarScreeningResult {
  const tilt = input.tiltDeg ?? empiricalOptimalTilt(input.latitude);
  const ambient = input.ambientTempC ?? 20;
  const systemEfficiency = (1 - INSTALLATION.shadingLoss) * (1 - INSTALLATION.mismatchLoss) * (1 - INSTALLATION.dcLoss)
    * INSTALLATION.inverterEfficiency * (1 - LOSS_ASSUMPTIONS.soilingLoss) * (1 - LOSS_ASSUMPTIONS.acLoss);
  const cellTemp = ambient + LOSS_ASSUMPTIONS.cellTempRise;
  const tempFactor = 1 - Math.max(0, (cellTemp - 25) * LOSS_ASSUMPTIONS.tempCoefficient);
  // Monthly GHI is not spread evenly (that overstates winter POA at tilted planes):
  // distribute the annual total by each month's extraterrestrial irradiation share,
  // the same Klein representative-day geometry the CN kernel uses.
  const h0 = Array.from({ length: 12 }, (_, i) => monthGeometry(input.latitude, i + 1, 0, 180).H0 * DAYS_IN_MONTH[i]);
  const h0Total = h0.reduce((a, b) => a + b, 0) || 1;
  let planeAnnual = 0; let generation = 0;
  for (let m = 1; m <= 12; m++) {
    const monthlyGhiDaily = (input.annualGhiKwhPerM2 * (h0[m - 1] / h0Total)) / DAYS_IN_MONTH[m - 1];
    const monthPlane = poaDaily({ lat: input.latitude, month: m, ghi: monthlyGhiDaily, tilt, azimuth: 180 }) * DAYS_IN_MONTH[m - 1];
    planeAnnual += monthPlane;
    generation += input.capacityKw * monthPlane * systemEfficiency * tempFactor;
  }
  const reference = input.capacityKw * planeAnnual;
  return { annualGenerationKwh: Math.round(generation), planeIrradiationKwhPerM2: Math.round(planeAnnual),
    performanceRatio: reference > 0 ? Math.round((generation / reference) * 1000) / 1000 : 0,
    specificYieldKwhPerKw: input.capacityKw > 0 ? Math.round(generation / input.capacityKw) : 0,
    tiltDeg: tilt, method: 'Hay-Davies POA (Klein representative days) + CN kernel loss/temp/PR formulas; monthly GHI distributed by extraterrestrial share (screening)' };
}
