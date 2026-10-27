// 输出语言覆盖：报告模板、助手文案、导出样例。覆盖率打到标准输出。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isAllowed } from './language-allowlist.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SAMPLE_DIR = join(ROOT, '../../docs/report-samples/cn');
const SCAN = [
    'src/lib/reports',
    'src/lib/assistant',
    'src/lib',
].map((dir) => join(ROOT, dir));

function walk(dir) {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : walk(full);
        return /\.(tsx?|md|txt)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
    });
}

function latin(text) {
    const words = [];
    for (const word of text.match(/[A-Za-z][A-Za-z0-9&/.-]*[A-Za-z0-9]|[A-Za-z]/g) ?? []) {
        const clean = word.replace(/[./-]+$/, '');
        if (!isAllowed(clean) && !/^[a-z]$/i.test(clean)) words.push(clean);
    }
    return words;
}

const paths = [];
const sampleHits = [];
for (const file of walk(SAMPLE_DIR)) {
    paths.push(relative(ROOT, file));
    const words = latin(readFileSync(file, 'utf8'));
    if (words.length) sampleHits.push({ file: relative(ROOT, file), words: [...new Set(words)].slice(0, 8) });
}
const libPaths = [...new Set(SCAN.flatMap(walk))].map((file) => relative(ROOT, file));
const report = {
    scanned: [...paths, ...libPaths],
    sampleViolations: sampleHits,
};
console.log(JSON.stringify(report));
if (sampleHits.length) process.exit(1);
