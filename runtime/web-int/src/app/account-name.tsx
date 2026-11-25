'use client';

import { useEffect, useState } from 'react';

export function AccountName() {
  const [name, setName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const stored = localStorage.getItem('auth_user_name') || '';
    if (token && stored) setName(stored);
  }, []);

  if (!name) return <a className="button secondary" href="/login">Sign in</a>;
  return <span data-testid="signed-in-user">Signed in as {name}</span>;
}
