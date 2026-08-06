'use client';

/**
 * TornadoChart — sensitivity analysis: NPV swing per input variable.
 * Variables are sorted by absolute swing so the chart forms a tornado.
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface TornadoItem {
  variable: string;
  low: number;
  high: number;
}

export interface TornadoChartProps {
  base: number;
  items: TornadoItem[];
  height?: number;
}

export const TornadoChart: React.FC<TornadoChartProps> = ({ base, items, height = 320 }) => {
  const data = useMemo(
    () =>
      [...items]
        .map((item) => ({
          variable: item.variable,
          swingLow: item.low - base,
          swingHigh: item.high - base,
        }))
        .sort(
          (a, b) =>
            Math.abs(b.swingHigh - b.swingLow) - Math.abs(a.swingHigh - a.swingLow),
        ),
    [items, base],
  );

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 320 }}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 4, left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="variable" tick={{ fontSize: 12 }} width={120} />
          <Tooltip formatter={(value: number) => `$${Number(value).toLocaleString()}`} />
          <ReferenceLine x={0} stroke="var(--border-strong)" />
          <Bar dataKey="swingLow" name="Downside" stackId="swing" fill="var(--color-danger)" />
          <Bar dataKey="swingHigh" name="Upside" stackId="swing">
            {data.map((entry) => (
              <Cell key={entry.variable} fill="var(--color-success)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TornadoChart;
