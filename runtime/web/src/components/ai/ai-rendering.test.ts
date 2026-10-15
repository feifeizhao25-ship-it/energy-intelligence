import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('首页不再显示虚构用户头像', () => {
  it.each(['app/page.tsx', 'components/home/social-proof.tsx'])('%s 没有字母头像', (f) => {
    expect(read(f)).not.toMatch(/String\.fromCharCode\(65/);
  });
});

describe('AI 回答用 Markdown + KaTeX 渲染', () => {
  it('组件启用 remark-math + rehype-katex，且未启用 rehype-raw', () => {
    const src = read('components/ai/AiMarkdown.tsx');
    expect(src).toContain('remarkMath');
    expect(src).toContain('rehypeKatex');
    expect(src).toContain("katex/dist/katex.min.css");
    expect(src).not.toContain('rehype-raw');
  });
  it.each(['app/(dashboard)/assistant/page.tsx', 'components/papers/PaperDetailView.tsx'])('%s 使用 AiMarkdown', (f) => {
    expect(read(f)).toContain('<AiMarkdown content={msg.content} />');
  });
});
