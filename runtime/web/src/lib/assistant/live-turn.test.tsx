import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantComposerButton } from '@/components/assistant/AssistantComposerButton';
import { ASSISTANT_UNREACHABLE_ZH } from './chat-failure';
import {
  applyAssistantStreamEvent,
  assistantSubmitControl,
  pressAssistantComposer,
  runAssistantRequest,
  settleAssistantMessages,
} from './live-turn';

interface Bubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

const greeting: Bubble = { id: '1', role: 'assistant', content: '您好' };

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('等待超时');
}

test('流式过程中停止可以点，取消后离开加载，不留下未知错误', async () => {
  const idle = renderToStaticMarkup(
    <AssistantComposerButton loading={false} draft="" onStop={() => {}} onSend={() => {}} />,
  );
  expect(idle).toContain('发送');
  expect(idle).toContain('disabled');
  expect(assistantSubmitControl(false, '').disabled).toBe(true);

  const streaming = renderToStaticMarkup(
    <AssistantComposerButton loading draft="光伏" onStop={() => {}} onSend={() => {}} />,
  );
  expect(streaming).toContain('data-testid="stop-assistant"');
  expect(streaming).toContain('停止');
  expect(streaming).not.toContain('disabled');
  expect(assistantSubmitControl(true, '').label).toBe('停止');
  expect(assistantSubmitControl(true, '').disabled).toBe(false);

  const user: Bubble = { id: 'user', role: 'user', content: '光伏发电站设计标准' };
  const pending: Bubble = { id: 'ai', role: 'assistant', content: '', isStreaming: true };
  let messages: Bubble[] = [...[greeting, user, pending]];
  let loading = true;
  let error: string | null = null;
  const seen: string[] = [];
  let fetchSignal: AbortSignal | undefined;
  const controller = new AbortController();
  const encoder = new TextEncoder();
  const pendingRequest = runAssistantRequest({
    history: [greeting, user].map((message) => ({ role: message.role, content: message.content })),
    question: user.content,
    signal: controller.signal,
    fetchImpl: ((_url: string, init?: RequestInit) => {
      fetchSignal = init?.signal as AbortSignal | undefined;
      const stream = new ReadableStream({
        start(streamController) {
          streamController.enqueue(encoder.encode('data: {"type":"content","data":"部分回答"}\n\n'));
          init?.signal?.addEventListener('abort', () => {
            streamController.error(abortError());
          });
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    }) as typeof fetch,
    onEvent: (event) => {
      if (event.type === 'content') seen.push(event.content || '');
      messages = applyAssistantStreamEvent(messages, pending.id, event);
    },
  });

  await waitFor(() => seen.includes('部分回答'));
  expect(loading).toBe(true);
  expect(fetchSignal).toBe(controller.signal);
  expect(fetchSignal?.aborted).toBe(false);
  const send = jest.fn();
  pressAssistantComposer({ loading, stop: () => controller.abort(), send });
  expect(send).not.toHaveBeenCalled();

  const outcome = await pendingRequest;
  messages = settleAssistantMessages(messages, pending.id, outcome);
  loading = false;
  error = outcome.aborted ? null : outcome.error;
  expect(outcome).toEqual({ aborted: true, error: null });
  expect(fetchSignal?.aborted).toBe(true);
  expect(loading).toBe(false);
  expect(error).toBeNull();
  expect(messages.map((message) => message.id)).toEqual(['1', 'user']);
  expect(JSON.stringify({ messages, error })).not.toContain('未知错误');
  expect(assistantSubmitControl(loading, '').label).toBe('发送');
});

test('模型还没返回时停止会中止请求，加载状态复位', async () => {
  let fetchSignal: AbortSignal | undefined;
  const controller = new AbortController();
  const pending = runAssistantRequest({
    history: [{ role: 'user', content: '光伏' }],
    question: '光伏',
    signal: controller.signal,
    fetchImpl: ((_url: string, init?: RequestInit) => {
      fetchSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(abortError()));
      });
    }) as typeof fetch,
    onEvent: () => {},
  });
  await Promise.resolve();
  expect(fetchSignal?.aborted).toBe(false);
  pressAssistantComposer({ loading: true, stop: () => controller.abort(), send: () => {} });
  const outcome = await pending;
  const messages = settleAssistantMessages(
    [{ id: 'ai', content: '', isStreaming: true }],
    'ai',
    outcome,
  );
  expect(outcome).toEqual({ aborted: true, error: null });
  expect(fetchSignal?.aborted).toBe(true);
  expect(messages).toEqual([]);
  expect(JSON.stringify(outcome)).not.toContain('未知错误');
});

test('流里的未知错误不会原样进界面', async () => {
  const encoder = new TextEncoder();
  const outcome = await runAssistantRequest({
    history: [{ role: 'user', content: '光伏' }],
    question: '光伏',
    signal: new AbortController().signal,
    fetchImpl: (() => Promise.resolve(new Response(encoder.encode('data: {"type":"error","data":{"message":"未知错误"}}\n\ndata: [DONE]\n\n'), { status: 200 }))) as typeof fetch,
    onEvent: () => {},
  });
  expect(outcome).toEqual({ aborted: false, error: ASSISTANT_UNREACHABLE_ZH });
  expect(outcome.error).not.toContain('未知错误');
});

test('助手页面把停止按钮接到同一次请求的取消上', () => {
  const page = readFileSync(join(__dirname, '../../app/(dashboard)/assistant/page.tsx'), 'utf8');
  expect(page).toContain('AssistantComposerButton');
  expect(page).toContain('runAssistantRequest');
  expect(page).toContain('settleAssistantMessages');
  expect(page).toContain('abortControllerRef.current?.abort()');
  expect(page).toContain('visibleAssistantError');
});
