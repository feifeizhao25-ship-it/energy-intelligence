jest.mock('server-only', () => ({}), { virtual: true });

import { createSign, generateKeyPairSync } from 'node:crypto';

// 内存版数据库：只实现回调路由用到的几个方法，事务失败时整体回滚
type Row = Record<string, any>;
const db = { payments: [] as Row[], subs: [] as Row[], users: [] as Row[] };
const snapshot = () => JSON.stringify(db);
function makeTx() {
  return {
    payment: {
      findUnique: async ({ where }: any) => db.payments.find((p) => (where.orderNo ? p.orderNo === where.orderNo : p.transactionId === where.transactionId)) ?? null,
      update: async ({ where, data }: any) => { Object.assign(db.payments.find((p) => p.id === where.id)!, data); },
    },
    subscription: {
      findUnique: async ({ where }: any) => db.subs.find((s) => s.userId === where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const cur = db.subs.find((s) => s.userId === where.userId);
        if (cur) { Object.assign(cur, update); return cur; }
        const row = { id: `sub-${db.subs.length + 1}`, ...create }; db.subs.push(row); return row;
      },
    },
    user: { update: async ({ where, data }: any) => { Object.assign(db.users.find((u) => u.id === where.id)!, data); } },
  };
}
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const before = snapshot();
      try { await fn(makeTx()); } catch (e) { const s = JSON.parse(before); db.payments = s.payments; db.subs = s.subs; db.users = s.users; throw e; }
    },
  },
}));

import { POST } from './route';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });

beforeAll(() => {
  process.env.ALIPAY_APP_ID = '2026000000000001';
  process.env.ALIPAY_SELLER_ID = '2088000000000001';
  process.env.ALIPAY_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();
});

function signed(fields: Record<string, string>, key = privateKey): Record<string, string> {
  const params: Record<string, string> = {
    app_id: '2026000000000001', seller_id: '2088000000000001', sign_type: 'RSA2',
    trade_status: 'TRADE_SUCCESS', ...fields,
  };
  const content = Object.keys(params).sort().filter((k) => k !== 'sign_type' && params[k] !== '').map((k) => `${k}=${params[k]}`).join('&');
  const s = createSign('RSA-SHA256'); s.update(content, 'utf8');
  return { ...params, sign: s.sign(key, 'base64') };
}

const notify = (params: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.set(k, v);
  return POST(new Request('http://x/api/membership/alipay/notify', { method: 'POST', body: form }));
};

const paid = (over: Record<string, string> = {}) => signed({
  out_trade_no: 'ENE1', trade_no: 'T1', total_amount: '198.00', ...over,
});

beforeEach(() => {
  db.payments = [{ id: 'p1', orderNo: 'ENE1', userId: 'u1', plan: 'PRO', billingPeriod: 'monthly', amount: '198.00', status: 'pending', paymentMethod: 'alipay', transactionId: null }];
  db.subs = [];
  db.users = [{ id: 'u1', plan: 'FREE', planExpireAt: null }];
});

