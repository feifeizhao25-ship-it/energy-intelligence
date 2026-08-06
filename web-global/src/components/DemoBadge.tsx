'use client';

/**
 * DemoBadge — mandatory marker for any figure, list or visualization that
 * is illustrative sample content rather than live data.
 */

import React from 'react';
import { Badge, cn } from '@energy-intelligence/ui-web';

export const DemoBadge: React.FC<{ className?: string }> = ({ className }) => (
  <Badge color="warning" dot className={cn('shrink-0', className)}>
    Demonstration data
  </Badge>
);

export default DemoBadge;
