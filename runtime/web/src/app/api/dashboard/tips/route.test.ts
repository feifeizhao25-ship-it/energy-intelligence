const created: any[] = [];
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { usageLog: { create: jest.fn(async ({ data }: any) => { created.push(data); return data; }) } } }));
import { POST } from './route';

const post = (body: object) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }));

describe('工作台提示「不再提示」', () => {
    it('低优先级提示可关闭并记录；告警、额度提醒不能关闭', async () => {
        expect((await post({ id: 'papers' })).status).toBe(200);
        expect(created[0]).toMatchObject({ userId: 'u1', type: 'TIP_DISMISSED', metadata: { tipId: 'papers' } });
        expect((await post({ id: 'station-alert' })).status).toBe(400);
        expect((await post({ id: 'upgrade' })).status).toBe(400);
        expect(created).toHaveLength(1);
    });
});
