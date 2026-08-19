'use client';

/**
 * PersonalizedHero — greeting banner fed by the personalization backend.
 * Renders nothing but a neutral welcome when no personalized payload exists.
 */

import React from 'react';
import usePersonalizedDashboard from '../../hooks/usePersonalizedDashboard';

export interface PersonalizedHeroProps {
  userId: string | null;
  fallbackName?: string;
}

export const PersonalizedHero: React.FC<PersonalizedHeroProps> = ({ userId, fallbackName }) => {
  const { hero, loading } = usePersonalizedDashboard(userId);

  const headline = hero?.headline ?? (fallbackName ? `Welcome back, ${fallbackName}` : 'Welcome back');

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <h2 className="mb-1 text-xl font-extrabold md:truncate">{headline}</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {hero?.subline ?? 'Your portfolio at a glance.'}
        </p>
      </div>
      <div className="w-full flex-shrink-0 text-left md:w-auto md:text-right">
        <div className="flex items-baseline justify-start gap-1 md:justify-end">
          {loading ? (
            <span className="text-sm text-[var(--text-tertiary)]">Loading…</span>
          ) : (
            (hero?.metrics ?? []).map((metric) => (
              <div key={metric.label} className="mt-1 flex items-center justify-start gap-1 md:justify-end">
                <span className="text-lg font-semibold">{metric.value}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{metric.label}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default PersonalizedHero;
