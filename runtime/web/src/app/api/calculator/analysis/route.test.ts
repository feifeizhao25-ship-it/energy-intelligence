/**
 * 测算解读：模型没叫通、用户取消，都不能把已经扣掉的 AI 次数留下。
 * 退还要能重复调用（取消和失败可能同时走到），净效果仍然只退这一次。
 */
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/ai/unified', () => ({ simpleChat: jest.fn() }));
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

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { simpleChat } from '@/lib/ai/unified';
import { POST } from './route';

const row = (prisma as unknown as { __row: { dailyAiCalls: number; lastResetAt: Date } }).__row;
const chat = simpleChat as jest.Mock;

const payload = {
  type: 'solar',
  data: {
    financial: { irr: 8.5, paybackYears: 6.2, lcoe: 0.35 },
    metadata: { capacity: 100, province: '江苏' },
  },
};

function refused(): Error {
  const error = new TypeError('fetch failed');
  (error as { cause?: unknown }).cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), { code: 'ECONNREFUSED' });
  return error;
}

function post(init: { signal?: AbortSignal } = {}) {
  return POST(new NextRequest('http://x/api/calculator/analysis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: init.signal,
  }));
}

beforeEach(() => {
  row.dailyAiCalls = 0;
  row.lastResetAt = new Date();
  chat.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('后端连不上时失败请求净扣次数为 0，连续两次也是 0', async () => {
  chat.mockRejectedValue(refused());
  const first = await post();
  const second = await post();
  expect(first.status).toBe(500);
  expect(second.status).toBe(500);
  const body = await first.json();
  expect(body.error).toBe('生成分析失败，请稍后重试');
  expect(JSON.stringify(body)).not.toContain('未知错误');
  expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  expect(row.dailyAiCalls).toBe(0);
});

test('失败后退还，重试成功仍然可以调用，并且只扣一次', async () => {
  chat.mockRejectedValueOnce(refused());
  const failed = await post();
  expect(failed.status).toBe(500);
  expect(row.dailyAiCalls).toBe(0);
  chat.mockResolvedValueOnce('建议推进');
  const retried = await post();
  expect(retried.status).toBe(200);
  expect((await retried.json()).results).toBe('建议推进');
  expect(row.dailyAiCalls).toBe(1);
});

test('成功调用只扣一次', async () => {
  chat.mockResolvedValue('三条建议');
  const response = await post();
  expect(response.status).toBe(200);
  expect((await response.json()).results).toBe('三条建议');
  expect(row.dailyAiCalls).toBe(1);
});

test('取消和失败同时发生只退一次，不会把今天已经用掉的次数一起退掉', async () => {
  row.dailyAiCalls = 1;
  let rejectCall: (error: unknown) => void = () => {};
  let started: () => void = () => {};
  const startedP = new Promise<void>((resolve) => { started = resolve; });
  chat.mockImplementation(() => {
    started();
    return new Promise((_resolve, reject) => { rejectCall = reject; });
  });
  const controller = new AbortController();
  const pending = post({ signal: controller.signal });
  await startedP;
  expect(row.dailyAiCalls).toBe(2);
  controller.abort();
  rejectCall(refused());
  const response = await pending;
  expect(response.status).toBe(499);
  expect(row.dailyAiCalls).toBe(1);
  expect(JSON.stringify(await response.json())).not.toContain('未知错误');
});

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

test('进行中的测算解读被取消时，上游收到中止信号，并且只退这一次', async () => {
  let upstream: AbortSignal | undefined;
  let invoked = false;
  chat.mockImplementation((_prompt: string, _model: string, signal?: AbortSignal) => {
    invoked = true;
    upstream = signal;
    if (!signal) return Promise.reject(new Error('上游没有收到取消信号'));
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(abortError()), { once: true });
    });
  });
  const controller = new AbortController();
  const pending = post({ signal: controller.signal });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('模型调用没有开始')), 1000);
    const poll = () => {
      if (invoked) {
        clearTimeout(timer);
        resolve();
        return;
      }
      setTimeout(poll, 0);
    };
    poll();
  });
  expect(row.dailyAiCalls).toBe(1);
  expect(upstream?.aborted).toBe(false);
  controller.abort();
  const response = await pending;
  expect(response.status).toBe(499);
  expect((await response.json()).error).toBe('分析已取消');
  expect(upstream?.aborted).toBe(true);
  expect(row.dailyAiCalls).toBe(0);
});

test('成功返回和取消撞在一起时只退一次，不会把今天已经用掉的次数一起退掉', async () => {
  row.dailyAiCalls = 1;
  let upstream: AbortSignal | undefined;
  let release: (value: string) => void = () => {};
  let invoked = false;
  chat.mockImplementation((_prompt: string, _model: string, signal?: AbortSignal) => {
    invoked = true;
    upstream = signal;
    return new Promise<string>((resolve) => { release = resolve; });
  });
  const controller = new AbortController();
  const pending = post({ signal: controller.signal });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('模型调用没有开始')), 1000);
    const poll = () => {
      if (invoked) {
        clearTimeout(timer);
        resolve();
        return;
      }
      setTimeout(poll, 0);
    };
    poll();
  });
  expect(row.dailyAiCalls).toBe(2);
  release('建议推进');
  controller.abort();
  const response = await pending;
  const body = await response.json();
  expect(JSON.stringify(body)).not.toContain('未知错误');
  expect(response.status).toBe(499);
  expect(body.error).toBe('分析已取消');
  expect(body.results).toBeUndefined();
  expect(upstream?.aborted).toBe(true);
  expect(row.dailyAiCalls).toBe(1);
});

test('成功返回之后连接才断开，不把已经完成的调用退掉', async () => {
  chat.mockResolvedValue('建议推进');
  const controller = new AbortController();
  const response = await post({ signal: controller.signal });
  expect(response.status).toBe(200);
  expect(row.dailyAiCalls).toBe(1);
  controller.abort();
  await Promise.resolve();
  expect(row.dailyAiCalls).toBe(1);
});

test('缺少测算数据时不扣次数', async () => {
  const response = await POST(new NextRequest('http://x/api/calculator/analysis', {
    method: 'POST',
    body: JSON.stringify({ type: 'solar', data: {} }),
  }));
  expect(response.status).toBe(400);
  expect(row.dailyAiCalls).toBe(0);
  expect(chat).not.toHaveBeenCalled();
});
