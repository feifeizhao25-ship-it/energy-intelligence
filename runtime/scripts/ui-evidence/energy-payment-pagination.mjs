import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../web/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.UI_BASE_URL || 'http://127.0.0.1:3411';
assert.equal(new URL(base).hostname,'127.0.0.1');
const db=new PrismaClient({datasources:{db:{url:'postgresql://feifei00@127.0.0.1:5432/energy_integration_test'}}});
const out=process.env.UI_OUTPUT || '/tmp/energy-payment-pagination'; fs.mkdirSync(out,{recursive:true});
const id=`ui-pagination-${Date.now()}`, phone='19900009291';
let browser; const evidence=[];
try {
 await db.user.create({data:{id,email:id+'@example.invalid',phone,name:'付款历史测试用户',plan:'PRO',profileCompleted:true}});
 const sub=await db.subscription.create({data:{userId:id,plan:'PRO',endDate:new Date('2027-01-01')}});
 const descriptions=Array.from({length:45},(_,i)=>`测试付款记录${String(i).padStart(2,'0')}：`+(i===44?'完整订单参考'+ 'ABCDEFGHIJ'.repeat(20):'专业会员订阅'));
 await db.payment.createMany({data:descriptions.map((description,i)=>({id:id+'-'+String(i).padStart(2,'0'),orderNo:id+'-'+i,userId:id,subscriptionId:sub.id,plan:'PRO',billingPeriod:'yearly',amount:'1980.50',status:'completed',description,createdAt:new Date('2026-10-01T16:30:00Z')}))});
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [390,1440]) {
  await db.verificationCode.create({data:{phone,code:'284736',expiresAt:new Date(Date.now()+600000)}});
  const ctx=await browser.newContext({viewport:{width,height:900},locale:'zh-CN',timezoneId:'America/Los_Angeles'});
  const csrf=await(await ctx.request.get(base+'/api/auth/csrf')).json();
  await ctx.request.post(base+'/api/auth/callback/sms',{form:{phone,code:'284736',consent:'true',csrfToken:csrf.csrfToken,json:'true',callbackUrl:base+'/membership'}});
  for (const [scenario,status,payload] of [
   ['initial-503',503,'<html>upstream failure</html>'],
   ['initial-empty',200,'{"success":true}'],
   ['initial-html',200,'<html>invalid response</html>'],
   ['initial-expired',401,'{}'],
  ]) {
   const recovery=await ctx.newPage();let broken=true;
   await recovery.route('**/api/membership/me',async route=>{if(broken)await route.fulfill({status,body:payload});else await route.continue();});
   await recovery.goto(base+'/membership',{waitUntil:'networkidle'});
   await recovery.getByRole('button',{name:'重新加载会员信息',exact:true}).waitFor();
   assert.equal(await recovery.getByRole('link',{name:'重新登录',exact:true}).count(),1);
   const alert=await recovery.locator('main').getByRole('alert').innerText();assert.ok(/(会员信息|登录)/.test(alert));
   await recovery.screenshot({path:`${out}/${width}-${scenario}.png`,fullPage:true});
   broken=false;await recovery.getByRole('button',{name:'重新加载会员信息',exact:true}).click();
   await recovery.getByRole('heading',{name:'会员中心',exact:true}).waitFor();
   assert.equal(await recovery.locator('main section strong').count(),20);
   await recovery.screenshot({path:`${out}/${width}-${scenario}-recovered.png`,fullPage:true});
   await recovery.close();
  }
  const page=await ctx.newPage(), apis=[], pending=[];
  page.on('response',r=>{if(r.url().includes('/api/membership/me'))pending.push(r.text().then(body=>apis.push({url:r.url(),status:r.status(),body})));});
  await page.goto(base+'/membership',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'会员中心',exact:true}).waitFor();
  const dismiss=page.getByRole('button',{name:'不再显示',exact:true}); if(await dismiss.isVisible())await dismiss.click();
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:'付款记录',exact:true})});
  assert.equal(await section.locator('strong').count(),20);
  // Fault injection only for the second page; login and successful reads use the real local server/database.
  let fault=true;
  await page.route('**/api/membership/me?paymentCursor=*',async route=>{if(fault){fault=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'付款记录暂时无法读取，请重试'})});}else await route.continue();});
  await page.getByRole('button',{name:'加载更多付款记录',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'会员信息暂时'}).waitFor();
  assert.equal(await section.locator('strong').count(),20);
  await page.screenshot({path:`${out}/${width}-retry.png`,fullPage:true});
  for(const count of [40,45]) {await page.getByRole('button',{name:'加载更多付款记录',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('main section strong').length===n,count);}
  assert.equal(await page.getByRole('button',{name:'加载更多付款记录',exact:true}).count(),0);
  const body=await page.locator('body').innerText();
  for(const description of descriptions)assert.ok(body.includes(description),'missing complete description');
  const amount=await section.locator('strong').first().innerText();
  const date=await section.locator('.text-sm').first().innerText();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await page.screenshot({path:`${out}/${width}-complete.png`,fullPage:true});
  fs.writeFileSync(`${out}/${width}.txt`,body); await Promise.all(pending);
  fs.writeFileSync(`${out}/${width}.api.json`,JSON.stringify(apis,null,2));
  evidence.push({width,records:45,amount,date,overflow,completeDescriptions:true,retryPreservedRecords:true,initialRecoveryScenarios:4,kind:'real local browser/API/PostgreSQL; seeded payments; injected 503; no real payment'});
  await ctx.close();
 }
 fs.writeFileSync(out+'/verification.json',JSON.stringify(evidence,null,2));
 for(const row of evidence){assert.equal(row.amount,'¥1,980.50');assert.equal(row.date,'2026/10/2（北京时间）');assert.equal(row.overflow,false);}
 console.log('PASS: both widths, 45 complete records, retry, amount, Shanghai date, no horizontal overflow');
} finally {
 await browser?.close();
 await db.payment.deleteMany({where:{userId:id}});await db.subscription.deleteMany({where:{userId:id}});await db.user.deleteMany({where:{id}});await db.verificationCode.deleteMany({where:{phone}});await db.$disconnect();
}
