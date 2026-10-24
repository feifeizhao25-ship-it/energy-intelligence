const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).hostname !== '127.0.0.1' || new URL(databaseUrl).pathname !== '/energy_integration_test') throw new Error('Requires isolated local test database');
jest.mock('server-only',()=>({}),{virtual:true});
jest.mock('@/lib/auth/auth-options',()=>({authOptions:{}}));
jest.mock('next-auth',()=>({getServerSession:jest.fn()}));
jest.mock('@/lib/prisma',()=>{const {PrismaClient}=require('@prisma/client');return {prisma:new PrismaClient({datasources:{db:{url:process.env.INTEGRATION_DATABASE_URL}}})};});
import fs from 'fs';import path from 'path';
import {NextRequest} from 'next/server';
import {prisma} from '@/lib/prisma';import {getServerSession} from 'next-auth';
import {POST} from '@/app/api/exports/route';
import {POST as reserve} from '@/app/api/exports/reserve/route';
import {GET} from '@/app/api/exports/download/[filename]/route';
const owner=`export-${Date.now()}`,other=owner+'-other';let filename:string;
beforeAll(async()=>{
 await prisma.user.createMany({data:[{id:owner,email:owner+'@test.invalid'},{id:other,email:other+'@test.invalid'}]});
 await prisma.calculation.createMany({data:Array.from({length:74},(_,i)=>({id:owner+'-'+String(i).padStart(3,'0'),userId:i===73?other:owner,type:'SOLAR',input:{index:i},output:{energy:{annualGeneration:i}},createdAt:new Date('2026-10-01')}))});
 (getServerSession as jest.Mock).mockResolvedValue({user:{id:owner}});
});
afterAll(async()=>{
 await prisma.calculation.deleteMany({where:{userId:{in:[owner,other]}}});await prisma.quotaUsage.deleteMany({where:{userId:{in:[owner,other]}}});await prisma.user.deleteMany({where:{id:{in:[owner,other]}}});await prisma.$disconnect();
 if(filename)for(const suffix of ['', '.meta.json'])fs.rmSync(path.join(process.cwd(),'.exports',filename+suffix),{force:true});
});
test('real DB, quota, disk and download: 73 owner records, no foreign records, invalid format consumes nothing',async()=>{
 const invalid=await reserve(new Request('http://localhost/api/exports/reserve',{method:'POST',body:'{"format":"xlsx"}'}));expect(invalid.status).toBe(400);
 expect(await prisma.quotaUsage.count({where:{userId:owner}})).toBe(0);
 const result=await POST(new NextRequest('http://localhost/api/exports',{method:'POST',body:JSON.stringify({dataType:'calculations',format:'json'})}));expect(result.status).toBe(200);
 const body=await result.json();filename=body.data.filename;expect(body.data.totalRecords).toBe(73);
 const request=new NextRequest('http://localhost'+body.data.downloadUrl);
 const download=await GET(request,{params:Promise.resolve({filename})});expect(download.status).toBe(200);
 const rows=await download.json();expect(rows.map((r:any)=>r.ID)).toEqual(Array.from({length:73},(_,i)=>owner+'-'+String(72-i).padStart(3,'0')));
 expect((await prisma.quotaUsage.findFirstOrThrow({where:{userId:owner,type:'EXPORTS'}})).count).toBe(1);
 (getServerSession as jest.Mock).mockResolvedValue({user:{id:other}});expect((await GET(request,{params:Promise.resolve({filename})})).status).toBe(404);
});
test.each(['stream','meta'])('disk write failure at %s rolls back quota and leaves no downloadable file',async(stage)=>{
 (getServerSession as jest.Mock).mockResolvedValue({user:{id:owner}});
 const before=(await prisma.quotaUsage.aggregate({where:{userId:owner,type:'EXPORTS'},_sum:{count:true}}))._sum.count ?? 0;
 const dir=path.join(process.cwd(),'.exports'); const filesBefore=fs.existsSync(dir)?fs.readdirSync(dir).sort():[];
 const originalWrite=fs.writeFileSync; const originalStream=fs.createWriteStream;
 const spy=stage==='stream'
  ? jest.spyOn(fs,'createWriteStream').mockImplementation(((path: fs.PathLike, options?: unknown)=>{ if(String(path).endsWith('.partial')) throw new Error('disk full'); return originalStream.call(fs, path, options as never); }) as typeof fs.createWriteStream)
  : jest.spyOn(fs,'writeFileSync').mockImplementation(((...args: Parameters<typeof fs.writeFileSync>)=>{ if(String(args[0]).endsWith('.meta.json')) throw new Error('disk full'); return originalWrite.apply(fs, args); }) as typeof fs.writeFileSync);
 try {
  const response=await POST(new NextRequest('http://localhost/api/exports',{method:'POST',body:JSON.stringify({dataType:'calculations',format:'json'})}));
  expect(response.status).toBe(503);expect((await response.json()).data).toBeUndefined();
  expect((await prisma.quotaUsage.aggregate({where:{userId:owner,type:'EXPORTS'},_sum:{count:true}}))._sum.count ?? 0).toBe(before);
  expect(fs.readdirSync(dir).sort()).toEqual(filesBefore);
 }finally{spy.mockRestore();}
});
