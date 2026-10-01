import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
import { getServerSession } from 'next-auth';
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/auth/sms-store', () => ({ prismaCodeStore: {} }));
jest.mock('@/lib/auth/sms-verify', () => ({ verifySmsCode: jest.fn() }));
jest.mock('@/lib/oss/client', () => ({ deleteUserFiles: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() }, verificationCode: { deleteMany: jest.fn() } } }));
jest.mock('@/lib/account/erasure', () => {
  const actual = jest.requireActual('@/lib/account/erasure');
  return { ...actual, eraseUser: jest.fn() };
});

import { prisma } from '@/lib/prisma';
import { verifySmsCode } from '@/lib/auth/sms-verify';
import { deleteUserFiles } from '@/lib/oss/client';
import { eraseUser, FileCleanupError, TeamHasMembersError } from '@/lib/account/erasure';
import { DELETE } from './route';

const del = (body: unknown) => DELETE(new NextRequest('http://x/api/user/account', { method: 'DELETE', body: JSON.stringify(body) }));
const good = { code: '123456', confirm: '确认注销' };

describe('注销账号接口', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } } as never);
    jest.mocked(prisma.user.findFirst).mockResolvedValue({ phone: '13800138000' } as never);
    jest.mocked(verifySmsCode).mockResolvedValue({ ok: true });
    jest.mocked(eraseUser).mockResolvedValue({ deleted: { Project: 1 }, retained: { Payment: 1 }, failed: [] });
  });

  it('没输入「确认注销」：400，不验证码、不删', async () => {
    expect((await del({ code: '123456' })).status).toBe(400);
    expect(verifySmsCode).not.toHaveBeenCalled();
    expect(eraseUser).not.toHaveBeenCalled();
  });

  it('验证码不对（会话被别人拿到也注销不了）：400，不删', async () => {
    jest.mocked(verifySmsCode).mockResolvedValue({ ok: false, reason: '验证码无效或已过期' });
    const res = await del(good);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: '验证码无效或已过期' });
    expect(eraseUser).not.toHaveBeenCalled();
  });

  it('成功：把「先删 OSS 文件」作为 beforeErase 交给 eraseUser，并说明付款记录保留', async () => {
    const res = await del(good);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retained).toEqual({ Payment: 1 });
    expect(body.message).toMatch(/付款记录.*保留/);
    const options = jest.mocked(eraseUser).mock.calls[0][2];
    await options!.beforeErase!();
    expect(deleteUserFiles).toHaveBeenCalledWith('u1');
  });

  it('对象存储不可用：503 中文提示，账号保留（FileCleanupError）', async () => {
    jest.mocked(eraseUser).mockRejectedValue(new FileCleanupError({ cause: new Error('oss down') }));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await del(good);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/账号尚未注销/);
  });

  it('团队里还有成员：409', async () => {
    jest.mocked(eraseUser).mockRejectedValue(new TeamHasMembersError(2));
    const res = await del(good);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('TEAM_HAS_MEMBERS');
  });

  it('部分数据没删干净：500 并列出失败的表，不谎报完成', async () => {
    jest.mocked(eraseUser).mockResolvedValue({ deleted: {}, retained: {}, failed: ['Project'] });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await del(good);
    expect(res.status).toBe(500);
    expect((await res.json()).failed).toEqual(['Project']);
  });
});
