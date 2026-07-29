'use client';

/**
 * @energy-intelligence/ui-web — shared UI primitives.
 *
 * Theming is driven by CSS variables (see lib/design-system tokens) so the
 * same components render correctly for both the CN and global frontends.
 */

import React, { useState } from 'react';

// ── cn ─────────────────────────────────────────────────

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ── Button ─────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const BUTTON_VARIANTS: Record<string, string> = {
  primary:
    'bg-[var(--color-brand-500)] text-white hover:bg-[var(--color-brand-600)]',
  secondary:
    'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]',
  ghost: 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]',
};

const BUTTON_SIZES: Record<string, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-[14px]',
  lg: 'h-11 px-5 text-[15px]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] font-medium transition-colors cursor-pointer disabled:opacity-50',
      BUTTON_VARIANTS[variant],
      BUTTON_SIZES[size],
      fullWidth && 'w-full',
      className,
    )}
    {...rest}
  >
    {icon}
    {children}
    {iconRight}
  </button>
);

// ── Input ──────────────────────────────────────────────

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ icon, className, ...rest }) => (
  <div className="relative inline-flex items-center w-full">
    {icon && (
      <span className="absolute left-3 text-[var(--text-tertiary)]">{icon}</span>
    )}
    <input
      className={cn(
        'h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-brand-500)]',
        icon && 'pl-9',
        className,
      )}
      {...rest}
    />
  </div>
);

// ── Card ───────────────────────────────────────────────

export interface CardProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

const CARD_PADDING: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export const Card: React.FC<CardProps> = ({
  title,
  extra,
  padding = 'md',
  className,
  children,
}) => (
  <section
    className={cn(
      'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-primary)]',
      CARD_PADDING[padding],
      className,
    )}
  >
    {(title || extra) && (
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        {extra}
      </header>
    )}
    {children}
  </section>
);

// ── Badge ──────────────────────────────────────────────

export type BadgeColor =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export interface BadgeProps {
  color?: BadgeColor;
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const BADGE_COLORS: Record<BadgeColor, string> = {
  brand: 'bg-[var(--color-brand-50)] text-[var(--color-brand-600)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  neutral: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]',
};

export const Badge: React.FC<BadgeProps> = ({
  color = 'neutral',
  dot,
  className,
  children,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium',
      BADGE_COLORS[color],
      className,
    )}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

// ── SegmentedControl ───────────────────────────────────

export interface SegmentedOption {
  label: React.ReactNode;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  className,
}) => (
  <div
    role="tablist"
    className={cn(
      'inline-flex items-center gap-0.5 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] p-0.5',
      className,
    )}
  >
    {options.map((option) => (
      <button
        key={option.value}
        role="tab"
        aria-selected={option.value === value}
        onClick={() => onChange(option.value)}
        className={cn(
          'rounded-[calc(var(--radius-md)-2px)] font-medium transition-colors cursor-pointer',
          size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
          option.value === value
            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

// ── Switch ─────────────────────────────────────────────

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled,
  className,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative h-5 w-9 rounded-full transition-colors cursor-pointer disabled:opacity-50',
      checked ? 'bg-[var(--color-brand-500)]' : 'bg-[var(--border-strong)]',
      className,
    )}
  >
    <span
      className={cn(
        'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
        checked ? 'left-[18px]' : 'left-0.5',
      )}
    />
  </button>
);

// ── Pagination ─────────────────────────────────────────

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onChange,
  className,
}) => (
  <nav
    aria-label="pagination"
    className={cn('flex items-center gap-2 text-[13px]', className)}
  >
    <Button
      variant="secondary"
      size="sm"
      disabled={page <= 1}
      onClick={() => onChange(page - 1)}
    >
      ‹
    </Button>
    <span className="text-[var(--text-secondary)]">
      {page} / {Math.max(totalPages, 1)}
    </span>
    <Button
      variant="secondary"
      size="sm"
      disabled={page >= totalPages}
      onClick={() => onChange(page + 1)}
    >
      ›
    </Button>
  </nav>
);

// ── SearchBox ──────────────────────────────────────────

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  value,
  onChange,
  placeholder,
  className,
}) => (
  <Input
    type="search"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className={className}
    icon={
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    }
  />
);

// ── KPIRibbon / StatCard ───────────────────────────────

export interface KPIItem {
  label: string;
  value: string;
  unit?: string;
  trend?: { value: number; positive: boolean };
  color?: string;
}

export interface KPIRibbonProps {
  items: KPIItem[];
  className?: string;
}

export const KPIRibbon: React.FC<KPIRibbonProps> = ({ items, className }) => (
  <div className={cn('grid gap-4', className)}>
    {items.map((item) => (
      <StatCard key={item.label} {...item} />
    ))}
  </div>
);

export interface StatCardProps extends KPIItem {
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  trend,
  color,
  icon,
  className,
}) => (
  <Card padding="md" className={className}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[12px] text-[var(--text-tertiary)]">{label}</div>
        <div
          className="mt-1 text-[22px] font-semibold"
          style={color ? { color } : undefined}
        >
          {value}
          {unit && (
            <span className="ml-1 text-[13px] font-normal text-[var(--text-tertiary)]">
              {unit}
            </span>
          )}
        </div>
        {trend && (
          <div
            className={cn(
              'mt-1 text-[12px]',
              trend.positive
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-danger)]',
            )}
          >
            {trend.positive ? '▲' : '▼'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      {icon}
    </div>
  </Card>
);

// ── Progress ───────────────────────────────────────────

export interface ProgressProps {
  value: number;
  className?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, className }) => (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    className={cn(
      'h-1.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]',
      className,
    )}
  >
    <div
      className="h-full rounded-full bg-[var(--color-brand-500)] transition-all"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

export { AppShell, TopBar } from './AppShell';
export type { AppShellProps, TopBarProps, SidebarItem } from './AppShell';
