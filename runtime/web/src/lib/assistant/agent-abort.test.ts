jest.mock('@/lib/ai/router', () => ({
  callAI: jest.fn(),
  isCnEdition: () => true,
}));
jest.mock('@/lib/ai/tool-catalog', () => ({
  modelToolNames: () => [],
}));
jest.mock('@/lib/assistant/tools', () => ({
  assistantToolDefinitions: [],
  handleToolCall: jest.fn(),
}));

import { callAI } from '@/lib/ai/router';
import { assistantChatStream } from './agent';

const model = callAI as jest.Mock;

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

beforeEach(() => {
  model.mockReset();
});

test('助手流把取消信号交给模型，中止后不再继续调用', async () => {
  let seen: AbortSignal | undefined;
  model.mockImplementation((req: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
    seen = req.signal;
    req.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
  }));
  const controller = new AbortController();
  const pending = assistantChatStream(
    [{ role: 'user', content: '光伏发电站设计标准' }],
    'glm-4-plus',
    'u1',
    controller.signal,
  ).next();
  await Promise.resolve();
  expect(model).toHaveBeenCalledTimes(1);
  expect(seen).toBe(controller.signal);
  expect(seen?.aborted).toBe(false);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(model).toHaveBeenCalledTimes(1);
});
