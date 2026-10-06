/**
 * 国内树里不再保留国际版资源：英文首页分支、LanguageSwitcher、en.json、InternationalLanding、
 * 各页面的英文文案分支。国际版在 web-int 单独维护。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : walk(p);
        return /\.(ts|tsx|json)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n) ? [p] : [];
    });
}

describe('国内树不含国际版资源', () => {
    it('国际版文件已删除', () => {
        for (const rel of ['messages/en.json', 'components/home/InternationalLanding.tsx', 'components/ui/LanguageSwitcher.tsx', 'lib/i18n/translations.ts', 'lib/i18n/context.tsx']) {
            expect(existsSync(join(SRC, rel))).toBe(false);
        }
    });

    it('源码里没有英文分支与国际版组件引用', () => {
        const pattern = /InternationalLanding|InternationalHomePage|LanguageSwitcher|isEnglish|=== 'en'|messages\/en\b|features_en/;
        const hits = walk(SRC)
            .filter((p) => !p.endsWith('domestic-only.test.ts'))
            // 与后端共用的权益注册表数据（含国际版读取的英文字段），不是国内页面文案
            .filter((p) => !p.endsWith('lib/entitlements/entitlements.json'))
            .filter((p) => pattern.test(readFileSync(p, 'utf8')))
            .map((p) => p.slice(SRC.length));
        expect(hits).toEqual([]);
    });

    it('i18n 只加载中文消息', () => {
        expect(readFileSync(join(SRC, 'i18n/request.ts'), 'utf8')).toContain("locale: 'zh'");
        expect(Object.keys(JSON.parse(readFileSync(join(SRC, 'messages/zh.json'), 'utf8')))).not.toContain('InternationalLanding');
    });
});
