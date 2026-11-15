import { safeErrorMessage } from '@/lib/api/safe-error';
import type { StoredSource } from '@/lib/assistant/answer-store';
import { ASSISTANT_UNREACHABLE_ZH, isAbortError, visibleAssistantError } from '@/lib/assistant/chat-failure';
import type { EvidenceVerification } from '@/lib/evidence/verification';

export interface AssistantStreamEvent {
  type: 'provider' | 'content' | 'evidence';
  model?: string;
  question?: string;
  content?: string;
  verification?: EvidenceVerification;
  sources?: StoredSource[];
  answerId?: string | null;
  standIn?: boolean;
  synthetic?: boolean;
  downloads?: { pdf: boolean; docx: boolean };
}

export interface AssistantTurnOutcome {
  aborted: boolean;
  error: string | null;
}

export interface AssistantSubmitControl {
  label: '停止' | '发送';
  disabled: boolean;
}

/** 生成过程中按钮是「停止」，并且可以点。空草稿时「发送」不可点。 */
export function assistantSubmitControl(loading: boolean, draft: string): AssistantSubmitControl {
  if (loading) return { label: '停止', disabled: false };
  return { label: '发送', disabled: draft.trim().length === 0 };
}

export function pressAssistantComposer(args: { loading: boolean; stop: () => void; send: () => void }): void {
  if (args.loading) args.stop();
  else args.send();
}

export function applyAssistantStreamEvent<T extends { id: string; content: string }>(
  messages: T[],
  pendingId: string,
  event: AssistantStreamEvent,
): T[] {
  return messages.map((message) => {
    if (message.id !== pendingId) return message;
    if (event.type === 'content') return { ...message, content: message.content + (event.content || '') };
    if (event.type === 'provider') return { ...message, model: event.model, question: event.question } as T;
    return {
      ...message,
      verification: event.verification,
      sources: event.sources,
      answerId: event.answerId,
      standIn: event.standIn,
      synthetic: event.synthetic,
      downloads: event.downloads,
    } as T;
  });
}

/** 取消或失败时去掉还在转圈的气泡；成功时结束流式状态。 */
export function settleAssistantMessages<T extends { id: string }>(
  messages: T[],
  pendingId: string,
  outcome: AssistantTurnOutcome,
): T[] {
  if (outcome.aborted || outcome.error) return messages.filter((message) => message.id !== pendingId);
  return messages.map((message) => (message.id === pendingId ? { ...message, isStreaming: false } as T : message));
}

export async function runAssistantRequest(options: {
  history: { role: string; content: string }[];
  question: string;
  signal: AbortSignal;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  onEvent: (event: AssistantStreamEvent) => void;
}): Promise<AssistantTurnOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const { signal } = options;
  try {
    const response = await fetchImpl(options.endpoint ?? '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: options.history, isAssistant: true }),
      signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: unknown } | null;
      const message = typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : 'AI 服务暂时不可用';
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let streamError: string | null = null;
    if (reader) {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { type?: string; data?: any };
            if (parsed.type === 'provider') {
              options.onEvent({ type: 'provider', model: parsed.data?.model, question: options.question });
            } else if (parsed.type === 'evidence') {
              options.onEvent({
                type: 'evidence',
                verification: parsed.data?.verification,
                sources: Array.isArray(parsed.data?.sources) ? parsed.data.sources : [],
                answerId: parsed.data?.answerId ?? null,
                standIn: Boolean(parsed.data?.standIn),
                synthetic: Boolean(parsed.data?.synthetic),
                downloads: parsed.data?.downloads || { pdf: true, docx: false },
              });
            } else if (parsed.type === 'content') {
              const piece = String(parsed.data || '');
              accumulatedContent += piece;
              options.onEvent({ type: 'content', content: piece });
            } else if (parsed.type === 'error') {
              streamError = visibleAssistantError(String(parsed.data?.message || ''));
            }
          } catch {
            // 忽略半包或无法解析的事件
          }
        }
      }
    }

    if (signal.aborted) return { aborted: true, error: null };
    if (streamError && !accumulatedContent) return { aborted: false, error: streamError };
    return { aborted: false, error: null };
  } catch (error) {
    if (signal.aborted || isAbortError(error)) return { aborted: true, error: null };
    return { aborted: false, error: visibleAssistantError(safeErrorMessage(error, ASSISTANT_UNREACHABLE_ZH)) };
  }
}
