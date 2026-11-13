/** 同一份测算结果只打一次分析接口。严格模式会先卸载再挂载，进行中的请求要留下来复用。 */

export const ANALYSIS_UNAVAILABLE_ZH = '分析暂时不可用，请稍后刷新。';

export type AnalysisOutcome = { ok: true; text: string } | { ok: false; message: string };

interface Entry {
  promise: Promise<AnalysisOutcome>;
  controller: AbortController;
  retains: number;
}

const entries = new Map<string, Entry>();
const successes = new Map<string, AnalysisOutcome & { ok: true }>();

export function clearAnalysisRequests(): void {
  for (const entry of entries.values()) entry.controller.abort();
  entries.clear();
  successes.clear();
}

export function analysisKey(type: string, data: unknown): string {
  return JSON.stringify({ type, data });
}

/** 空内容、「未知错误」和英文网络报错都不直接给用户看。 */
export function friendlyAnalysisMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed || trimmed === '未知错误') return ANALYSIS_UNAVAILABLE_ZH;
  if (/API_KEY|ECONN|ETIMEDOUT|ENOTFOUND|fetch failed|failed to fetch|network|socket|AbortError/i.test(trimmed)) {
    return ANALYSIS_UNAVAILABLE_ZH;
  }
  if (trimmed.length > 200 || !/[一-鿿]/.test(trimmed)) return ANALYSIS_UNAVAILABLE_ZH;
  return trimmed;
}

export async function requestCalculatorAnalysis(type: string, data: unknown, signal: AbortSignal): Promise<AnalysisOutcome> {
  try {
    const response = await fetch('/api/calculator/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
      signal,
    });
    const result = await response.json().catch(() => null) as { results?: unknown; error?: unknown; message?: unknown } | null;
    if (response.ok && typeof result?.results === 'string' && result.results.trim()) {
      return { ok: true, text: result.results };
    }
    const raw = typeof result?.message === 'string' ? result.message : typeof result?.error === 'string' ? result.error : '';
    return { ok: false, message: friendlyAnalysisMessage(raw) };
  } catch (error) {
    if (signal.aborted) return { ok: false, message: '分析已取消' };
    const raw = error instanceof Error ? error.message : '';
    return { ok: false, message: friendlyAnalysisMessage(raw) };
  }
}

/**
 * 同一 key 共享一次请求。release 后推迟到微任务再取消，
 * 这样严格模式「卸载再挂载」不会把第一次请求打掉、再发第二次。
 */
export function retainAnalysis(
  key: string,
  start: (signal: AbortSignal) => Promise<AnalysisOutcome>,
): { promise: Promise<AnalysisOutcome>; release: () => void } {
  const cached = successes.get(key);
  if (cached) return { promise: Promise.resolve(cached), release: () => {} };

  let entry = entries.get(key);
  if (!entry) {
    const controller = new AbortController();
    const promise = start(controller.signal).then((outcome) => {
      if (outcome.ok && !controller.signal.aborted) successes.set(key, outcome);
      return outcome;
    }).finally(() => {
      if (entries.get(key)?.promise === promise) entries.delete(key);
    });
    entry = { promise, controller, retains: 0 };
    entries.set(key, entry);
  }
  entry.retains += 1;
  const held = entry;
  let released = false;
  return {
    promise: held.promise,
    release() {
      if (released) return;
      released = true;
      held.retains -= 1;
      if (held.retains > 0) return;
      queueMicrotask(() => {
        if (held.retains === 0 && entries.get(key) === held) {
          held.controller.abort();
          entries.delete(key);
        }
      });
    },
  };
}
