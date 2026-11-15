import { layoutClauses } from '@/lib/reports/ooxml-zip';

import { renderAnswerDocx } from './answer-file';

const LONG_BASIS = '通知第二条：投产时间在2025年10月31日前的，机制电价自2025年11月1日起执行；其余自竞价时申报的投产时间起执行。页面时间：2025-12-12 11:25:59。落款：2025年12月10日。';

function documentXml(docx: Buffer): string {
  const text = docx.toString('utf8');
  const start = text.indexOf('<w:document');
  const end = text.indexOf('</w:document>') + '</w:document>'.length;
  return text.slice(start, end);
}

test('含日期的长句按标点拆开，日期本身留在同一段', () => {
  const line = `生效日：原文未写单一施行日。${LONG_BASIS}`;
  const clauses = layoutClauses(line);
  expect(clauses.join('')).toBe(line);
  for (const clause of clauses) expect(Array.from(clause).length).toBeLessThanOrEqual(28);
  expect(clauses.some((clause) => clause.includes('2025年11月1日'))).toBe(true);
  expect(clauses.some((clause) => clause.includes('2025年11月') && !clause.includes('2025年11月1日'))).toBe(false);
});

test('来源标题只跟下一段留在同页，长来源可以按段落换页', () => {
  const docx = renderAnswerDocx({
    id: 'layout',
    userId: 'owner',
    text: '未调用模型。下面只列资料库命中，不是模型结论。',
    standIn: true,
    synthetic: false,
    createdAt: 0,
    sources: [
      {
        title: '关于公布2025年新能源项目机制电价竞价结果的通知（粤发改价格函〔2025〕2137号）',
        publisher: '广东省发展和改革委员会',
        issuer: '广东省发展改革委 广东省能源局',
        date_kind: 'page_release',
        published_at: '2025-12-12',
        sign_date: '2025-12-10',
        effective_date_stated: false,
        effective_date_basis: LONG_BASIS,
        url: 'https://drc.gd.gov.cn/ywtz/content/post_4828493.html',
        note: '审核：机器摘录，未经人工复核，不是已发布文本。',
      },
      {
        title: '关于开展2026年新能源项目机制电价竞价工作有关事项的通知（粤发改价格函〔2026〕1805号）',
        publisher: '广东省发展和改革委员会',
        url: 'https://drc.gd.gov.cn/ywtz/content/post_4965021.html',
        note: '审核：机器摘录，未经人工复核，不是已发布文本。',
      },
    ],
  }, true);
  const xml = documentXml(docx);
  expect(xml).toContain('w:w="11906"');
  expect(xml).toContain('w:h="16838"');
  expect(xml).toContain('未调用模型');
  expect(xml).toContain('不是经人工签字');
  expect(xml).not.toContain('cantSplit');
  expect(xml).not.toContain('<w:tbl>');
  const paragraphs = xml.split('<w:p>').slice(1);
  for (const marker of ['[1]', '[2]']) {
    const titleAt = paragraphs.findIndex((paragraph) => paragraph.includes(marker));
    expect(titleAt).toBeGreaterThan(-1);
    expect(paragraphs[titleAt]).toContain('<w:keepNext/>');
    expect(paragraphs[titleAt + 1]).toContain('发布机构');
    expect(paragraphs[titleAt + 1]).not.toContain('<w:keepNext/>');
  }
  const review = paragraphs.find((paragraph) => paragraph.includes('机器摘录'));
  expect(review).toBeTruthy();
  expect(review).not.toContain('<w:keepNext/>');
  expect(xml).toContain('https://drc.gd.gov.cn/ywtz/content/post_4828493.html');
  expect(xml).toContain('https://drc.gd.gov.cn/ywtz/content/post_4965021.html');
  expect(docx.toString('utf8')).toContain('TargetMode="External"');
  const dateParagraphs = xml.split('<w:p>').filter((paragraph) => paragraph.includes('2025年11月1日'));
  expect(dateParagraphs.length).toBeGreaterThan(0);
  for (const paragraph of dateParagraphs) {
    const visible = paragraph.replace(/<[^>]+>/g, '');
    expect(visible.includes('2025年11月1日')).toBe(true);
    expect(Array.from(visible).length).toBeLessThanOrEqual(28);
  }
});
