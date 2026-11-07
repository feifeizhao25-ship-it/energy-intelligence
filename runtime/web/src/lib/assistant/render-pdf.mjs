import { createRequire } from 'module';
import { createElement as h } from 'react';

const require = createRequire(import.meta.url);
const { Document, Page, Text, Link, Font, renderToBuffer } = require('@react-pdf/renderer');

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { record, watermark, font } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
if (font) Font.register({ family: 'Droid', src: font });

function linesOf(answer, marked) {
  const lines = [];
  if (answer.synthetic) lines.push('合成测试数据。不是国家能源局、税务机关或其他机构的出版物。');
  if (answer.standIn) lines.push('未调用模型。下面只列资料库命中，不是模型结论。');
  if (marked) lines.push('当前方案的导出文件含水印。');
  lines.push(answer.text);
  for (const [index, source] of answer.sources.entries()) {
    lines.push(`[${index + 1}] ${source.title}`);
    if (source.publisher) lines.push(`发布机构：${source.publisher}`);
    if (source.published_at) lines.push(`日期：${source.published_at}`);
    if (source.url) lines.push(source.url);
    if (source.locator) lines.push(`定位：${source.locator}`);
    if (source.excerpt) lines.push(`摘录：${source.excerpt}`);
    if (source.note) lines.push(source.note);
  }
  lines.push('本文件由软件根据所列来源生成，不是经人工签字的审核结论，也不填写审核人。');
  return lines;
}

const family = font ? 'Droid' : 'Helvetica';
const children = linesOf(record, watermark).map((line, index) => (
  line.startsWith('http://') || line.startsWith('https://')
    ? h(Link, { key: String(index), src: line, style: { marginBottom: 4, color: '#1d4ed8' } }, line)
    : h(Text, { key: String(index), style: { marginBottom: 4 } }, line)
));
const doc = h(Document, null, h(Page, { size: 'A4', style: { fontFamily: family, fontSize: 11, padding: 36, lineHeight: 1.4 } }, children));
const output = await renderToBuffer(doc);
process.stdout.write(output);
