import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

import { gazetteBuffer } from '@/lib/reports/ooxml-zip';

import type { StoredAnswer } from './answer-store';

const FONT = '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf';
const RENDER_SCRIPT = path.resolve(process.cwd(), 'src/lib/assistant/render-pdf.mjs');

export function answerLines(record: StoredAnswer, watermark: boolean): string[] {
  const lines: string[] = [];
  if (record.synthetic) lines.push('合成测试数据。不是国家能源局、税务机关或其他机构的出版物。');
  if (record.standIn) lines.push('未调用模型。下面只列资料库命中，不是模型结论。');
  if (watermark) lines.push('当前方案的导出文件含水印。');
  lines.push(record.text);
  record.sources.forEach((source, index) => {
    lines.push(`[${index + 1}] ${source.title}`);
    if (source.publisher) lines.push(`发布机构：${source.publisher}`);
    if (source.published_at) lines.push(`日期：${source.published_at}`);
    if (source.url) lines.push(source.url);
    if (source.locator) lines.push(`定位：${source.locator}`);
    if (source.excerpt) lines.push(`摘录：${source.excerpt}`);
    if (source.note) lines.push(source.note);
  });
  lines.push('本文件由软件根据所列来源生成，不是经人工签字的审核结论，也不填写审核人。');
  return lines;
}

export function renderAnswerDocx(record: StoredAnswer, watermark: boolean): Buffer {
  return gazetteBuffer('回答来源', answerLines(record, watermark).map((line) => [line]));
}

export function renderAnswerPdf(record: StoredAnswer, watermark: boolean): Promise<Buffer> {
  const font = existsSync(FONT) ? FONT : '';
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RENDER_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(Buffer.concat(err).toString('utf8') || `pdf renderer exited ${code}`));
    });
    child.stdin.end(JSON.stringify({ record, watermark, font }));
  });
}
