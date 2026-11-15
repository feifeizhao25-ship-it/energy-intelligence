/**
 * 首页文案与地图回退门禁：
 * - 不用「效率神器」这类绝对化表述；「覆盖 N 省市」必须来自电价表实际收录数；
 * - 不写「基于NASA气象数据」，统一为「公开气象数据」；导航不放指向不存在锚点的「客户案例」；
 * - 高德地图不可用时提示「地图服务暂不可用」，不自动切到境外地图。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { provincesWithPrices } from '@/lib/pricing/tariffs';

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const BANNED_COPY = /解答所有|立项审批|基于NASA|碳中和证书|权威数据源|效率神器|最优装机/;
const WEB_BANNED_COPY = /解答所有|立项审批|基于NASA|碳中和证书|权威数据源|效率神器|精准|最优装机/;
const WEB_FRONTEND = join(SRC, '..', '..', '..', 'web-frontend');

describe.each(['app/page.tsx', 'app/[locale]/page.tsx'])('%s 首页文案', (file) => {
    const src = read(file);
    it('不出现夸大或无法兑现的说法', () => {
        expect(src).not.toMatch(/效率神器|基于NASA|value: '31'|31省/);
    });
    it('没有指向不存在锚点的「客户案例」', () => {
        expect(src).not.toContain('#cases');
        expect(src).not.toContain('客户案例');
    });
    it('覆盖省市数取自电价表', () => {
        expect(src).toContain('provincesWithPrices().length');
        expect(provincesWithPrices().length).toBeLessThan(31);
    });
});

describe('其他文案', () => {
    it('zh.json 首页副标题不再是「效率神器」', () => {
        const zh = JSON.parse(read('messages/zh.json'));
        expect(zh.Index.hero.subtitle).not.toContain('效率神器');
        expect(zh.Index.dataSources.title).not.toContain('权威');
        expect(JSON.stringify(zh)).not.toMatch(BANNED_COPY);
        const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8'));
        expect(pkg.description).not.toMatch(/效率神器|权威/);
    });
    it('web-frontend 的 zh.json 与首页不再出现同一组禁用词', () => {
        const zh = JSON.parse(readFileSync(join(WEB_FRONTEND, 'src/messages/zh.json'), 'utf8'));
        expect(JSON.stringify(zh)).not.toMatch(WEB_BANNED_COPY);
        for (const file of [
            'src/app/page.tsx',
            'src/app/%5Blocale%5D/page.tsx',
            'src/app/%28dashboard%29/dashboard/page.tsx',
            'src/lib/i18n/translations.ts',
        ]) {
            expect(readFileSync(join(WEB_FRONTEND, file), 'utf8')).not.toMatch(WEB_BANNED_COPY);
        }
    });
    it('高德不可用时只提示「地图服务暂不可用」，不加载境外地图与地名服务', () => {
        const map = read('components/map/ResourceMap.tsx');
        expect(map).toContain("MAP_UNAVAILABLE_TEXT = '地图服务暂不可用'");
        expect(map).not.toMatch(/openstreetmap\.org|unpkg\.com|LeafletFallbackMap/);
    });
});
