'use client';

/**
 * EmptyState — honest placeholder used whenever backend data is
 * unavailable, an endpoint returns nothing, or a feature is not wired up
 * yet. It never implies data exists when it does not.
 */

import React from 'react';
import { Inbox } from 'lucide-react';
import { Button, cn } from '@energy-intelligence/ui-web';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center px-6 py-12 rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-primary)]',
      className,
    )}
  >
    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-tertiary)] mb-4">
      {icon ?? <Inbox size={22} />}
    </div>
    <div className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</div>
    {description && (
      <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
    )}
    {actionLabel && onAction && (
      <Button variant="secondary" size="sm" className="mt-4" onClick={onAction}>
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
