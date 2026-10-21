const url=process.env.INTEGRATION_DATABASE_URL;
if(!url||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/energy_integration_test')throw new Error('Requires isolated local database');
jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/prisma',()=>{const {PrismaClient}=require('@prisma/client');return {prisma:new PrismaClient({datasources:{db:{url:process.env.INTEGRATION_DATABASE_URL}}})};});
import {prisma} from '@/lib/prisma';
import {consumeQuota,getQuotaUsage,quotaPeriod,QUOTA_LIMITS} from '@/lib/audit/quota';
const id=`quota-${Date.now()}`;
beforeAll(async()=>{await prisma.user.create({data:{id,email:id+'@test.invalid'}});});
afterEach(async()=>{await prisma.quotaUsage.deleteMany({where:{userId:id}});await prisma.user.update({where:{id},data:{plan:'FREE',planExpireAt:null}});});
afterAll(async()=>{await prisma.user.delete({where:{id}});await prisma.$disconnect();});
test('12 simultaneous export attempts admit exactly three and persist exactly three',async()=>{
 const results=await Promise.all(Array.from({length:12},()=>consumeQuota(id,'EXPORTS')));
 expect(results.filter(r=>r.success)).toHaveLength(3);expect(results.filter(r=>!r.success&&r.usage.exceeded)).toHaveLength(9);
 expect((await getQuotaUsage(id,'EXPORTS')).used).toBe(3);
});
test('legacy daily usage counts toward this month; previous month does not',async()=>{
 const {start}=quotaPeriod('EXPORTS');await prisma.quotaUsage.createMany({data:[{userId:id,type:'EXPORTS',count:2,periodStart:new Date(start.getTime()+86400000)},{userId:id,type:'EXPORTS',count:90,periodStart:new Date(start.getTime()-1)}]});
 expect((await consumeQuota(id,'EXPORTS')).success).toBe(true);expect((await consumeQuota(id,'EXPORTS')).success).toBe(false);expect((await getQuotaUsage(id,'EXPORTS')).used).toBe(3);
});
test('expired premium uses free quota and FULL does not crash',async()=>{
 await prisma.user.update({where:{id},data:{plan:'PRO',planExpireAt:new Date(0)}});expect((await getQuotaUsage(id,'EXPORTS')).limit).toBe(3);
 await prisma.user.update({where:{id},data:{plan:'FULL',planExpireAt:null}});expect((await consumeQuota(id,'EXPORTS')).success).toBe(true);expect((await getQuotaUsage(id,'EXPORTS')).limit).toBe(-1);
});
test('invalid amount cannot mutate stored quota',async()=>{
 for(const amount of [0,-1,0.5,NaN,Infinity])await expect(consumeQuota(id,'EXPORTS',amount)).rejects.toThrow('参数');
 expect(await prisma.quotaUsage.count({where:{userId:id}})).toBe(0);
});
test('missing account fails closed',async()=>{const result=await consumeQuota(id+'-missing','EXPORTS');expect(result.success).toBe(false);expect(result.usage.available).toBe(false);});
test('Shanghai boundaries independent of server timezone, including year rollover',()=>{
 expect(quotaPeriod('EXPORTS',new Date('2026-12-31T16:00:00Z'))).toEqual({start:new Date('2026-12-31T16:00:00Z'),end:new Date('2027-01-31T16:00:00Z')});
 expect(quotaPeriod('AI_CALLS',new Date('2026-10-21T16:00:00Z'))).toEqual({start:new Date('2026-10-21T16:00:00Z'),end:new Date('2026-10-22T16:00:00Z')});
 expect(QUOTA_LIMITS.PRO.EXPORTS).toBe(30);expect(QUOTA_LIMITS.MAINTENANCE.EXPORTS).toBe(50);
});
test('usage read failure is surfaced rather than fabricated as unused quota',async()=>{
 const read=jest.spyOn(prisma.quotaUsage,'aggregate').mockRejectedValueOnce(new Error('database unavailable'));
 try{await expect(getQuotaUsage(id,'EXPORTS')).rejects.toThrow('database unavailable');}finally{read.mockRestore();}
});
test('transaction failure reports unavailable rather than exhaustion or success',async()=>{
 const transaction=jest.spyOn(prisma,'$transaction').mockRejectedValueOnce(new Error('database unavailable'));
 try{expect(await consumeQuota(id,'EXPORTS')).toMatchObject({success:false,usage:{available:false,exceeded:false}});}finally{transaction.mockRestore();}
});
