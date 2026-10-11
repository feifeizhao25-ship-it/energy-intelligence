const calls: any[] = [];
let session: any = { user: { id: 'u1' } }; // 短信登录的会话：没有 email
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => session) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(async (args: any) => { calls.push(['find', args]); return { name: '周海涛', phone: '138' }; }),
            update: jest.fn(async (args: any) => { calls.push(['update', args]); return { name: args.data.name }; }),
        },
    },
}));
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

describe('/api/user/profile', () => {
    beforeEach(() => { calls.length = 0; session = { user: { id: 'u1' } }; });

    it('没有 email 的会话也能读取资料（按用户 ID 查询）', async () => {
        const res = await GET();
        expect(res.status).toBe(200);
        expect(calls[0][1].where).toEqual({ id: 'u1' });
    });

    it('保存只写资料字段、只返回资料字段，不回传密码等整条记录', async () => {
        const res = await POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ name: ' 周海涛 ', plan: 'ENTERPRISE', password: 'x' }) }));
        expect(res.status).toBe(200);
        const args = calls[0][1];
        expect(args.where).toEqual({ id: 'u1' });
        expect(args.data.name).toBe('周海涛');
        expect(args.data).not.toHaveProperty('plan');
        expect(args.data).not.toHaveProperty('password');
        expect(args.select).toBeDefined();
        expect(args.select).not.toHaveProperty('password');
    });

    it('未登录 401', async () => {
        session = null;
        expect((await GET()).status).toBe(401);
    });
});
