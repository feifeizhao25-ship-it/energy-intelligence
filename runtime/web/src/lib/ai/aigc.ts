import { NextResponse } from 'next/server';

/**
 * AI 生成合成内容标识（《人工智能生成合成内容标识办法》）。
 *
 * - 显式标识：页面上让用户看得见（AigcLabel 组件，文案取自这里的常量）。
 * - 隐式标识：接口响应里带元数据 aigc 字段与 X-AIGC-Generated 响应头，下载/转存时可追溯；
 *   文本流（SSE）在开头事件里带上同样的元数据。
 *
 * 原来用户条款里写了「AI 生成内容可能包含显式及隐式标识」，但页面和接口里一处标识都没有。
 */
export const AIGC_LABEL = '内容由人工智能生成，仅供参考，请自行核实后使用';
export const AIGC_SHORT_LABEL = 'AI 生成';
export const AIGC_HEADER = 'X-AIGC-Generated';

export interface AigcMeta {
  generated: true;
  label: string;
  service: string;
  model?: string;
  generatedAt: string;
}

export function aigcMeta(model?: string, now: Date = new Date()): AigcMeta {
  return { generated: true, label: AIGC_LABEL, service: '新能源智库 AI 助手', ...(model ? { model } : {}), generatedAt: now.toISOString() };
}

/** 带隐式标识的 JSON 响应：body 里加 aigc 字段，响应头加 X-AIGC-Generated。 */
export function aigcJson<T extends object>(body: T, init: ResponseInit & { model?: string } = {}): NextResponse {
  const { model, headers, ...rest } = init;
  const merged = new Headers(headers);
  merged.set(AIGC_HEADER, '1');
  return NextResponse.json({ ...body, aigc: aigcMeta(model) }, { ...rest, headers: merged });
}
