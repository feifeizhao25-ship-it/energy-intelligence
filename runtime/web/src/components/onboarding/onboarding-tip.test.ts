import fs from 'fs';
import path from 'path';
import { shouldShowOnboardingTip, TIP_DISMISSED_KEY, TIP_SNOOZED_KEY } from './onboarding-tip';

const store = (o: Record<string, string> = {}) => ({ getItem: (k: string) => o[k] ?? null });

describe('审计 10-1 引导提示气泡', () => {
  it('测算页不弹出，避免遮挡“开始计算”', () => {
    expect(shouldShowOnboardingTip('/quick-calc/solar', store(), store())).toBe(false);
    expect(shouldShowOnboardingTip('/calculator', store(), store())).toBe(false);
    expect(shouldShowOnboardingTip('/assistant', store(), store())).toBe(false);
    expect(shouldShowOnboardingTip('/membership', store(), store())).toBe(false);
    expect(shouldShowOnboardingTip('/dashboard', store(), store())).toBe(true);
  });
  it('“不再显示”永久记住，“稍后”仅本会话', () => {
    expect(shouldShowOnboardingTip('/dashboard', store({ [TIP_DISMISSED_KEY]: 'true' }), store())).toBe(false);
    expect(shouldShowOnboardingTip('/dashboard', store(), store({ [TIP_SNOOZED_KEY]: 'true' }))).toBe(false);
  });
  it('组件是角落气泡：不是对话框、无全屏遮罩、居中宽卡片已移除', () => {
    const src = fs.readFileSync(path.join(__dirname, 'OnboardingFlow.tsx'), 'utf8');
    expect(src).not.toMatch(/role="dialog"|inset-0|left-1\/2/);
    expect(src).toContain('不再显示');
    expect(src).toContain('max-w-sm');
  });
});
