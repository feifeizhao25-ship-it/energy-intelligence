'use client';

/**
 * @energy-intel/ui-components — low-level presentational primitives.
 * Higher-level widgets live in @energy-intelligence/ui-web.
 */

import React from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className,
}) => (
  <hr
    aria-orientation={orientation}
    className={[
      'border-[var(--border-default)]',
      orientation === 'horizontal' ? 'w-full border-t' : 'h-full border-l',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  />
);

export interface SpacerProps {
  size?: number;
  className?: string;
}

export const Spacer: React.FC<SpacerProps> = ({ size = 4, className }) => (
  <div
    aria-hidden
    style={{ width: size * 4, height: size * 4 }}
    className={className}
  />
);

export interface VisuallyHiddenProps {
  children?: React.ReactNode;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children }) => (
  <span
    style={{
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0,
    }}
  >
    {children}
  </span>
);
