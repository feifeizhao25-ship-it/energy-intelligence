import 'server-only';

import { libraryStandIn } from './library-fallback';
import { ASSISTANT_UNREACHABLE_ZH, isModelUnconfigured, isModelUnreachable } from './chat-failure';
import type { StoredSource } from './answer-store';

export type ModelFailureReply =
  | { kind: 'library'; text: string; sources: StoredSource[]; synthetic: boolean }
  | { kind: 'message'; message: string };

/**
 * 模型未配置，或国内模型后端连不上：
 * 资料库能列出带来源的回答时，用和「未配置」相同的资料库回答；
 * 连不上且资料库没有命中时，给明确中文，不回「未知错误」。
 * 未配置但没有命中时，仍返回资料库的「没有可引用的来源」。
 * 其他错误返回 null，由调用方用自己的中文兜底。
 * 读资料库要用 Node 的 fs，所以这个函数只能在服务端调用。
 */
export function modelFailureReply(error: unknown, question: string): ModelFailureReply | null {
  const unconfigured = isModelUnconfigured(error);
  const unreachable = isModelUnreachable(error);
  if (!unconfigured && !unreachable) return null;
  try {
    const reply = libraryStandIn(question);
    if (unconfigured || reply.sources.length > 0) return { kind: 'library', ...reply };
  } catch (fallbackError) {
    console.error('资料库兜底失败:', fallbackError);
  }
  return { kind: 'message', message: ASSISTANT_UNREACHABLE_ZH };
}
