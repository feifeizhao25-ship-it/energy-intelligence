import { AchievementCategory, carbonAchievements } from './achievements';
import { carbonReduction, checkAllAchievements, formatProgressText, UserStats } from './check';

function stats(totalGeneration: number, province?: string): UserStats {
    return {
        totalGeneration,
        province,
        stationCount: 0,
        recordStreak: 0,
        totalRecords: 0,
        aiChatCount: 0,
        questionCount: 0,
        answerCount: 0,
        totalLikes: 0,
        referralCount: 0,
        calcCount: 0,
    };
}

describe('成就减排按省级因子手算', () => {
    it('1,800 kWh × 江苏 0.5827 / 1000 = 1.04886 吨，跨过 1 吨门槛', () => {
        const reduction = carbonReduction(1800, '江苏省');
        expect(reduction.tonnes).toBeCloseTo(1.04886, 5);
        expect(reduction.scope).toBe('江苏省级电力平均二氧化碳排放因子');
        expect(reduction.label).toContain('江苏省级');
        const ids = checkAllAchievements(stats(1800, '江苏省')).map((item) => item.achievementId);
        expect(ids).toContain('carbon_1t');
    });

    it('同样 1,800 kWh 不填省份：1,800 × 0.5306 / 1000 = 0.95508 吨，不到 1 吨', () => {
        const reduction = carbonReduction(1800);
        expect(reduction.tonnes).toBeCloseTo(0.95508, 5);
        expect(reduction.province).toBeNull();
        expect(reduction.label).toContain('全国电力平均');
        const ids = checkAllAchievements(stats(1800)).map((item) => item.achievementId);
        expect(ids).not.toContain('carbon_1t');
    });

    it('进度文字标明所用因子', () => {
        const carbon = carbonAchievements[0];
        expect(carbon.category).toBe(AchievementCategory.CARBON);
        const text = formatProgressText(carbon, stats(1800, '云南'));
        // 1,800 × 0.1333 / 1000 = 0.23994 吨
        expect(text.startsWith('0.2 / 1 吨')).toBe(true);
        expect(text).toContain('云南省级');
    });
});
