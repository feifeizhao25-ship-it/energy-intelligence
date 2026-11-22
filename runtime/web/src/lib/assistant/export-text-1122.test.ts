import { markdownToExportLines, stripEmoji } from './export-text';
import { answerLines, renderAnswerDocx } from './answer-file';

/** 2026-11-21 测试：PDF / Word 里留着 **、标题挤成一段、💡 变乱码、页眉页脚写内部流程状态。 */
const MD = '### 一、合同能源管理（EMC）\n\n**核心逻辑**：投资方出钱建站。\n- 业主**零投入**\n- 分享收益\n\n| 模式 | 投资方 |\n|---|---|\n| EMC | 第三方 |\n\n💡 小结：按需选择。';

test('markdown becomes plain lines, one per paragraph, wording kept', () => {
  expect(markdownToExportLines(MD)).toEqual([
    '一、合同能源管理（EMC）',
    '核心逻辑：投资方出钱建站。',
    '• 业主零投入',
    '• 分享收益',
    '模式　投资方',
    'EMC　第三方',
    '提示：小结：按需选择。',
  ]);
});

test('emoji the export font cannot draw are replaced or removed', () => {
  expect(stripEmoji('⚠️ 风险高 🚀🔋')).toBe('注意：风险高 ');
  expect(stripEmoji('普通文字（无表情）')).toBe('普通文字（无表情）');
});

const record = { id: 'a', userId: 'u', text: MD, sources: [], standIn: false, synthetic: false, model: 'deepseek-flash', createdAt: 0 };

test('answer lines carry the served model and no markdown or emoji', () => {
  const lines = answerLines(record, false);
  expect(lines).toContain('生成模型：deepseek-flash');
  const all = lines.join('\n');
  expect(all).not.toMatch(/\*\*|###|💡|\|/);
  expect(all).toContain('本文件由软件根据所列来源生成');
});

test('Word: no internal approval wording; disclaimer sentence kept; one <w:p> per line', () => {
  const xml = renderAnswerDocx(record, false).toString('utf8');
  expect(xml).not.toContain('企业微信');
  expect(xml).not.toContain('回答来源</w:t>');
  expect(xml).toContain('本文件不是行政机关公文，测算值不是承诺。');
  expect(xml).toContain('非正式文件');
  expect(xml).not.toMatch(/<w:t[^>]*>[^<]*\n[^<]*<\/w:t>/);
  expect(xml).not.toContain('**');
});
