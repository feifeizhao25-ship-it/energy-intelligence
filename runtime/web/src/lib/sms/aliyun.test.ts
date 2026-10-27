import { smsDeliveryMode } from './aliyun';

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { run(); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

it('只有开发环境允许没有密钥时走模拟，测试和生产返回未配置', () => {
  withEnv({
    NODE_ENV: 'test',
    ALIYUN_ACCESS_KEY_ID: '',
    ALIYUN_ACCESS_KEY_SECRET: '',
    ALIYUN_SMS_TEMPLATE_CODE: '',
  }, () => expect(smsDeliveryMode()).toBe('unconfigured'));
  withEnv({
    NODE_ENV: 'production',
    ALIYUN_ACCESS_KEY_ID: undefined,
    ALIYUN_ACCESS_KEY_SECRET: undefined,
    ALIYUN_SMS_TEMPLATE_CODE: undefined,
  }, () => expect(smsDeliveryMode()).toBe('unconfigured'));
  withEnv({
    NODE_ENV: 'development',
    ALIYUN_ACCESS_KEY_ID: '',
    ALIYUN_ACCESS_KEY_SECRET: '',
    ALIYUN_SMS_TEMPLATE_CODE: '',
  }, () => expect(smsDeliveryMode()).toBe('mock'));
  withEnv({
    NODE_ENV: 'production',
    ALIYUN_ACCESS_KEY_ID: 'ak',
    ALIYUN_ACCESS_KEY_SECRET: 'sk',
    ALIYUN_SMS_TEMPLATE_CODE: 'SMS_1',
  }, () => expect(smsDeliveryMode()).toBe('live'));
});
