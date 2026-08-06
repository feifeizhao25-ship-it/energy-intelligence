'use client';

/**
 * UserNav — account menu trigger shown in the dashboard header.
 */

import React from 'react';
import Link from 'next/link';

export interface UserNavProps {
  userName?: string;
  email?: string;
}

export const UserNav: React.FC<UserNavProps> = ({ userName = 'Account', email }) => (
  <Link
    href="/settings/profile"
    className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--bg-secondary)]"
  >
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-100)] text-[13px] font-semibold text-[var(--color-brand-600)]">
      {userName.slice(0, 1).toUpperCase()}
    </div>
    <div className="hidden sm:block">
      <p className="text-sm font-medium leading-none">{userName}</p>
      <p className="text-xs leading-none text-muted-foreground">
        {email ?? 'View your profile and security settings'}
      </p>
    </div>
  </Link>
);

export default UserNav;
