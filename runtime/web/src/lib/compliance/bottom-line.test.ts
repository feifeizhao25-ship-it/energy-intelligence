// 底线禁词扫描：源码中的用户可见文案与接口输出不得包含投资建议/价格预测/冒充官方用语
import fs from 'fs';
import path from 'path';
import { findBottomLineViolations, bottomLineTerms } from './bottom-line';
import { describeSolarOutput, parseV1SolarInput, auditUrlFor, V1InputError } from '@/lib/calculation/v1-solar';

const SRC = path.resolve(__dirname, '../..');
// 这些文件本身就是禁词表/守卫或其测试，必然包含禁词
const ALLOW = new Set([
    'lib/compliance/bottom-line.ts',
    'lib/compliance/bottom-line.test.ts',
    'lib/compliance/bottom-line-terms.json',
    'lib/ai/system-prompt.ts', // 提示词里需要写出禁止的说法
]);

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p, out); }
        else if (/\.(ts|tsx|json)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
    return out;
}

describe('底线禁词扫描', () => {
    it('禁词表非空且三类都有', () => {
        expect(bottomLineTerms('investment_advice').length).toBeGreaterThan(5);
        expect(bottomLineTerms('price_prediction').length).toBeGreaterThan(2);
        expect(bottomLineTerms('impersonating_official').length).toBeGreaterThan(2);
    });

    it('源码（除禁词表/提示词外）不含禁词', () => {
        const hits: string[] = [];
        for (const f of walk(SRC)) {
            const rel = path.relative(SRC, f).split(path.sep).join('/');
            if (ALLOW.has(rel)) continue;
            const v = findBottomLineViolations(fs.readFileSync(f, 'utf8'));
            if (v.length) hits.push(`${rel}: ${v.join(', ')}`);
        }
        expect(hits).toEqual([]);
    });

    it('v1 光伏接口的事实描述不含禁词，且随输入变化', () => {
        const mk = (year1: number, irr: number): any => ({
            energy: { year1, pr: 0.8 }, financial: { irr, paybackYears: 7, lcoe: 0.3 },
        });
        const a = describeSolarOutput(mk(120000, 9.1));
        const b = describeSolarOutput(mk(240000, 13.4));
        expect(a.headline).not.toEqual(b.headline);
        for (const d of [a, b]) expect(findBottomLineViolations(JSON.stringify(d))).toEqual([]);
        expect(a.headline).toContain('120000');
        expect(b.keyMetrics.find(m => m.name === '内部收益率')!.value).toBe('13.40');
    });

    it('v1 输入：电价缺失直接报错，不替调用方假设电价', () => {
        expect(() => parseV1SolarInput({ lat: 39.9, lng: 116.4, capacity: 10, province: '北京' })).toThrow(V1InputError);
        const ok = parseV1SolarInput({ lat: 39.9, lng: 116.4, capacity: 10, province: '北京', electricityPrice: 0.5, feedInTariff: 0.35 });
        expect(ok.electricityPrice).toBe(0.5);
    });

    it('审计链接不再写死外部域名', () => {
        const old = process.env.NEXT_PUBLIC_SITE_URL;
        process.env.NEXT_PUBLIC_SITE_URL = 'https://example.cn/';
        expect(auditUrlFor('/audit/x')).toBe('https://example.cn/audit/x');
        delete process.env.NEXT_PUBLIC_SITE_URL;
        expect(auditUrlFor('/audit/x')).toBe('/audit/x');
        if (old !== undefined) process.env.NEXT_PUBLIC_SITE_URL = old;
        const route = fs.readFileSync(path.join(SRC, 'app/api/v1/calculate/solar/route.ts'), 'utf8');
        expect(route).not.toMatch(/solarwind\.pro|dummy_result/);
        expect(fs.readFileSync(path.join(SRC, 'lib/calculation/auditable-engine.ts'), 'utf8')).not.toMatch(/dummy_result|12\.5%/);
    });
});
