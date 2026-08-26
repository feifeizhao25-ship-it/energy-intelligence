/**
 * 权益注册表单一事实源校验（19 项要求第 6 项）：
 * web 构建期注入的副本必须与后端 canonical 文件逐字节一致，
 * 且覆盖定价页展示的全部档位与六维权益。
 */
import fs from 'node:fs';
import path from 'node:path';
import bundledRegistry from '@/lib/entitlements/entitlements.json';
import { Plan } from '@/lib/membership/plans';

const BACKEND_SOURCE = path.join(
    __dirname, '..', '..', '..', '..', 'backend', 'data', 'entitlements.json',
);

const REQUIRED_TIERS = ['free', 'pro', 'team', 'enterprise'];
const SIX_DIMENSIONS = ['quotas', 'knowledge', 'personalization', 'export', 'collaboration', 'service'];

describe('entitlements 注册表（web 副本）', () => {
    it('与后端 canonical 注册表一致（不一致时运行 scripts/sync-entitlements.mjs）', () => {
        const source = fs.readFileSync(BACKEND_SOURCE, 'utf8');
        const bundled = fs.readFileSync(
            path.join(__dirname, 'entitlements.json'), 'utf8',
        );
        expect(bundled).toBe(source);
    });

    it('包含 product/version 与全部必需档位', () => {
        expect(bundledRegistry.product).toBe('新能源智库');
        expect(bundledRegistry.version).toBeTruthy();
        for (const tier of REQUIRED_TIERS) {
            expect(bundledRegistry.tiers).toHaveProperty(tier);
        }
    });

    it('每个档位都有六维权益与定价页文案', () => {
        for (const [tierId, tier] of Object.entries(bundledRegistry.tiers)) {
            for (const dim of SIX_DIMENSIONS) {
                expect(tier).toHaveProperty(dim);
            }
            const t = tier as unknown as { features_zh: string[]; features_en: string[]; name: string };
            expect(t.name).toBeTruthy();
            expect(t.features_zh.length).toBeGreaterThan(0);
            expect(t.features_en.length).toBeGreaterThan(0);
            expect(tierId).toBeTruthy();
        }
    });

    it('覆盖定价页展示的全部 Plan 档位', () => {
        for (const plan of Object.values(Plan)) {
            expect(bundledRegistry.tiers).toHaveProperty(plan.toLowerCase());
        }
    });
});
