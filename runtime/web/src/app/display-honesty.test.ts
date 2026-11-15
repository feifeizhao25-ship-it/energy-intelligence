import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');

describe('不再把编造读数当成正式显示', () => {
    it('项目页不写死性能比和健康度', () => {
        const list = read('(dashboard)/projects/page.tsx');
        const detail = read('(dashboard)/projects/[id]/page.tsx');
        const timeline = read('projects/timeline/page.tsx');
        expect(list).not.toContain('98%');
        expect(list).not.toContain('72%');
        expect(detail).not.toContain('82.4');
        expect(detail).not.toContain('及格率');
        expect(detail).toContain('性能比（PR）');
        expect(timeline).not.toContain('82.4');
        expect(timeline).not.toContain('215.8');
        expect(timeline).not.toContain('上海崇明');
        const compare = read('projects/[id]/compare/page.tsx');
        expect(compare).not.toContain('12.5');
        expect(compare).not.toContain('18.2万');
    });

    it('健康度组件不映射评级机构等级', () => {
        const src = read('../components/dashboard/HealthScore.tsx');
        expect(src).not.toContain('穆迪');
        expect(src).not.toContain('投资等级评定');
        expect(src).toContain('不显示分数或等级');
    });
});
