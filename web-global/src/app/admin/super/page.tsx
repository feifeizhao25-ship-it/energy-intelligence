'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function SuperAdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center p-6">
      <section className="w-full max-w-xl rounded-2xl border border-amber-500/30 bg-slate-900 p-8 shadow-2xl">
        <ShieldAlert className="h-10 w-10 text-amber-400" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-semibold">Legacy admin view disabled</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          This route previously displayed synthetic users, revenue and uptime. It has been
          disabled so unverified operational data cannot be presented in production.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300"
        >
          Open the verified admin console
        </Link>
      </section>
    </main>
  );
}
