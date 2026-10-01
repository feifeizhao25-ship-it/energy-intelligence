import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 门禁：凡是会让「项目 / 收藏文献 / 电站 / 文献夹 / 收藏地点」条数增加的路由，必须先过会员额度校验。
 * 否则会员页上写的「免费版 1 个项目」只是文案。
 */
const API = join(__dirname, '..', '..', 'app', 'api');
const CREATES = /(?:prisma|tx)\.(project|savedPaper|station|paperFolder|savedLocation)\.(create|createMany|upsert)\(/;
const GUARDED = /enforceStorageLimit\(|USAGE_LIMITS\[plan\]\.stations/;

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return routes(p);
    return n === 'route.ts' ? [p] : [];
  });
}

export function unguardedCreators(files: { path: string; src: string }[]): string[] {
  return files.filter((f) => CREATES.test(f.src) && !GUARDED.test(f.src)).map((f) => f.path);
}

describe('保存类额度门禁', () => {
  it('所有会新增项目/收藏文献/电站的路由都做了额度校验', () => {
    const files = routes(API).map((path) => ({ path: path.slice(API.length), src: readFileSync(path, 'utf8') }));
    expect(files.length).toBeGreaterThan(10);
    expect(unguardedCreators(files)).toEqual([]);
  });

  it('门禁自检：没校验的创建路由会被抓出来', () => {
    expect(unguardedCreators([{ path: '/x', src: 'await prisma.project.create({})' }])).toEqual(['/x']);
    expect(unguardedCreators([{ path: '/y', src: 'await enforceStorageLimit(u,"projects"); await prisma.project.create({})' }])).toEqual([]);
  });
});
