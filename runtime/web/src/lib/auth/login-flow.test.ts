jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { digitsOnly, isValidPhone, loginErrorMessage, sendCodeErrorMessage } from './login-flow';

describe('登录页逻辑', () => {
  it('手机号校验与中国大陆号段一致', () => {
    expect(isValidPhone('13800138000')).toBe(true);
    expect(isValidPhone(' 19912345678 ')).toBe(true);
    for (const bad of ['', '12800138000', '1380013800', '138001380001', 'abc']) expect(isValidPhone(bad)).toBe(false);
  });

  it('粘贴带空格、横线的手机号也能整理成纯数字，并限制长度', () => {
    expect(digitsOnly('138 0013-8000', 11)).toBe('13800138000');
    expect(digitsOnly('1234567', 6)).toBe('123456');
  });

  it('登录失败：我们抛的中文原因原样给用户；英文/内部错误给中文兜底', () => {
    expect(loginErrorMessage('验证码无效或已过期')).toBe('验证码无效或已过期');
    expect(loginErrorMessage('请先阅读并同意《服务条款》和《隐私政策》')).toBe('请先阅读并同意《服务条款》和《隐私政策》');
    for (const raw of ['CredentialsSignin', 'Configuration', 'fetch failed', undefined, null]) {
      expect(loginErrorMessage(raw as never)).toBe('登录失败，请检查手机号和验证码后重试');
    }
  });

  it('发送验证码失败：接口的中文原因原样显示；否则按状态码给中文兜底', () => {
    expect(sendCodeErrorMessage({ error: '发送频繁，请 60 秒后再试' }, 429)).toBe('发送频繁，请 60 秒后再试');
    expect(sendCodeErrorMessage({ error: 'Internal error' }, 500)).toBe('验证码发送失败，请稍后重试');
    expect(sendCodeErrorMessage(null, 429)).toBe('发送太频繁，请稍后再试');
  });
});
