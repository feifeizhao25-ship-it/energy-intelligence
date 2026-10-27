import 'server-only';
import { createDecipheriv, createSign, createVerify, randomBytes } from 'node:crypto';

const HOST = 'https://api.mch.weixin.qq.com';

export interface WechatConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKey: string;
  platformPublicKey: string;
  notifyUrl: string;
  sandbox: boolean;
}

export function readWechatConfig(env: NodeJS.ProcessEnv = process.env): WechatConfig | null {
  const appId = env.WECHAT_PAY_APP_ID?.trim() || '';
  const mchId = env.WECHAT_PAY_MCH_ID?.trim() || '';
  const apiV3Key = (env.WECHAT_PAY_API_V3_KEY || env.WECHAT_PAY_API_KEY || '').trim();
  const serialNo = env.WECHAT_PAY_SERIAL_NO?.trim() || '';
  const privateKey = (env.WECHAT_PAY_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const platformPublicKey = (env.WECHAT_PAY_PLATFORM_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
  const notifyUrl = env.WECHAT_PAY_NOTIFY_URL?.trim() || '';
  const sandbox = env.WECHAT_PAY_SANDBOX === 'true' || env.WECHAT_PAY_SANDBOX === '1';
  if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey || !notifyUrl) return null;
  if (env.NODE_ENV === 'production' && sandbox) throw new Error('生产环境禁止微信支付沙箱');
  if (env.NODE_ENV === 'production' && env.PAYMENT_SIMULATION === '1') throw new Error('生产环境禁止模拟支付');
  if (apiV3Key.length !== 32) throw new Error('微信支付密钥长度不正确');
  return { appId, mchId, apiV3Key, serialNo, privateKey, platformPublicKey, notifyUrl, sandbox };
}

export function signWechatMessage(privateKey: string, message: string) {
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  return signer.sign(privateKey, 'base64');
}

export function authorizationHeader(config: WechatConfig, method: string, path: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signWechatMessage(config.privateKey, message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
}

export function verifyNotifySignature(config: WechatConfig, timestamp: string, nonce: string, body: string, signature: string) {
  if (!config.platformPublicKey || !signature) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${timestamp}\n${nonce}\n${body}\n`);
  try {
    return verifier.verify(config.platformPublicKey, signature, 'base64');
  } catch {
    return false;
  }
}

export function decryptResource(apiV3Key: string, resource: { ciphertext: string; nonce: string; associated_data?: string }) {
  const buffer = Buffer.from(resource.ciphertext, 'base64');
  if (buffer.length <= 16) throw new Error('微信支付通知密文无效');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key), Buffer.from(resource.nonce));
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data));
  decipher.setAuthTag(buffer.subarray(buffer.length - 16));
  const plain = Buffer.concat([decipher.update(buffer.subarray(0, buffer.length - 16)), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as {
    out_trade_no: string; transaction_id: string; trade_state: string;
    amount: { total: number; currency: string };
  };
}

export function buildNativeBody(config: WechatConfig, input: { orderNo: string; description: string; amountFen: number }) {
  return {
    appid: config.appId,
    mchid: config.mchId,
    description: input.description.slice(0, 127),
    out_trade_no: input.orderNo,
    notify_url: config.notifyUrl,
    amount: { total: input.amountFen, currency: 'CNY' },
  };
}

export function buildJsapiBody(config: WechatConfig, input: { orderNo: string; description: string; amountFen: number; openid: string }) {
  if (!input.openid.trim()) throw new Error('公众号支付需要付款人标识');
  return { ...buildNativeBody(config, input), payer: { openid: input.openid } };
}

export async function placeWechatOrder(input: {
  orderNo: string; description: string; amountFen: number; tradeType: 'native' | 'jsapi'; openid?: string;
  transport?: (request: { method: string; url: string; body: string; headers: Record<string, string> }) => Promise<{ status: number; body: string }>;
}) {
  const config = readWechatConfig();
  if (!config) {
    const error = new Error('微信支付未配置');
    (error as Error & { code?: string }).code = 'WECHAT_PAY_NOT_CONFIGURED';
    throw error;
  }
  const path = input.tradeType === 'jsapi' ? '/v3/pay/transactions/jsapi' : '/v3/pay/transactions/native';
  const payload = input.tradeType === 'jsapi'
    ? buildJsapiBody(config, { ...input, openid: input.openid || '' })
    : buildNativeBody(config, input);
  const body = JSON.stringify(payload);
  const headers = {
    Authorization: authorizationHeader(config, 'POST', path, body),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const transport = input.transport || (async (request) => {
    const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body });
    return { status: response.status, body: await response.text() };
  });
  const response = await transport({ method: 'POST', url: `${HOST}${path}`, body, headers });
  if (response.status >= 300) throw new Error('微信支付下单失败');
  const parsed = JSON.parse(response.body) as { code_url?: string; prepay_id?: string };
  if (input.tradeType === 'native' && !parsed.code_url) throw new Error('微信支付未返回二维码链接');
  if (input.tradeType === 'jsapi' && !parsed.prepay_id) throw new Error('微信支付未返回预支付单号');
  return parsed;
}

export function queryPath(mchId: string, orderNo: string) {
  return `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${encodeURIComponent(mchId)}`;
}

export function refundBody(input: { orderNo: string; refundNo: string; refundFen: number; totalFen: number }) {
  if (input.refundFen <= 0 || input.refundFen > input.totalFen) throw new Error('退款金额无效');
  return {
    out_trade_no: input.orderNo,
    out_refund_no: input.refundNo,
    amount: { refund: input.refundFen, total: input.totalFen, currency: 'CNY' },
  };
}
