'use client';

import React from 'react';

// International edition: English only. The Chinese shell has its own boundary in runtime/web.
type Locale = 'en';

const COPY = {
  en: {
    title: 'This part of the page stopped',
    body: 'The navigation around it is still here. Retry this section, or go back and open it again. The rest of the page is not replaced by a blank screen.',
    retry: 'Retry this section',
  },
} as const;

export function shellFailureCopy(locale: Locale = 'en') {
  return COPY[locale];
}

type Props = { children: React.ReactNode; locale?: Locale };

type State = { error: Error | null };

/** Keeps the surrounding shell mounted when a child render throws. */
export class ShellErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const copy = shellFailureCopy(this.props.locale ?? 'en');
    return (
      <div role="alert" data-testid="shell-error-card" className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-primary)] p-6">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="mt-2 max-w-[460px] text-[13px] leading-relaxed text-[var(--text-secondary)]">{copy.body}</p>
        <button
          type="button"
          className="mt-4 h-8 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 text-[13px]"
          onClick={() => this.setState({ error: null })}
        >
          {copy.retry}
        </button>
      </div>
    );
  }
}

export default ShellErrorBoundary;
