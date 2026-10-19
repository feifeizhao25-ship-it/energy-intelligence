const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire('/Users/feifei00/Documents/CodexWorktrees/energy-production/runtime/web/package.json');const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:'postgresql://feifei00@localhost/energy_ui_evidence_20261019'}}});
const out='/Users/feifei00/Documents/四项目UI完整证据-20261019/membership-energy-cn';fs.mkdirSync(out,{recursive:true});const rows=[];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(let n=0;n<5;n++){
 const user=await db.user.findUniqueOrThrow({where:{email:`ui-${n}@example.invalid`}});const expected=n===0?3:7;if(user.dailyCalculations!==expected)throw new Error('quota count mismatch '+n);
 await db.verificationCode.create({data:{phone:user.phone,code:'284736',expiresAt:new Date(Date.now()+600000)}});
 const ctx=await browser.newContext({viewport:{width:n%2?1440:390,height:900},locale:'zh-CN'});
 const csrf=await(await ctx.request.get('http://127.0.0.1:3411/api/auth/csrf')).json();await ctx.request.post('http://127.0.0.1:3411/api/auth/callback/sms',{form:{phone:user.phone,code:'284736',consent:'true',csrfToken:csrf.csrfToken,json:'true',callbackUrl:'http://127.0.0.1:3411/membership'}});
 const page=await ctx.newPage();let apis=[];const pending=[];page.on('response',r=>{if(r.url().includes('/api/membership/me'))pending.push((async()=>{apis.push({url:r.url(),status:r.status(),response_body:await r.json()})})())});
 await page.goto('http://127.0.0.1:3411/membership',{waitUntil:'networkidle'});await Promise.all(pending);
 if(apis.length!==1||apis[0].status!==200||apis[0].response_body.data.plan!==user.plan||apis[0].response_body.data.dailyCalculations!==expected)throw new Error('membership response mismatch');
 await page.getByRole('heading',{name:'会员中心'}).waitFor();
 const dismiss=page.getByRole('button',{name:'不再显示',exact:true});if(await dismiss.isVisible())await dismiss.click();
 const text=await page.locator('body').innerText();
 await page.screenshot({path:out+'/'+n+'.png',fullPage:true});fs.writeFileSync(out+'/'+n+'.txt',text);fs.writeFileSync(out+'/'+n+'.api.json',JSON.stringify(apis,null,2));
 rows.push({id:String(n),profile:user.name,plan:user.plan,quota:expected,scenario:'真实会员页面与数据库用量一致，测试种子非付款',route:'/membership',image:n+'.png',text:n+'.txt',api:n+'.api.json',capturedAt:new Date().toISOString()});
 await ctx.close();
}fs.writeFileSync(out+'/manifest.json',JSON.stringify(rows,null,2));console.log('5 membership API/DB quota checks passed; actual UI captured');}finally{await browser.close();await db.$disconnect()}
