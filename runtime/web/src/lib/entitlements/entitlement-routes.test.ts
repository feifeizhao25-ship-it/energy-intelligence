import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('权益路由映射', () => {
    const root = join(__dirname, '../../..');
    const registry = JSON.parse(readFileSync(join(__dirname, 'entitlements.json'), 'utf8'));
    const routes = JSON.parse(readFileSync(join(__dirname, 'entitlement_routes.json'), 'utf8')) as Array<{
        tier: string; feature: string; page: string; e2e: string;
    }>;

    it('每条权益都有页面，删掉页面文件会失败', () => {
        const features = Object.entries(registry.tiers).flatMap(([tier, spec]) =>
            (spec as { features_zh: string[] }).features_zh.map((feature) => ({ tier, feature })));
        expect(features.length).toBeGreaterThan(0);
        for (const item of features) {
            const hit = routes.find((row) => row.tier === item.tier && row.feature === item.feature);
            expect(hit?.e2e).toContain(item.feature);
            expect(existsSync(join(root, hit!.page))).toBe(true);
        }
    });
});
