'use client';

/**
 * RevenueComparisonChart — side-by-side annual revenue across scenarios.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface RevenueScenario {
  name: string;
  p50: number;
  p90?: number;
}

export interface RevenueComparisonChartProps {
  data: RevenueScenario[];
  height?: number;
}

export const RevenueComparisonChart: React.FC<RevenueComparisonChartProps> = ({
  data,
  height = 320,
}) => (
  <div style={{ width: '100%', height }}>
    <ResponsiveContainer width="100%" height={height} minWidth={0} initialDimension={{ width: 640, height }}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number) => `$${Number(value).toLocaleString()}`} />
        <Legend />
        <Bar dataKey="p50" name="P50 revenue" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="p90" name="P90 revenue" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default RevenueComparisonChart;
