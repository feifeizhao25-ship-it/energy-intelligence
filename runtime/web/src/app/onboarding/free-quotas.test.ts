import { onboardingFreeQuotas } from './free-quotas';

test('新手引导展示的免费额度与权益表一致', () => {
    expect(onboardingFreeQuotas).toEqual([
        { label: '每日 AI 对话', value: 5 },
        { label: '每日项目测算', value: 3 },
        { label: '最多项目数', value: 1 },
    ]);
});
