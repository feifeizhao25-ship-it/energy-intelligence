'use client';

import React from 'react';

const COPY = {
  title: '这一块没有显示出来',
  body: '周围的导航还在。请重试这一块，或返回后重新打开。整页不会变成空白。',
  retry: '重试这一块',
};

type State = { error: Error | null };

/** 子组件渲染失败时留下导航，只替换出错的那一块。 */
export class ShellErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" data-testid="shell-error-card" className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-6">
        <h2 className="text-base font-semibold">{COPY.title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[var(--ink-soft)]">{COPY.body}</p>
        <button type="button" className="mt-4 rounded-lg border px-3 py-1.5 text-sm" onClick={() => this.setState({ error: null })}>
          {COPY.retry}
        </button>
      </div>
    );
  }
}

export default ShellErrorBoundary;
