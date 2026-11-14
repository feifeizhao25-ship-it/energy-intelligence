/**
 * 助手请求在模型还没返回时取消：上游信号要中止，当天 AI 次数净变化为 0，
 * 成功和取消撞在一起时也不能把同一次调用退两次。
 */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/membership/usage', () => ({ logUsage: jest.fn(async () => undefined) }));
jest.mock('@/lib/prisma', () => {
  const row = {
    plan: 'FREE',
    planExpireAt: null as Date | null,
    dailyAiCalls: 0,
    dailyCalculations: 0,
    dailyResourceQueries: 0,
    dailyPaperSearches: 0,
    dailyDiagnoses: 0,
    lastResetAt: new Date(),
    deletedAt: null as Date | null,
  };
  const apply = (data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) {
        (row as Record<string, number>)[key] += (value as { increment: number }).increment;
      } else if (value && typeof value === 'object' && 'decrement' in value) {
        (row as Record<string, number>)[key] -= (value as { decrement: number }).decrement;
      } else {
        (row as Record<string, unknown>)[key] = value;
      }
    }
  };
  const matches = (where: { deletedAt?: null; dailyAiCalls?: { lt?: number; gt?: number }; lastResetAt?: Date } | undefined) => {
    if (!where) return true;
    if (where.deletedAt === null && row.deletedAt) return false;
    if (where.dailyAiCalls?.lt != null && !(row.dailyAiCalls < where.dailyAiCalls.lt)) return false;
    if (where.dailyAiCalls?.gt != null && !(row.dailyAiCalls > where.dailyAiCalls.gt)) return false;
    if (where.lastResetAt && new Date(where.lastResetAt).getTime() !== new Date(row.lastResetAt).getTime()) return false;
    return true;
  };
  const user = {
    findFirst: async () => (row.deletedAt ? null : { ...row, lastResetAt: new Date(row.lastResetAt) }),
    update: async ({ data }: { data: Record<string, unknown> }) => { apply(data); return { ...row }; },
    updateMany: async ({ where, data }: { where?: Parameters<typeof matches>[0]; data: Record<string, unknown> }) => {
      if (!matches(where)) return { count: 0 };
      apply(data);
      return { count: 1 };
    },
  };
  return {
    prisma: {
      user,
      __row: row,
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ user, $executeRaw: async () => 1 }),
    },
  };
});

type StreamEvent = { type: string; data: unknown };
var assistantStream: (...args: unknown[]) => AsyncGenerator<StreamEvent> = async function* () {
  yield { type: 'text', data: '' };
};
jest.mock('@/lib/assistant/agent', () => ({
  assistantChatStream: (...args: unknown[]) => assistantStream(...args),
}));
jest.mock('@/lib/ai/unified', () => ({
  aiService: { getAIProvider: () => 'none', chatStream: async function* () { yield { type: 'content', data: '' }; } },
}));

import { prisma } from '@/lib/prisma';
import { POST } from './route';

const row = (prisma as unknown as { __row: { dailyAiCalls: number; lastResetAt: Date } }).__row;

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function post(signal?: AbortSignal) {
  return POST(new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isAssistant: true, messages: [{ role: 'user', content: '光伏发电站设计标准' }] }),
    signal,
  }) as never);
}

beforeEach(() => {
  row.dailyAiCalls = 0;
  row.lastResetAt = new Date();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('取消进行中的助手请求会中止上游，当天 AI 次数净变化为 0，响应里没有未知错误', async () => {
  let upstream: AbortSignal | undefined;
  let started: () => void = () => {};
  const startedP = new Promise<void>((resolve) => { started = resolve; });
  assistantStream = async function* (_messages, _model, _userId, signal) {
    upstream = signal as AbortSignal | undefined;
    started();
    if (!signal) throw new Error('上游没有收到取消信号');
    await new Promise((_resolve, reject) => {
      (signal as AbortSignal).addEventListener('abort', () => reject(abortError()), { once: true });
    });
    yield { type: 'text', data: '晚到的回答' };
  };
  const controller = new AbortController();
  const pending = post(controller.signal);
  await startedP;
  expect(row.dailyAiCalls).toBe(1);
  expect(upstream?.aborted).toBe(false);
  controller.abort();
  const raw = await (await pending).text();
  expect(upstream?.aborted).toBe(true);
  expect(raw).not.toContain('晚到的回答');
  expect(raw).not.toContain('未知错误');
  expect(row.dailyAiCalls).toBe(0);
});

test('模型即将成功时取消，只退一次，不会把今天已经用掉的次数一起退掉', async () => {
  row.dailyAiCalls = 1;
  let upstream: AbortSignal | undefined;
  let started: () => void = () => {};
  let release: () => void = () => {};
  const startedP = new Promise<void>((resolve) => { started = resolve; });
  assistantStream = async function* (_messages, _model, _userId, signal) {
    upstream = signal as AbortSignal | undefined;
    started();
    await new Promise<void>((resolve) => { release = resolve; });
    if ((signal as AbortSignal | undefined)?.aborted) throw abortError();
    yield { type: 'text', data: '成功回答' };
  };
  const controller = new AbortController();
  const pending = post(controller.signal);
  await startedP;
  expect(row.dailyAiCalls).toBe(2);
  release();
  controller.abort();
  const raw = await (await pending).text();
  expect(raw).not.toContain('成功回答');
  expect(raw).not.toContain('未知错误');
  expect(upstream?.aborted).toBe(true);
  expect(row.dailyAiCalls).toBe(1);
});

test('回答已经交付之后再取消，不退还这一次', async () => {
  assistantStream = async function* () {
    yield { type: 'text', data: '按已收录标准复述。' };
  };
  const controller = new AbortController();
  const response = await post(controller.signal);
  const raw = await response.text();
  expect(raw).toContain('按已收录标准复述。');
  expect(raw).not.toContain('未知错误');
  expect(row.dailyAiCalls).toBe(1);
  controller.abort();
  await Promise.resolve();
  expect(row.dailyAiCalls).toBe(1);
});
