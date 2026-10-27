import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lintReport } from './report-lint';

describe('报告下载门禁', () => {
    it('六份中文示例都能通过，缺免责声明则拒绝', () => {
        const dir = join(__dirname, '../../../../..', 'docs/report-samples/cn');
        const files = readdirSync(dir).filter((name) => name.endsWith('.md'));
        expect(files).toHaveLength(6);
        for (const name of files) {
            const text = readFileSync(join(dir, name), 'utf8');
            expect(text).toContain('示例数据');
            expect(lintReport(text).ok).toBe(true);
        }
        const broken = lintReport('只有正文');
        expect(broken.ok).toBe(false);
        expect(broken.missing).toContain('免责声明');
    });
});
