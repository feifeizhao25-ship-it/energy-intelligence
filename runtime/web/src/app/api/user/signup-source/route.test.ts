import { GET } from './route';
import { SIGNUP_SOURCE_FLAG } from '@/lib/growth/signup-source';

const saved = { app: process.env.APP_EDITION, flag: process.env[SIGNUP_SOURCE_FLAG] };
afterAll(() => {
    if (saved.app === undefined) delete process.env.APP_EDITION; else process.env.APP_EDITION = saved.app;
    if (saved.flag === undefined) delete process.env[SIGNUP_SOURCE_FLAG]; else process.env[SIGNUP_SOURCE_FLAG] = saved.flag;
});

describe('GET /api/user/signup-source', () => {
    it('默认关闭：enabled=false、没有选项', async () => {
        process.env.APP_EDITION = 'cn';
        delete process.env[SIGNUP_SOURCE_FLAG];
        const res = await GET();
        expect(res.headers.get('cache-control')).toBe('no-store');
        expect(await res.json()).toMatchObject({ enabled: false, options: [] });
    });

    it('国内版打开开关：九个选项', async () => {
        process.env.APP_EDITION = 'cn';
        process.env[SIGNUP_SOURCE_FLAG] = '1';
        const data = await (await GET()).json();
        expect(data.enabled).toBe(true);
        expect(data.options.map((o: { code: string }) => o.code)).toEqual([
            'xiaohongshu', 'douyin', 'wechat_channels', 'wechat_oa', 'zhihu', 'bilibili', 'search', 'friend', 'other',
        ]);
    });
});
