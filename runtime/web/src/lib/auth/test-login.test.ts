/**
 * 共2：正式构建不得注册测试登录，客户端包里也不得留下测试登录按钮。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (o: unknown) => o }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } } }));
jest.mock('./sms-store', () => ({ prismaCodeStore: {} }));
jest.mock('./sms-verify', () => ({ verifySmsCode: jest.fn() }));

import { testLoginButtonVisible, testLoginEnabled } from './test-login';

describe('测试登录开关', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        delete process.env.TEST_LOGIN_ENABLED;
        delete process.env.NEXT_PUBLIC_TEST_LOGIN_ENABLED;
        jest.resetModules();
    });

    it('正式环境即使打开开关也不启用', () => {
        expect(testLoginEnabled({ NODE_ENV: 'production', TEST_LOGIN_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(false);
        expect(testLoginButtonVisible({ NODE_ENV: 'production', NEXT_PUBLIC_TEST_LOGIN_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('开发或测试未开开关时不启用', () => {
        expect(testLoginEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
        expect(testLoginEnabled({ NODE_ENV: 'test', TEST_LOGIN_ENABLED: '0' } as NodeJS.ProcessEnv)).toBe(false);
    });

    it('开发或测试且开关为 1 才启用', () => {
        expect(testLoginEnabled({ NODE_ENV: 'development', TEST_LOGIN_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
        expect(testLoginEnabled({ NODE_ENV: 'test', TEST_LOGIN_ENABLED: '1' } as NodeJS.ProcessEnv)).toBe(true);
    });

    async function providerIds(nodeEnv: string, flag?: string) {
        jest.resetModules();
        process.env.NODE_ENV = nodeEnv;
        if (flag === undefined) delete process.env.TEST_LOGIN_ENABLED;
        else process.env.TEST_LOGIN_ENABLED = flag;
        const { authOptions } = await import('./auth-options');
        return (authOptions.providers as { id?: string }[]).map((provider) => provider.id);
    }

    it('正式构建的登录方式里没有 test', async () => {
        const ids = await providerIds('production', '1');
        expect(ids).toContain('sms');
        expect(ids).not.toContain('test');
    });

    it('测试构建开了开关才有 test', async () => {
        expect(await providerIds('test', '1')).toContain('test');
        expect(await providerIds('development')).not.toContain('test');
    });

    it('按正式构建折叠后，三套前端的客户端代码里都没有测试登录标记', () => {
        const swc = require('@swc/core') as typeof import('@swc/core');
        const files = [
            join(__dirname, '../../app/login/test-login-button.tsx'),
            join(__dirname, '../../../../web-int/src/app/login/login-form.tsx'),
            join(__dirname, '../../../../../web-global/src/app/login/test-login-button.tsx'),
        ];
        const compile = (source: string, nodeEnv: string) => swc.transformSync(
            source
                .replaceAll('process.env.NODE_ENV', JSON.stringify(nodeEnv))
                .replaceAll('process.env.NEXT_PUBLIC_TEST_LOGIN_ENABLED', JSON.stringify('1')),
            {
                jsc: {
                    parser: { syntax: 'typescript', tsx: true },
                    minify: { compress: { dead_code: true, conditionals: true, evaluate: true }, mangle: false },
                },
                minify: true,
            },
        ).code;
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            expect(compile(source, 'production')).not.toContain('ei-test-login-channel');
            expect(compile(source, 'development')).toContain('ei-test-login-channel');
        }
    });
});
