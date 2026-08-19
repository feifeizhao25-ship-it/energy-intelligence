'use client';

/**
 * ESGDashboard — avoided emissions and certification progress for a
 * portfolio, backed by verified project data only.
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface ESGYearlyPoint {
  year: number;
  co2AvoidedTons: number;
}

export interface ESGDashboardProps {
  yearly: ESGYearlyPoint[];
  totalCo2AvoidedTons: number;
  renewableSharePct: number;
  certifications?: string[];
}

export const ESGDashboard: React.FC<ESGDashboardProps> = ({
  yearly,
  totalCo2AvoidedTons,
  renewableSharePct,
  certifications = [],
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
        <div className="text-[12px] text-[var(--text-tertiary)]">CO₂ avoided (total)</div>
        <div className="mt-1 text-[22px] font-semibold text-[var(--color-success)]">
          {totalCo2AvoidedTons.toLocaleString()} t
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
        <div className="text-[12px] text-[var(--text-tertiary)]">Renewable share</div>
        <div className="mt-1 text-[22px] font-semibold text-[var(--color-brand-500)]">
          {renewableSharePct.toFixed(1)}%
        </div>
      </div>
    </div>

    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height={300} minWidth={0} initialDimension={{ width: 640, height: 300 }}>
        <BarChart data={yearly} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => [`${Number(value).toLocaleString()} t`, 'CO₂ avoided']} />
          <Bar dataKey="co2AvoidedTons" fill="var(--color-success)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {certifications.length > 0 && (
      <ul className="flex flex-wrap gap-2">
        {certifications.map((certification) => (
          <li
            key={certification}
            className="rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-[12px] font-medium text-[var(--color-success)]"
          >
            {certification}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default ESGDashboard;
