import { buildAnswerDateLine, latestCitedDate } from './answer-date-line';

const now = new Date(2026, 9, 15);

describe('审计 8-3 AI 回答日期行', () => {
  it('抽取最新的来源日期，忽略未来目标年', () => {
    expect(latestCitedDate('依据 2025年3月1日 发布的通知，及 2024-11-20 的补充文件；2030年目标', now)).toBe('2025-03-01');
    expect(latestCitedDate('2026年8月数据', now)).toBe('2026-08');
    expect(latestCitedDate('没有日期', now)).toBeNull();
  });
  it('日期行包含来源日期、核验日期、模型名称', () => {
    const l = buildAnswerDateLine({ content: '光伏组件价格（2026-09-30）', model: 'deepseek-chat', answeredAt: now });
    expect(l.text).toBe('引用来源最新日期：2026-09-30 · 核验日期：2026-10-15 · 模型：deepseek-chat');
  });
  it('涉及政策时追加官方文件提示；无日期时明确说明', () => {
    const l = buildAnswerDateLine({ content: '分时电价机制如下', question: '最新政策', model: '', answeredAt: now });
    expect(l.sourceDate).toBe('未引用带日期的来源');
    expect(l.model).toBe('未知模型');
    expect(l.text).toContain('请以最新官方文件为准');
  });
});
