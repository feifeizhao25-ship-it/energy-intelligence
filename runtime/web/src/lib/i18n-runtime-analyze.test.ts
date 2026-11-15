import { execFileSync } from 'child_process';
import path from 'path';

const root = path.resolve(__dirname, '../..');
function run(expr: string): unknown {
  const code = `import('./scripts/i18n-runtime-analyze.mjs').then(m => console.log(JSON.stringify(${expr})))`;
  return JSON.parse(execFileSync('node', ['-e', code], { cwd: root, encoding: 'utf8' }));
}

describe('运行时语言检查（白名单制）', () => {
  it('白名单词与网址不计入', () => {
    expect(run(`m.nonAllowlistedWords('光伏 IRR LCOE https://www.mee.gov.cn kWh 版本 ad4efba GET POST EPC')`)).toEqual([]);
  });
  it('新加的英文（不在旧黑名单里）也会被拦下', () => {
    expect(JSON.stringify(run(`m.analyzeVisibleText('/x', '中文 Welcome to our amazing platform today')`))).toContain('非白名单拉丁词');
  });
  it('黑名单短语仍是硬失败；无中文也失败', () => {
    expect(JSON.stringify(run(`m.analyzeVisibleText('/x', '中文 Privacy Policy')`))).toContain('Privacy Policy');
    expect(JSON.stringify(run(`m.analyzeVisibleText('/x', 'only english')`))).toContain('页面没有中文');
  });
  it('纯中文通过', () => {
    expect(run(`m.analyzeVisibleText('/x', '新能源智库 光伏收益测算 IRR')`)).toEqual([]);
  });
});
