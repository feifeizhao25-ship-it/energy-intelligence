import React from 'react';

const COPY = {
  title: '这一块没有显示出来',
  body: '请重试这一块，或返回首页再打开。整页不会变成空白。',
  retry: '重试这一块',
};

type State = { error: Error | null };

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
      <div role="alert" data-testid="shell-error-card" className="card">
        <h2>{COPY.title}</h2>
        <p>{COPY.body}</p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          {COPY.retry}
        </button>
      </div>
    );
  }
}

export default ShellErrorBoundary;
