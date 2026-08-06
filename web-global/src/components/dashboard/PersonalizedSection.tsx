'use client';
/**
 * PersonalizedSection — dashboard block driven by the personalization
 * backend (GET /api/v1/personalization/daily-layout?persona_id=&day=,
 * contract {"code":0,"data":layout}).
 *
 * Persona resolution: ?persona= / ?day= URL overrides (preview) → default
 * international persona. When the API is unreachable, the persona is
 * unknown, or the payload does not match the contract, an honest empty
 * state is rendered — never a fabricated layout.
 */

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CloudOff, RefreshCw } from 'lucide-react';
import { Badge, Button, Card } from '@energy-intelligence/ui-web';
import EmptyState from '../EmptyState';
import DemoBadge from '../DemoBadge';
import { API_BASE, fetchJson } from '../../lib/config';

const DEFAULT_PERSONA = 'john_smith';

interface HeroCard {
  title?: string;
  headline?: string;
  subtext?: string;
  subline?: string;
  evidence_note?: string;
  evidence_status?: string;
  next_action?: { label?: string; href?: string };
}

interface WidgetCard {
  id?: string;
  priority?: number;
  title?: string;
  summary?: string;
  evidence_status?: string;
}

interface RecommendationCard {
  kind?: string;
  title?: string;
  items?: Array<{ title?: string; href?: string }>;
  evidence_status?: string;
}

interface DailyLayout {
  persona_id?: string;
  display_name?: string;
  day?: number;
  day_stage?: string;
  hero?: HeroCard;
  widgets?: WidgetCard[];
  recommendations?: RecommendationCard[] | RecommendationCard;
  recommendation?: RecommendationCard[] | RecommendationCard;
  evidence_note?: string;
}

function resolvePersonaDay(searchParams: Pick<URLSearchParams, 'get'> | null): { persona: string; day: number } {
  const persona = searchParams?.get('persona') || DEFAULT_PERSONA;
  const parsed = parseInt(searchParams?.get('day') || '', 10);
  const day = parsed >= 1 && parsed <= 7 ? parsed : 1;
  return { persona, day };
}

function toRecommendationList(layout: DailyLayout): RecommendationCard[] {
  const raw = layout.recommendations ?? layout.recommendation;
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter(
    (entry): entry is RecommendationCard =>
      !!entry && typeof entry === 'object' && Array.isArray(entry.items),
  );
}

const PersonalizedSectionContent: React.FC = () => {
  const searchParams = useSearchParams();
  const { persona, day } = resolvePersonaDay(searchParams);

  const [layout, setLayout] = useState<DailyLayout | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const body = (await fetchJson(
        `${API_BASE}/api/v1/personalization/daily-layout?persona_id=${encodeURIComponent(persona)}&day=${day}`,
        { credentials: 'include' },
      )) as { code?: number; data?: DailyLayout };
      if (body?.code !== 0 || !body?.data || typeof body.data !== 'object') {
        throw new Error('daily-layout payload does not match contract');
      }
      setLayout(body.data);
      setStatus('ready');
    } catch {
      setLayout(null);
      setStatus('unavailable');
    }
  }, [persona, day]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === 'loading') {
    return (
      <Card padding="lg">
        <div className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">
          Loading your personalized layout…
        </div>
      </Card>
    );
  }

  if (status === 'unavailable' || !layout) {
    return (
      <EmptyState
        icon={<CloudOff size={22} />}
        title="Personalized layout is not available"
        description="The personalization service cannot be reached, so no tailored briefing is shown. The sample portfolio below is clearly labeled as demonstration data."
        actionLabel="Retry"
        onAction={() => void load()}
      />
    );
  }

  const hero = layout.hero ?? {};
  const widgets = (layout.widgets ?? [])
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const recommendations = toRecommendationList(layout);
  const heroNote = hero.evidence_note ?? layout.evidence_note;

  return (
    <div className="space-y-6">
      {/* ── Hero briefing ── */}
      {(hero.headline || hero.title) && (
        <div className="rounded-[var(--radius-lg)] p-5 text-white bg-gradient-to-br from-[var(--color-brand-600)] to-[#123a8f]">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[12px] font-semibold text-white/70">
              {hero.title ?? 'Daily briefing'}
            </span>
            {layout.display_name && (
              <span className="text-[12px] text-white/60">
                {layout.display_name}
                {layout.day != null ? ` · Day ${layout.day}` : ''}
              </span>
            )}
          </div>
          {hero.headline && (
            <div className="mt-1.5 text-[18px] font-bold leading-snug">{hero.headline}</div>
          )}
          {(hero.subtext ?? hero.subline) && (
            <p className="mt-1.5 text-[13px] text-white/80">{hero.subtext ?? hero.subline}</p>
          )}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {hero.next_action?.href && hero.next_action?.label && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.location.href = hero.next_action!.href!;
                }}
              >
                {hero.next_action.label}
              </Button>
            )}
            {heroNote ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium bg-white/15 text-amber-200">
                {heroNote}
              </span>
            ) : hero.evidence_status === 'demo' ? (
              <DemoBadge />
            ) : null}
          </div>
        </div>
      )}

      {/* ── Personalized widgets ── */}
      {widgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {widgets.map((widget, i) => (
            <Card key={String(widget.id ?? i)} padding="md">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                  {widget.title ?? 'Widget'}
                </span>
                {widget.evidence_status === 'demo' && <DemoBadge />}
              </div>
              {widget.summary && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {widget.summary}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── Recommendations ── */}
      {recommendations.map((rec, i) => (
        <Card
          key={String(rec.kind ?? rec.title ?? i)}
          title={rec.title ?? 'Recommended for you'}
          extra={rec.evidence_status === 'demo' ? <DemoBadge /> : undefined}
          padding="md"
        >
          <div className="divide-y divide-[var(--border-default)]">
            {rec.items!.map((item, j) => (
              <a
                key={`${item.href ?? j}`}
                href={item.href ?? '#'}
                className="flex items-center justify-between py-2.5 text-[13px] font-medium text-[var(--text-primary)] hover:text-[var(--color-brand-600)]"
              >
                {item.title ?? 'Untitled'}
                <span className="text-[var(--text-tertiary)]">→</span>
              </a>
            ))}
          </div>
        </Card>
      ))}

      {widgets.length === 0 && recommendations.length === 0 && !hero.headline && (
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <RefreshCw size={14} />
          No personalized content for this persona today.
          <Badge color="neutral">empty layout</Badge>
        </div>
      )}
    </div>
  );
};

const PersonalizedSection: React.FC = () => (
  <Suspense
    fallback={
      <Card padding="lg">
        <div className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">
          Loading your personalized layout…
        </div>
      </Card>
    }
  >
    <PersonalizedSectionContent />
  </Suspense>
);

export default PersonalizedSection;
