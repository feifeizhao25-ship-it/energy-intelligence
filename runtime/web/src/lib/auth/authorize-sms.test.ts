jest.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: (o: unknown) => o }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } } }));
jest.mock('./sms-store', () => ({ prismaCodeStore: {} }));
jest.mock('./sms-verify', () => ({ ...jest.requireActual('./sms-verify'), verifySmsCode: jest.fn() }));

import { prisma } from '@/lib/prisma';
import { verifySmsCode } from './sms-verify';
import { authorizeSms, syntheticAccountEmail } from './auth-options';
import { LEGAL_VERSION } from '@/lib/legal/consent';

const creds = (over: Record<string, string> = {}) => ({ phone: '13800138000', code: '123456', consent: 'true', ...over });
const row = (over = {}) => ({ id: 'u1', name: '用户_8000', email: syntheticAccountEmail('13800138000'), phone: '13800138000', plan: 'FREE', profileCompleted: false, termsVersion: LEGAL_VERSION, ...over });

describe('短信登录 authorize', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.NENGJIAN_ACCOUNT_EMAIL_DOMAIN;
    jest.mocked(verifySmsCode).mockResolvedValue({ ok: true });
  });

  it('没勾选同意：拒绝，且不消耗验证码、不建用户', async () => {
    await expect(authorizeSms(creds({ consent: '' }))).rejects.toThrow('请先阅读并同意《服务条款》和《隐私政策》');
    await expect(authorizeSms(creds({ consent: 'false' }))).rejects.toThrow('请先阅读并同意');
    await expect(authorizeSms({ phone: '13800138000', code: '123456' })).rejects.toThrow('请先阅读并同意');
    expect(verifySmsCode).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('缺手机号或验证码：中文提示', async () => {
    await expect(authorizeSms(creds({ code: '' }))).rejects.toThrow('请提供手机号和验证码');
  });

  it('验证码错误：把中文原因抛出，不建用户', async () => {
    jest.mocked(verifySmsCode).mockResolvedValue({ ok: false, reason: '验证码无效或已过期' });
    await expect(authorizeSms(creds())).rejects.toThrow('验证码无效或已过期');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('新用户：创建账号并记下同意时间与条款版本', async () => {
    jest.mocked(prisma.user.findFirst).mockResolvedValue(null);
    jest.mocked(prisma.user.create).mockResolvedValue(row() as never);
    await authorizeSms(creds());
    const data = jest.mocked(prisma.user.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.termsVersion).toBe(LEGAL_VERSION);
    expect(data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(data.plan).toBe('FREE');
    expect(data.email).toBe('13800138000@account.internal');
    expect(String(data.email)).not.toContain('xinnengyuan.ai');
  });

  it('老用户首次在新版条款下登录：补记同意；版本一致则不重复写', async () => {
    jest.mocked(prisma.user.findFirst).mockResolvedValue(row({ termsVersion: null }) as never);
    jest.mocked(prisma.user.update).mockResolvedValue(row() as never);
    await authorizeSms(creds());
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    jest.mocked(prisma.user.update).mockClear();
    jest.mocked(prisma.user.findFirst).mockResolvedValue(row() as never);
    await authorizeSms(creds());
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('登录返回的用户信息不带验证码等敏感字段', async () => {
    jest.mocked(prisma.user.findFirst).mockResolvedValue(row() as never);
    const out = await authorizeSms(creds());
    expect(Object.keys(out).sort()).toEqual(['email', 'id', 'name', 'phone', 'plan', 'profileCompleted']);
  });
});
