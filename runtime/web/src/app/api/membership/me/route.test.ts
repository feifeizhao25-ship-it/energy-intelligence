jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn() } } }));
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';
const session = getServerSession as jest.Mock;
const find = prisma.user.findUnique as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); session.mockResolvedValue({ user: { id: 'owner' } }); });
test('45 payments remain accessible in three bounded pages, only signed in owner queried', async () => {
    const records = Array.from({length:45}, (_,i)=>({id:`payment-${i}`,amount:19.8}));
    find.mockImplementation(async query => {
        expect(query.where).toEqual({id:'owner'});
        const p = query.select.subscription.select.payments;
        expect(p.where).toEqual({status:'completed'});
        expect(p.orderBy).toEqual([{createdAt:'desc'},{id:'desc'}]);
        return {id:'owner', plan:'FREE', planExpireAt:null, lastResetAt:new Date(), subscription:{payments:records.slice(p.skip,p.skip+p.take)}};
    });
    const all: string[]=[];
    for (let page=1;page<=3;page++) {
        const response=await GET(new Request(`http://localhost/api/membership/me?paymentPage=${page}`));
        const {data}=await response.json();
        expect(data.paymentPagination.nextPage).toBe(page<3?page+1:null);
        expect(data.subscription.payments.length).toBe(page<3?20:5);
        all.push(...data.subscription.payments.map((p:any)=>p.id));
    }
    expect(all).toEqual(records.map(p=>p.id));
});
test.each(['0','-1','1.5','NaN','1000001'])('rejects invalid page %s without querying database', async page => {
    expect((await GET(new Request(`http://localhost/api/membership/me?paymentPage=${page}`))).status).toBe(400);
    expect(find).not.toHaveBeenCalled();
});
test('unauthenticated request never queries records',async()=>{
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect(find).not.toHaveBeenCalled();
});
