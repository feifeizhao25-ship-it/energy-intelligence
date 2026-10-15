import { verificationView } from './verification';

describe('审计 7-5 引用卡核验状态', () => {
  it('三种标签：已核验 / 待核验 / 冲突', () => {
    expect(verificationView({ status: 'verified' }).label).toBe('已核验');
    expect(verificationView({ status: 'review_recommended' }).label).toBe('待核验');
    expect(verificationView({ status: 'conflict' }).label).toBe('冲突');
  });
  it('缺失或未知状态按待核验处理，且不可作为结论依据', () => {
    const v = verificationView(undefined);
    expect(v.label).toBe('待核验');
    expect(v.usableAsConclusion).toBe(false);
    expect(verificationView({ status: 'bogus' as any }).status).toBe('unverified');
  });
});
