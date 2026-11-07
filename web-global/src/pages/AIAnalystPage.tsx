'use client';
/**
 * EnergyIQ — AI Analyst Page
 *
 * Chat with the AI analyst via POST /api/v1/ai/chat-json (JSON body plus the
 * stored login token). The streaming /api/v1/ai/chat route is a different
 * contract and is not used here. If the service is unreachable the failure is
 * stated in the thread — no canned answers are ever presented as AI output.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { AnalystMic, AnalystSpeaker } from '../components/voice/AnalystVoice';
import { Button, Card, cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../components/GlobalShell';
import EmptyState from '../components/EmptyState';
import {
  AnalystReply,
  AnalystSource,
  clipboardAnswer,
  downloadAnalystAnswer,
  postAnalystChat,
} from '../lib/ai/analystChat';

interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  reply?: AnalystReply;
}

function reviewNote(source: AnalystSource): string | null {
  if (source.evidence_status === 'auto_extracted') {
    return 'Machine extract, not a human-reviewed publication.';
  }
  if (source.evidence_status === 'legacy_unreviewed') {
    return 'Review status is not recorded as a human review.';
  }
  if (source.evidence_status === 'pending' || source.status === '待核实' || source.status === '待审核') {
    return 'Not published: pending review.';
  }
  return null;
}

const AnswerSources: React.FC<{ reply: AnalystReply }> = ({ reply }) => {
  const [copied, setCopied] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState('');

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(clipboardAnswer(reply.text, reply.sources));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function download(format: 'pdf' | 'docx') {
    if (!reply.answerId) return;
    setDownloadError('');
    try {
      const blob = await downloadAnalystAnswer(reply.answerId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `answer-${reply.answerId}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed');
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border-default)] pt-2" data-testid="answer-sources">
      {reply.standIn && (
        <p className="text-[12px] text-[var(--color-warning)]">
          Model provider is not connected. This text is the library record or the no-source reply, not a signed model answer.
        </p>
      )}
      {reply.synthetic && (
        <p className="text-[12px] font-semibold text-[var(--color-danger)]">
          SYNTHETIC TEST DATA. Not a real NEA, IRS, or government publication.
        </p>
      )}
      {reply.sources.length > 0 && (
        <ul className="space-y-2">
          {reply.sources.map((source, index) => (
            <li key={`${source.title}-${index}`} className="text-[12px] leading-relaxed break-words">
              <span className="font-medium text-[var(--text-primary)]">[{index + 1}] {source.title}</span>
              {source.publisher && <span className="block text-[var(--text-secondary)]">{source.publisher}</span>}
              {source.published_at && <span className="block text-[var(--text-secondary)]">Published {source.published_at}</span>}
              {source.url && (
                <a className="block break-all text-[var(--color-brand-600)]" href={source.url}>
                  {source.url}
                </a>
              )}
              {source.locator && <span className="block">Locator: {source.locator}</span>}
              {source.excerpt && <span className="block whitespace-pre-wrap">Excerpt: {source.excerpt}</span>}
              {source.freshness_status && <span className="block">Freshness: {source.freshness_status}</span>}
              {reviewNote(source) && <span className="block">{reviewNote(source)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border border-[var(--border-default)] px-2 py-1 text-[12px]" onClick={() => void copyAll()}>
          {copied ? 'Copied with sources' : 'Copy answer and sources'}
        </button>
        {reply.downloads.pdf && reply.answerId && (
          <button type="button" className="rounded border border-[var(--border-default)] px-2 py-1 text-[12px]" onClick={() => void download('pdf')}>
            Download PDF
          </button>
        )}
        {reply.answerId && (
          <button type="button" className="rounded border border-[var(--border-default)] px-2 py-1 text-[12px]" onClick={() => void download('docx')}>
            Download Word
          </button>
        )}
        {!reply.downloads.docx && (
          <span className="text-[12px] text-[var(--text-tertiary)]">Word export is not included in this plan.</span>
        )}
      </div>
      {downloadError && <p className="text-[12px] text-[var(--color-danger)]" data-testid="download-error">{downloadError}</p>}
    </div>
  );
};

const SUGGESTIONS = [
  'How does the domestic content bonus affect my ITC rate?',
  'Summarize current PPA price trends in ERCOT.',
  'What should I watch in the interconnection study phase?',
];

const AIAnalystPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    try {
      const reply = await postAnalystChat(question);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply.text, reply }]);
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
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  {message.reply && <AnswerSources reply={message.reply} />}
                  {message.role !== 'user' && <AnalystSpeaker id={`bubble-${i}`} text={message.text} />}
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
            <AnalystMic
              disabled={sending}
              onTranscript={(text) => {
                const heard = text.trim();
                if (!heard) return;
                setInput((prev) => {
                  const base = prev.trim();
                  return base ? `${base} ${heard}` : heard;
                });
              }}
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
