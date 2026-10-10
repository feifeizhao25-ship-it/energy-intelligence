/**
 * 广告法第 9 条（绝对化用语）与如实描述门禁：页面和组件里不能再出现「权威数据源」「解答所有技术政策问题」
 * 「最受欢迎」「顶级」「误差控制在 ±3.5%」「是银行理财的 6 倍」这类绝对化或没有依据的说法。
 * 以后有人加回来，这里会变红；确有依据的表述请改写成可核对的事实（例如写明来源和日期）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const DIRS = [join(ROOT, 'src/app'), join(ROOT, 'src/components')];
const BANNED = ['权威', '解答所有', '最受欢迎', '顶级', '误差控制在', '银行理财的', '最优装机', '精准', '专家级', '全网', '国家级', '被动收入'];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
}

describe('营销与页面文案：不用绝对化、无依据的说法', () => {
    it('app/ 与 components/ 中没有禁用词', () => {
        const hits: string[] = [];
        for (const file of DIRS.flatMap(walk)) {
            readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
                // 注释里记录「原来写了什么」是允许的，只查会显示给用户或发给模型的代码行
                if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
                for (const word of BANNED) if (line.includes(word)) hits.push(`${relative(ROOT, file)}:${i + 1} 「${word}」`);
            });
        }
        expect(hits).toEqual([]);
    });
});
