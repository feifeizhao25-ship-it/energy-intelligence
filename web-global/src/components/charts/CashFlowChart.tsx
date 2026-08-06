'use client';

/**
 * CashFlowChart — project cash-flow projection (annual, USD).
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

export interface CashFlowPoint {
  year: number;
  net: number;
  cumulative?: number;
}

export interface CashFlowChartProps {
  data: CashFlowPoint[];
  height?: number;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, height = 320 }) => (
  <div style={{ width: '100%', height }}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 640, height: 320 }}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number) => [`$${Number(value).toLocaleString()}`, 'Net cash flow']}
        />
        <ReferenceLine y={0} stroke="var(--border-strong)" />
        <Bar dataKey="net" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default CashFlowChart;
