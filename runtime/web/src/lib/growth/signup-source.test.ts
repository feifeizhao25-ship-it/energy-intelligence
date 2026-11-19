import {
    SIGNUP_SOURCES,
    SIGNUP_SOURCE_FLAG,
    countBySource,
    normalizeSignupSource,
    publicSignupSourceOptions,
    recordSignupSource,
    signupSourceEnabled,
} from './signup-source';
import { userOwnedModels } from '@/lib/account/erasure';

const ON = { APP_EDITION: 'cn', [SIGNUP_SOURCE_FLAG]: 'true' };

describe('注册来源题（新能源国内版）', () => {
    it('九个选项，顺序和文字与约定一致', () => {
        expect(SIGNUP_SOURCES.map((s) => s.label)).toEqual([
            '小红书', '抖音', '视频号', '公众号', '知乎', '哔哩哔哩', '搜索', '朋友推荐', '其他',
        ]);
    });

    it('开关默认关闭；国际版即使打开开关也不出题', () => {
        expect(signupSourceEnabled({})).toBe(false);
        expect(signupSourceEnabled({ APP_EDITION: 'cn' })).toBe(false);
        expect(signupSourceEnabled({ APP_EDITION: 'cn', [SIGNUP_SOURCE_FLAG]: '0' })).toBe(false);
        expect(signupSourceEnabled({ APP_EDITION: 'global', [SIGNUP_SOURCE_FLAG]: 'true' })).toBe(false);
        expect(signupSourceEnabled(ON)).toBe(true);
        expect(publicSignupSourceOptions({})).toMatchObject({ enabled: false, options: [], skippable: true });
        expect(publicSignupSourceOptions(ON).options).toHaveLength(9);
    });

    it('只认枚举代码，自由文本、大小写不符、非字符串一律丢弃', () => {
        expect(normalizeSignupSource('zhihu')).toBe('zhihu');
        for (const bad of ['Zhihu', '知乎', ' zhihu', '朋友小王推荐的', '', null, undefined, 1, ['zhihu'], { code: 'zhihu' }]) {
            expect(normalizeSignupSource(bad)).toBeNull();
        }
    });

    it('汇总只输出 代码 → 次数，丢掉不认识的值和身份字段', () => {
        const out = countBySource([
            { source: 'douyin', userId: 'u1', phone: '13800000000' } as never,
            { source: 'douyin' },
            { source: 'zhihu' },
            { source: '随便写的' },
        ]);
        expect(out).toEqual({ douyin: 2, zhihu: 1 });
        expect(JSON.stringify(out)).not.toMatch(/u1|1380|phone|userId/);
    });

    describe('recordSignupSource', () => {
        const createMany = jest.fn(async () => ({ count: 1 }));
        const db = { signupSourceEvent: { createMany } };
        beforeEach(() => createMany.mockClear());

        it('开关打开 + 合法代码：只写 userId 和代码，重复提交忽略', async () => {
            await expect(recordSignupSource(db, 'u1', 'bilibili', ON)).resolves.toBe(true);
            expect(createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', source: 'bilibili' }], skipDuplicates: true });
        });

        it.each([
            ['开关关闭', 'bilibili', {}],
            ['国际版', 'bilibili', { APP_EDITION: 'global', [SIGNUP_SOURCE_FLAG]: '1' }],
            ['没答', undefined, ON],
            ['自由文本', '我在 B 站看到的', ON],
        ])('%s：不写', async (_label, raw, env) => {
            await expect(recordSignupSource(db, 'u1', raw, env as Record<string, string>)).resolves.toBe(false);
            expect(createMany).not.toHaveBeenCalled();
        });

        it('写失败不抛错', async () => {
            createMany.mockRejectedValueOnce(new Error('db down'));
            await expect(recordSignupSource(db, 'u1', 'search', ON)).resolves.toBe(false);
        });
    });

    it('注销时随账号删除：SignupSourceEvent 带 userId，被注销流程自动列入', () => {
        expect(userOwnedModels().map((m) => m.name)).toContain('SignupSourceEvent');
    });
});
