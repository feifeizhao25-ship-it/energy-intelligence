'use client';

/**
 * EnergyGenerationChart — monthly energy generation profile (MWh).
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface GenerationPoint {
  month: string;
  mwh: number;
}

export interface EnergyGenerationChartProps {
  data: GenerationPoint[];
  height?: number;
}

export const EnergyGenerationChart: React.FC<EnergyGenerationChartProps> = ({
  data,
  height = 320,
}) => (
  <div style={{ width: '100%', height }}>
    <ResponsiveContainer width="100%" height={height} minWidth={0} initialDimension={{ width: 640, height }}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number) => [`${Number(value).toLocaleString()} MWh`, 'Generation']} />
        <Area
          type="monotone"
          dataKey="mwh"
          stroke="var(--color-brand-500)"
          fill="var(--color-brand-100)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default EnergyGenerationChart;
