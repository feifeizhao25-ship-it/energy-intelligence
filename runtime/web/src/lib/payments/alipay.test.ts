jest.mock('server-only', () => ({}), { virtual: true });

import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';
import {
  canonicalAlipayParams,
  canonicalPrice,
  createAlipayPagePayUrl,
  verifyAlipayCallback,
} from './alipay';
import { Plan } from '@/lib/membership/plans';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

beforeAll(() => {
  process.env.ALIPAY_APP_ID = '2026000000000001';
  process.env.ALIPAY_SELLER_ID = '2088000000000001';
  process.env.ALIPAY_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  process.env.ALIPAY_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  process.env.ALIPAY_NOTIFY_URL = 'https://api.example.cn/api/membership/alipay/notify';
  process.env.ALIPAY_RETURN_URL = 'https://example.cn/membership/result';
  process.env.ALIPAY_SANDBOX = 'false';
});

test('page-pay URL carries canonical server price and independently valid RSA2 signature', () => {
  expect(canonicalPrice(Plan.FULL, 'monthly')).toBe(398);
  const url = createAlipayPagePayUrl({
    orderNo: 'ENE20260902001', plan: Plan.FULL, billingPeriod: 'monthly', amount: 398,
  });
  const query = Object.fromEntries(new URL(url).searchParams.entries());
  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalAlipayParams(query), 'utf8');
  expect(verifier.verify(publicKey, query.sign, 'base64')).toBe(true);
  expect(JSON.parse(query.biz_content).total_amount).toBe('398.00');
});

test('callback verification excludes sign_type and rejects amount tampering', () => {
  const params: Record<string, string> = {
    app_id: process.env.ALIPAY_APP_ID!, seller_id: process.env.ALIPAY_SELLER_ID!,
    out_trade_no: 'ENE20260902002', trade_no: '20260902220001',
    trade_status: 'TRADE_SUCCESS', total_amount: '198.00', sign_type: 'RSA2',
  };
  const signer = createSign('RSA-SHA256');
  signer.update(canonicalAlipayParams(params, true), 'utf8');
  params.sign = signer.sign(privateKey, 'base64');
  expect(verifyAlipayCallback(params)).toBe(true);
  params.total_amount = '0.01';
  expect(verifyAlipayCallback(params)).toBe(false);
});
