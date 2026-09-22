import { refreshToken, effectivePlan, REFRESH_INTERVAL_MS, type DbUser } from './token-refresh';
import { verifySmsCode, generateSmsCode, clientIp, MAX_ATTEMPTS, type CodeStore, type CodeRecord } from './sms-verify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const alice: DbUser = { id: 'alice', name: 'A', email: 'a@x', phone: '13800000000', plan: 'FREE', planExpireAt: null, profileCompleted: true };

describe('JWT 只从数据库取身份与会员等级', () => {
  it('客户端 update() 传来的 id / plan 不会进入 token', async () => {
    const token = { id: 'alice', plan: 'FREE', refreshedAt: Date.now() };
    // 模拟 next-auth：trigger=update 时 session 参数是客户端 POST 的内容，我们的实现根本不读它
    const next = await refreshToken(token, { trigger: 'update' }, async (id) => (id === 'alice' ? alice : null));
    expect(next).toMatchObject({ id: 'alice', plan: 'FREE' });
  });

  it('auth-options 不再把客户端 session 合并进 token', () => {
    const src = readFileSync(join(__dirname, 'auth-options.ts'), 'utf8');
    expect(src).not.toMatch(/\.\.\.session\.user/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/refreshToken\(/);
  });

  it('付款开通后 5 分钟内生效，无需重新登录', async () => {
    const t0 = 1_000_000;
    const token = { id: 'alice', plan: 'FREE', refreshedAt: t0 };
    const paid = { ...alice, plan: 'PRO', planExpireAt: new Date(t0 + 30 * 86400e3) };
    const same = await refreshToken(token, { now: t0 + 1000 }, async () => paid);
    expect(same?.plan).toBe('FREE');
    const later = await refreshToken(token, { now: t0 + REFRESH_INTERVAL_MS }, async () => paid);
    expect(later?.plan).toBe('PRO');
  });

  it('会员到期按免费档；账号不存在则会话失效', async () => {
    expect(effectivePlan('FULL', new Date(Date.now() - 1000))).toBe('FREE');
    expect(effectivePlan('FULL', new Date(Date.now() + 86400e3))).toBe('FULL');
    expect(await refreshToken({ id: 'gone' }, { trigger: 'update' }, async () => null)).toBeNull();
  });
});

function memoryStore(code: string): CodeStore & { rec: CodeRecord } {
  const rec: CodeRecord = { id: 'c1', code, attempts: 0, used: false, expiresAt: new Date(Date.now() + 600e3) };
  return {
    rec,
    latestActive: async (_phone, now) => (!rec.used && rec.expiresAt > now ? { ...rec } : null),
    claimAttempt: async () => { if (rec.used || rec.attempts >= MAX_ATTEMPTS) return false; rec.attempts++; return true; },
    consume: async () => { if (rec.used) return false; rec.used = true; return true; },
  };
}

describe('短信验证码', () => {
  it('错满 5 次作废，之后正确的验证码也不能用（无法穷举）', async () => {
    const store = memoryStore('123456');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect((await verifySmsCode(store, '13800000000', String(100000 + i))).ok).toBe(false);
    }
    expect((await verifySmsCode(store, '13800000000', '123456')).ok).toBe(false);
  });

  it('正确验证码只能用一次', async () => {
    const store = memoryStore('654321');
    expect((await verifySmsCode(store, '13800000000', '654321')).ok).toBe(true);
    expect((await verifySmsCode(store, '13800000000', '654321')).ok).toBe(false);
  });

  it('验证码为 6 位数字，限流取网关追加的最后一跳', () => {
    for (let i = 0; i < 200; i++) expect(generateSmsCode()).toMatch(/^[1-9]\d{5}$/);
    expect(clientIp('6.6.6.6, 1.2.3.4')).toBe('1.2.3.4');
    expect(clientIp(null, '9.9.9.9')).toBe('9.9.9.9');
  });
});


it('并发猜测不能覆盖尝试次数，正确验证码不能越过已耗尽的限额', async () => {
  const store = memoryStore('654321');
  const results = await Promise.all(Array.from({ length: 30 }, () => verifySmsCode(store, '13800000000', '111111')));
  expect(results.every((r) => !r.ok)).toBe(true);
  expect(store.rec.attempts).toBe(MAX_ATTEMPTS);
  expect((await verifySmsCode(store, '13800000000', '654321')).ok).toBe(false);
});

it('同一验证码并发登录最多成功一次', async () => {
  const store = memoryStore('654321');
  const results = await Promise.all(Array.from({ length: 10 }, () => verifySmsCode(store, '13800000000', '654321')));
  expect(results.filter((r) => r.ok)).toHaveLength(1);
});
