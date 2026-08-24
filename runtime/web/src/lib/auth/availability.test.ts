/**
 * next-auth 配置 fail-closed 判定测试（截图实证修复 A1/A3）：
 * 缺 NEXTAUTH_SECRET 一律未配置；生产环境额外要求 NEXTAUTH_URL；
 * 任何情况下都不存在 localhost 兜底。
 */
import { isAuthConfigured, missingAuthConfig } from '@/lib/auth/availability';

describe('isAuthConfigured', () => {
    const ENV = { ...process.env };

    afterEach(() => {
        process.env = { ...ENV };
    });

    it('缺 NEXTAUTH_SECRET 时未配置', () => {
        delete process.env.NEXTAUTH_SECRET;
        process.env.NEXTAUTH_URL = 'https://cn.example.com';
        expect(isAuthConfigured()).toBe(false);
        expect(missingAuthConfig()).toContain('NEXTAUTH_SECRET');
    });

    it('生产环境缺 NEXTAUTH_URL 时未配置（fail-closed）', () => {
        process.env.NEXTAUTH_SECRET = 'x'.repeat(32);
        delete process.env.NEXTAUTH_URL;
        process.env.NODE_ENV = 'production';
        expect(isAuthConfigured()).toBe(false);
        expect(missingAuthConfig()).toContain('NEXTAUTH_URL');
    });

    it('生产环境两者齐备时才可用', () => {
        process.env.NEXTAUTH_SECRET = 'x'.repeat(32);
        process.env.NEXTAUTH_URL = 'https://cn.example.com';
        process.env.NODE_ENV = 'production';
        expect(isAuthConfigured()).toBe(true);
        expect(missingAuthConfig()).toEqual([]);
    });

    it('开发环境只要求 NEXTAUTH_SECRET', () => {
        process.env.NEXTAUTH_SECRET = 'x'.repeat(32);
        delete process.env.NEXTAUTH_URL;
        process.env.NODE_ENV = 'development';
        expect(isAuthConfigured()).toBe(true);
    });
});
