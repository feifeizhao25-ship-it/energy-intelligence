'use client';

/**
 * SkillOutput — renders the result payload of a Skills API run.
 * Numeric series are charted; everything else is shown as a key/value table.
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

export interface SkillOutputProps {
  skillId: string;
  output: Record<string, unknown> | null;
}

function isNumericSeries(value: unknown): value is Array<{ name: string; value: number }> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        'name' in item &&
        'value' in item &&
        typeof (item as { value: unknown }).value === 'number',
    )
  );
}

export const SkillOutput: React.FC<SkillOutputProps> = ({ skillId, output }) => {
  if (!output) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        No result returned for {skillId}.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(output).map(([key, value]) =>
        isNumericSeries(value) ? (
          <div key={key} style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height={240} minWidth={0} initialDimension={{ width: 640, height: 240 }}>
              <BarChart data={value} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div key={key} className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] pb-2 text-sm">
            <span className="text-[var(--text-secondary)]">{key}</span>
            <span className="text-right font-medium text-[var(--text-primary)]">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ),
      )}
    </div>
  );
};

export default SkillOutput;
