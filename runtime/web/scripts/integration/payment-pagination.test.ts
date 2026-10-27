const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).hostname !== '127.0.0.1' || new URL(databaseUrl).pathname !== '/energy_integration_test') throw new Error('Requires isolated local test database');
jest.mock('server-only', () => ({}), {virtual:true});
jest.mock('@/lib/auth/auth-options',()=>({authOptions:{}}));
jest.mock('next-auth',()=>({getServerSession:jest.fn()}));
jest.mock('@/lib/prisma',()=>{const {PrismaClient}=require('@prisma/client');return {prisma:new PrismaClient({datasources:{db:{url:process.env.INTEGRATION_DATABASE_URL}}})};});
import {prisma} from '@/lib/prisma';
import {getServerSession} from 'next-auth';
import {GET} from '@/app/api/membership/me/route';
const owner=`pagination-${Date.now()}`; const other=owner+'-other';
let sub:string; let expected:string[];
beforeAll(async()=>{
 await prisma.user.createMany({data:[{id:owner,email:owner+'@test.invalid'},{id:other,email:other+'@test.invalid'}]});
 sub=(await prisma.subscription.create({data:{userId:owner,plan:'PRO',endDate:new Date('2027-01-01')}})).id;
 const otherSub=await prisma.subscription.create({data:{userId:other,plan:'PRO',endDate:new Date('2027-01-01')}});
 const rows=Array.from({length:45},(_,i)=>({id:`${owner}-${String(i).padStart(3,'0')}`,userId:owner,subscriptionId:sub,orderNo:`${owner}-${i}`,plan:'PRO' as const,billingPeriod:'yearly',amount:1980,status:'completed',createdAt:new Date('2026-10-01')}));
 await prisma.payment.createMany({data:[...rows,{...rows[0],id:other,orderNo:other,userId:other,subscriptionId:otherSub.id}]});
 expected=rows.map(r=>r.id).reverse();
 (getServerSession as jest.Mock).mockResolvedValue({user:{id:owner}});
});
afterAll(async()=>{
 await prisma.payment.deleteMany({where:{userId:{in:[owner,other]}}});
 await prisma.subscription.deleteMany({where:{userId:{in:[owner,other]}}});
 await prisma.user.deleteMany({where:{id:{in:[owner,other]}}}); await prisma.$disconnect();
});
test('real database: deletion before cursor and new payment do not skip older records',async()=>{
 const first=(await (await GET(new Request('http://localhost/api/membership/me'))).json()).data;
 expect(first.subscription.payments.map((p:any)=>p.id)).toEqual(expected.slice(0,20));
 await prisma.payment.delete({where:{id:expected[0]}});
 await prisma.payment.create({data:{id:owner+'-new',userId:owner,subscriptionId:sub,orderNo:owner+'-new',plan:'PRO',billingPeriod:'yearly',amount:1980,status:'completed',createdAt:new Date('2026-10-21')}});
 let cursor=first.paymentPagination.nextCursor; const rest:string[]=[];
 while(cursor){const result=(await (await GET(new Request(`http://localhost/api/membership/me?paymentCursor=${cursor}`))).json()).data;rest.push(...result.subscription.payments.map((p:any)=>p.id));cursor=result.paymentPagination.nextCursor;}
 expect(rest).toEqual(expected.slice(20)); expect(rest).not.toContain(other);
 (getServerSession as jest.Mock).mockResolvedValue({user:{id:other}});
 expect((await GET(new Request(`http://localhost/api/membership/me?paymentCursor=${first.paymentPagination.nextCursor}`))).status).toBe(400);
});