describe('支付宝异步通知', () => {
  it('验签通过、金额一致：订单完成、会员生效，回 success', async () => {
    const res = await notify(paid());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('success');
    expect(db.payments[0]).toMatchObject({ status: 'completed', transactionId: 'T1' });
    expect(db.users[0].plan).toBe('PRO');
    expect(new Date(db.users[0].planExpireAt).getTime()).toBeGreaterThan(Date.now() + 27 * 86400e3);
  });

  it('签名是别的密钥签的：400 failure，库一点不动', async () => {
    const before = snapshot();
    const res = await notify(signed({ out_trade_no: 'ENE1', trade_no: 'T1', total_amount: '198.00' }, other.privateKey));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('failure');
    expect(snapshot()).toBe(before);
  });

  it('签名后被改了金额（198 改成 0.01）：验签失败，会员不生效', async () => {
    const p = paid();
    const res = await notify({ ...p, total_amount: '0.01' });
    expect(res.status).toBe(400);
    expect(db.users[0].plan).toBe('FREE');
  });

  it('没有 sign：拒绝', async () => {
    const { sign: _sign, ...rest } = paid();
    expect((await notify(rest)).status).toBe(400);
    expect(db.payments[0].status).toBe('pending');
  });

  it('app_id 或 seller_id 不是我们的（别的商户的合法通知）：拒绝', async () => {
    expect((await notify(paid({ app_id: '2026000000000999' }))).status).toBe(400);
    expect((await notify(paid({ seller_id: '2088000000000999' }))).status).toBe(400);
    expect(db.payments[0].status).toBe('pending');
  });

  it('签名正确但金额与我们的订单不符：拒绝，不开通', async () => {
    const res = await notify(paid({ total_amount: '1.00' }));
    expect(res.status).toBe(400);
    expect(db.payments[0].status).toBe('pending');
    expect(db.users[0].plan).toBe('FREE');
  });

  it('订单号不存在：拒绝', async () => {
    expect((await notify(paid({ out_trade_no: 'NOPE' }))).status).toBe(400);
  });

  it('不是支付宝渠道的订单：拒绝', async () => {
    db.payments[0].paymentMethod = 'wechat';
    expect((await notify(paid())).status).toBe(400);
    expect(db.users[0].plan).toBe('FREE');
  });

  it('同一笔通知重放：回 success，但只开通一次，不重复顺延', async () => {
    await notify(paid());
    const expireAfterFirst = db.users[0].planExpireAt;
    const res = await notify(paid());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('success');
    expect(db.users[0].planExpireAt).toEqual(expireAfterFirst);
    expect(db.subs).toHaveLength(1);
  });

  it('TRADE_SUCCESS 之后又来 TRADE_FINISHED（同一 trade_no）：幂等，不重复开通', async () => {
    await notify(paid());
    const expireAfterFirst = db.users[0].planExpireAt;
    const res = await notify(paid({ trade_status: 'TRADE_FINISHED' }));
    expect(await res.text()).toBe('success');
    expect(db.users[0].planExpireAt).toEqual(expireAfterFirst);
  });

  it('已完成的订单收到另一个 trade_no：冲突，拒绝，原记录不被覆盖', async () => {
    await notify(paid());
    const res = await notify(paid({ trade_no: 'T2' }));
    expect(res.status).toBe(400);
    expect(db.payments[0].transactionId).toBe('T1');
  });

  it('同一个 trade_no 想核销另一张订单：冲突，拒绝', async () => {
    await notify(paid());
    db.payments.push({ id: 'p2', orderNo: 'ENE2', userId: 'u1', plan: 'PRO', billingPeriod: 'monthly', amount: '198.00', status: 'pending', paymentMethod: 'alipay', transactionId: null });
    const res = await notify(paid({ out_trade_no: 'ENE2' }));
    expect(res.status).toBe(400);
    expect(db.payments[1].status).toBe('pending');
  });

  it('TRADE_CLOSED / WAIT_BUYER_PAY：验签通过只回 success，不开通', async () => {
    for (const status of ['TRADE_CLOSED', 'WAIT_BUYER_PAY']) {
      const res = await notify(paid({ trade_status: status }));
      expect(await res.text()).toBe('success');
    }
    expect(db.payments[0].status).toBe('pending');
    expect(db.users[0].plan).toBe('FREE');
  });

  it('同方案续费在原到期日上顺延；换方案从现在起算', async () => {
    const future = new Date(Date.now() + 10 * 86400e3);
    db.subs = [{ id: 'sub-1', userId: 'u1', plan: 'PRO', endDate: future }];
    await notify(paid());
    const renewed = new Date(db.users[0].planExpireAt).getTime();
    expect(renewed).toBeGreaterThan(future.getTime() + 27 * 86400e3);

    db.payments.push({ id: 'p3', orderNo: 'ENE3', userId: 'u1', plan: 'FULL', billingPeriod: 'monthly', amount: '398.00', status: 'pending', paymentMethod: 'alipay', transactionId: null });
    await notify(paid({ out_trade_no: 'ENE3', trade_no: 'T3', total_amount: '398.00' }));
    const switched = new Date(db.users[0].planExpireAt).getTime();
    expect(db.users[0].plan).toBe('FULL');
    expect(switched).toBeLessThan(Date.now() + 32 * 86400e3);
  });

  it('缺少 out_trade_no / trade_no：拒绝', async () => {
    expect((await notify(signed({ trade_no: 'T1', total_amount: '198.00' }))).status).toBe(400);
    expect((await notify(signed({ out_trade_no: 'ENE1', total_amount: '198.00' }))).status).toBe(400);
  });
});
