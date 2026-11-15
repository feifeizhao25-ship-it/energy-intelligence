/**
 * 取消信号要传到国内模型请求上，并且取消之后不再发起下一次调用。
 */
const env = {
  edition: process.env.NEXT_PUBLIC_APP_EDITION,
  app: process.env.APP_EDITION,
  base: process.env.BACKEND_INTERNAL_URL,
  token: process.env.NENGJIAN_INTERNAL_TOKEN,
};
const originalFetch = global.fetch;

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_EDITION = 'cn';
  process.env.APP_EDITION = 'cn';
  process.env.BACKEND_INTERNAL_URL = 'http://model.internal';
  process.env.NENGJIAN_INTERNAL_TOKEN = 'test-token';
});

afterEach(() => {
  restore('NEXT_PUBLIC_APP_EDITION', env.edition);
  restore('APP_EDITION', env.app);
  restore('BACKEND_INTERNAL_URL', env.base);
  restore('NENGJIAN_INTERNAL_TOKEN', env.token);
  global.fetch = originalFetch;
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('simpleChat 把取消信号交给上游，中止后不再发第二次请求', async () => {
  const { simpleChat } = await import('./unified');
  let seen: AbortSignal | undefined;
  global.fetch = jest.fn((_url: string, init?: RequestInit) => {
    seen = init?.signal ?? undefined;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
    });
  }) as typeof fetch;
  const controller = new AbortController();
  const pending = simpleChat('请分析光伏项目', 'deepseek-v3', controller.signal);
  await Promise.resolve();
  expect(seen).toBe(controller.signal);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
