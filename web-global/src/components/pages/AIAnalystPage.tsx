'use client';
/**
 * EnergyIQ — AI Analyst Page
 *
 * Chat with the AI analyst via POST /api/v1/ai/chat. If the service is
 * unreachable the failure is stated in the thread — no canned answers are
 * ever presented as AI output.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button, Card, cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../GlobalShell';
import EmptyState from '../EmptyState';
import { API_BASE, fetchJson } from '../../lib/config';

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

const SUGGESTIONS = [
  'How does the domestic content bonus affect my ITC rate?',
  'Summarize current PPA price trends in ERCOT.',
  'What should I watch in the interconnection study phase?',
];

function extractReply(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.code === 'number' && body.code !== 0) return null;
  const sources: unknown[] = [body, body.data];
  for (const source of sources) {
    if (source && typeof source === 'object') {
      const record = source as Record<string, unknown>;
      for (const key of ['reply', 'message', 'answer', 'content', 'text']) {
        if (typeof record[key] === 'string' && record[key]) return record[key] as string;
      }
    }
  }
  return null;
}

const AIAnalystPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const conversationId = useRef(`conv-${Date.now().toString(36)}`);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    try {
      const payload = await fetchJson(`${API_BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId.current, message: question }),
      });
      const reply = extractReply(payload);
      if (!reply) throw new Error('unrecognized payload');
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          text: 'The AI analyst service could not be reached, so this question has no answer yet. Please try again later.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <GlobalShell title="AI Analyst" breadcrumb={['EnergyIQ', 'AI Analyst']}>
      <div className="max-w-[820px] mx-auto flex flex-col gap-4 h-full">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">AI Analyst</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Ask about incentives, interconnection, market prices and project economics.
          </p>
        </div>

        <Card padding="lg" className="flex-1 min-h-[320px] flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <EmptyState
                icon={<Sparkles size={22} />}
                title="Start a conversation"
                description="Ask a question below, or try one of these:"
                className="border-0"
              />
            ) : (
              messages.map((message, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13px] leading-relaxed',
                    message.role === 'user' &&
                      'ml-auto bg-[var(--color-brand-500)] text-white',
                    message.role === 'assistant' &&
                      'bg-[var(--bg-secondary)] text-[var(--text-primary)]',
                    message.role === 'system' &&
                      'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
                  )}
                >
                  {message.text}
                </div>
              ))
            )}
            {messages.length === 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 rounded-full border border-[var(--border-default)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--color-brand-500)] hover:text-[var(--color-brand-600)] transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {sending && (
              <div className="text-[12px] text-[var(--text-tertiary)]">Thinking…</div>
            )}
          </div>

          <form
            className="mt-4 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI analyst…"
              aria-label="Ask the AI analyst"
              className="h-10 flex-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--color-brand-500)]"
            />
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={sending || !input.trim()}
              icon={<Send size={14} />}
            >
              Send
            </Button>
          </form>
        </Card>
      </div>
    </GlobalShell>
  );
};

export default AIAnalystPage;
