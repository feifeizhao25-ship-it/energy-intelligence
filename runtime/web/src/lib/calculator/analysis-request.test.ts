import {
  ANALYSIS_UNAVAILABLE_ZH,
  analysisKey,
  clearAnalysisRequests,
  friendlyAnalysisMessage,
  requestCalculatorAnalysis,
  retainAnalysis,
} from './analysis-request';

const originalFetch = global.fetch;

beforeEach(() => {
  clearAnalysisRequests();
});

afterEach(() => {
  global.fetch = originalFetch;
  clearAnalysisRequests();
});

test('未知错误和英文网络报错换成可以看懂的话', () => {
  expect(friendlyAnalysisMessage('未知错误')).toBe(ANALYSIS_UNAVAILABLE_ZH);
  expect(friendlyAnalysisMessage('')).toBe(ANALYSIS_UNAVAILABLE_ZH);
  expect(friendlyAnalysisMessage('connect ECONNREFUSED 127.0.0.1:8000')).toBe(ANALYSIS_UNAVAILABLE_ZH);
  expect(friendlyAnalysisMessage('fetch failed')).toBe(ANALYSIS_UNAVAILABLE_ZH);
  expect(friendlyAnalysisMessage('生成分析失败，请稍后重试')).toBe('生成分析失败，请稍后重试');
  expect(friendlyAnalysisMessage('今日 AI 次数已用完（5 次），明天恢复或升级会员')).toBe('今日 AI 次数已用完（5 次），明天恢复或升级会员');
});

test('接口带回未知错误时，结果页看到的是友好提示', async () => {
  global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: '未知错误' }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })) as typeof fetch;
  const outcome = await requestCalculatorAnalysis('solar', { financial: { irr: 1 } }, new AbortController().signal);
  expect(outcome).toEqual({ ok: false, message: ANALYSIS_UNAVAILABLE_ZH });
  expect(ANALYSIS_UNAVAILABLE_ZH).not.toContain('未知错误');
});

test('同一份结果只请求一次；严格模式先释放再重新持有不会取消，成功后不再请求', async () => {
  let calls = 0;
  const signals: AbortSignal[] = [];
  const key = analysisKey('solar', { financial: { irr: 8.5 } });
  expect(key).toBe(analysisKey('solar', { financial: { irr: 8.5 } }));
  const start = (signal: AbortSignal) => {
    calls += 1;
    signals.push(signal);
    return Promise.resolve({ ok: true as const, text: '建议推进' });
  };
  const first = retainAnalysis(key, start);
  first.release();
  const second = retainAnalysis(key, start);
  const outcome = await second.promise;
  await Promise.resolve();
  expect(outcome).toEqual({ ok: true, text: '建议推进' });
  expect(calls).toBe(1);
  expect(signals[0]?.aborted).toBe(false);
  await retainAnalysis(key, start).promise;
  expect(calls).toBe(1);
});

test('离开页面会取消还在进行的请求；失败不缓存，回来可以重试', async () => {
  let signal: AbortSignal | undefined;
  const pending = retainAnalysis('leaving', (next) => {
    signal = next;
    return new Promise(() => {});
  });
  pending.release();
  await Promise.resolve();
  expect(signal?.aborted).toBe(true);

  let calls = 0;
  const start = async () => {
    calls += 1;
    return { ok: false as const, message: '生成分析失败，请稍后重试' };
  };
  const failed = retainAnalysis('retry', start);
  await failed.promise;
  failed.release();
  await Promise.resolve();
  await Promise.resolve();
  await retainAnalysis('retry', start).promise;
  expect(calls).toBe(2);
});
