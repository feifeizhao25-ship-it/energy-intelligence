/**
 * design-system — formatting helpers shared by metric components.
 */

export interface BenchmarkHint {
  benchmarkText?: string;
  tooltip?: string;
  status: 'above' | 'below' | 'no-benchmark';
}

/** Compare a metric value against an industry benchmark. */
export function benchmarkHint(
  value: number,
  unit: string,
  benchmark?: number,
): BenchmarkHint {
  if (benchmark === undefined) {
    return { status: 'no-benchmark' };
  }
  return {
    status: value >= benchmark ? 'above' : 'below',
    benchmarkText: benchmark ? `Industry benchmark: ${benchmark.toFixed(2)} ${unit}` : undefined,
    tooltip: benchmark
      ? value >= benchmark
        ? `At or above the industry benchmark of ${benchmark.toFixed(2)} ${unit}`
        : `Below the industry benchmark of ${benchmark.toFixed(2)} ${unit}`
      : undefined,
  };
}

/** Format a USD figure with compact thousands separators. */
export function formatUsd(value: number, fractionDigits = 0): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Format a percentage with a sign when positive. */
export function formatDeltaPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
