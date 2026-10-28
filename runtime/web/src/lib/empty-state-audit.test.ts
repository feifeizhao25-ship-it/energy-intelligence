import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CUE = /尚未|下一步|没有|未连接|未接入|未检索|暂无|请先|不展示|EmptyState|DataState|暂时没有/;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === 'api' ? [] : walk(full);
        return name === 'page.tsx' ? [full] : [];
    });
}

/** 会取数或画表的页面，正文里要有空态或下一步说明。 */
export function pagesMissingEmptyGuidance(appDir: string): string[] {
    const missing: string[] = [];
    for (const file of walk(appDir)) {
        const text = readFileSync(file, 'utf8');
        const loadsData = /fetch\(|<table|useState/.test(text);
        if (loadsData && !CUE.test(text)) missing.push(relative(appDir, file));
    }
    return missing;
}

describe('空状态抽查', () => {
    it('取数页面都写了下一步或未连接说明', () => {
        expect(pagesMissingEmptyGuidance(join(__dirname, '../app'))).toEqual([]);
    });
});
