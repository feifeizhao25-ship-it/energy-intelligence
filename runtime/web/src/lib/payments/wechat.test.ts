import { createCipheriv, generateKeyPairSync } from 'node:crypto';
import { buildJsapiBody, decryptResource, placeWechatOrder, queryPath, readWechatConfig, refundBody, signWechatMessage, verifyNotifySignature } from './wechat';

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

function env(extra: Record<string, string> = {}) {
  const pair = keys();
  return {
    NODE_ENV: 'test',
    WECHAT_PAY_APP_ID: 'wx123',
    WECHAT_PAY_MCH_ID: '1900000001',
    WECHAT_PAY_API_V3_KEY: '12345678901234567890123456789012',
    WECHAT_PAY_SERIAL_NO: 'SERIAL',
    WECHAT_PAY_PRIVATE_KEY: pair.privateKey,
    WECHAT_PAY_PLATFORM_PUBLIC_KEY: pair.publicKey,
    WECHAT_PAY_NOTIFY_URL: 'https://example.cn/api/membership/wechat/notify',
    ...extra,
  } as NodeJS.ProcessEnv;
}

it('六种支付场景：未配置、扫码下单、公众号缺标识、验签、金额字段、退款参数', async () => {
  expect(readWechatConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBeNull();
  const config = readWechatConfig(env())!;
  const saved = process.env;
  process.env = env();
  const native = await placeWechatOrder({
    orderNo: 'ENE1', description: '专业版年付', amountFen: 198000, tradeType: 'native',
    transport: async (request) => {
      expect(request.url).toContain('/v3/pay/transactions/native');
      expect(request.headers.Authorization).toMatch(/^WECHATPAY2-SHA256-RSA2048 /);
      expect(JSON.parse(request.body).amount).toEqual({ total: 198000, currency: 'CNY' });
      return { status: 200, body: JSON.stringify({ code_url: 'weixin://pay/example' }) };
    },
  });
  expect(native.code_url).toMatch(/^weixin:\/\//);
  process.env = saved;
  expect(() => buildJsapiBody(config, { orderNo: 'E', description: 'd', amountFen: 1, openid: ' ' })).toThrow(/付款人标识/);
  const body = '{"id":"1"}';
  const signature = signWechatMessage(config.privateKey, `1\nnonce\n${body}\n`);
  expect(verifyNotifySignature(config, '1', 'nonce', body, signature)).toBe(true);
  expect(verifyNotifySignature(config, '1', 'nonce', body, 'not-a-signature')).toBe(false);
  expect(queryPath(config.mchId, 'ENE1')).toContain('mchid=1900000001');
  expect(refundBody({ orderNo: 'ENE1', refundNo: 'R1', refundFen: 100, totalFen: 198000 }).amount.refund).toBe(100);
  expect(() => refundBody({ orderNo: 'ENE1', refundNo: 'R1', refundFen: 9, totalFen: 1 })).toThrow(/退款金额/);
});

it('通知密文可以解出订单号，生产环境拒绝沙箱', () => {
  const key = '12345678901234567890123456789012';
  const nonce = Buffer.from('012345678901');
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), nonce);
  cipher.setAAD(Buffer.from('transaction'));
  const payload = Buffer.from(JSON.stringify({ out_trade_no: 'ENE1', transaction_id: 'T1', trade_state: 'SUCCESS', amount: { total: 198000, currency: 'CNY' } }));
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
  const parsed = decryptResource(key, { ciphertext: encrypted.toString('base64'), nonce: nonce.toString(), associated_data: 'transaction' });
  expect(parsed.out_trade_no).toBe('ENE1');
  expect(parsed.amount.total).toBe(198000);
  expect(() => readWechatConfig(env({ NODE_ENV: 'production', WECHAT_PAY_SANDBOX: 'true' }))).toThrow(/禁止微信支付沙箱/);
});
