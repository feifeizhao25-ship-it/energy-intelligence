/**
 * AIChatPage — 国内版 AI 问答页。
 *
 * 与后端 /api/chat 接口对话,支持流式刷新(简化为整段返回)、
 * 引用来源(citations)展示与追问输入。
 */

import React, { useCallback, useRef, useState } from 'react';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface Citation {
  title: string;
  source: string;
  snippet: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8002';

async function askBackend(question: string): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, locale: 'zh-CN' }),
  });
  if (!response.ok) {
    throw new Error(`问答接口返回 ${response.status}`);
  }
  const payload = await response.json();
  return {
    role: 'assistant',
    content: payload.answer ?? '',
    citations: payload.citations ?? [],
  };
}

const CitationCard: React.FC<{ citation: Citation }> = ({ citation }) => (
  <li className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{citation.title}</span>
      <span className="text-[11px] text-[var(--text-tertiary)]">{citation.source}</span>
    </div>
    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
      {citation.snippet}
    </p>
  </li>
);

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || sending) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    try {
      const answer = await askBackend(question);
      setMessages((prev) => [...prev, answer]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `抱歉,问答服务暂时不可用:${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    }
  }, [input, sending]);

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-default)] px-4 py-3">
        <h1 className="text-[16px] font-semibold text-[var(--text-primary)]">新能源智库 · AI 问答</h1>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="mt-16 text-center text-[13px] text-[var(--text-tertiary)]">
            输入问题,例如「2026 年分布式光伏补贴政策有哪些变化?」
          </p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                message.role === 'user'
                  ? 'max-w-[80%] rounded-2xl bg-[var(--color-brand-500)] px-4 py-2 text-[14px] text-white'
                  : 'max-w-[85%] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-[14px] text-[var(--text-primary)]'
              }
            >
              {message.role === 'user' ? (
                message.content
              ) : (
                <>
                  <MarkdownRenderer content={message.content} />
                  {message.citations && message.citations.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {message.citations.map((citation, i) => (
                        <CitationCard key={i} citation={citation} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <p className="text-[12px] text-[var(--text-tertiary)]">正在生成回答…</p>
        )}
      </div>

      <footer className="border-t border-[var(--border-default)] px-4 py-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入你的问题…"
            className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[14px] focus:outline-none focus:border-[var(--color-brand-500)]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-10 rounded-[var(--radius-md)] bg-[var(--color-brand-500)] px-4 text-[14px] font-medium text-white disabled:opacity-50"
          >
            发送
          </button>
        </form>
      </footer>
    </div>
  );
}
