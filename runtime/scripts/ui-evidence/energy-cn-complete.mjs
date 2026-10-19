const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire('/Users/feifei00/Documents/CodexWorktrees/energy-production/runtime/web/package.json');
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient({datasources:{db:{url:'postgresql://feifei00@localhost/energy_ui_evidence_20261019'}}});
const out='/Users/feifei00/Documents/四项目UI完整证据-20261019/'+(process.env.UI_CAPTURE_PHASE || 'current-energy-cn');fs.mkdirSync(out,{recursive:true});
const profiles=[['新手业主','FREE',390,20,40],['企业运维','MAINTENANCE',1440,500,1000],['投资顾问','FULL',1440,1000,2000],['设计院团队','TEAM',390,2000,4000],['企业采购','ENTERPRISE',1440,5000,10000]];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const rows=[];
const sanitize=(v)=>JSON.parse(JSON.stringify(v,(k,val)=>/^(csrfToken|access_token|refresh_token|token|code|password)$/i.test(k)?'[测试凭据隐藏]':val));
try{
 for(let n=0;n<profiles.length;n++){
 const [name,plan,width,power,energy]=profiles[n];const phone='1990000900'+n;
 await db.user.deleteMany({where:{email:`ui-${n}@example.invalid`}});
 await db.user.create({data:{email:`ui-${n}@example.invalid`,name:'UI测试-'+name,phone,plan,planExpireAt:new Date('2027-10-19'),profileCompleted:true}});
 await db.verificationCode.create({data:{phone,code:'834927',expiresAt:new Date(Date.now()+3600000)}});
 const ctx=await browser.newContext({viewport:{width,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
 const csrf=await (await ctx.request.get('http://127.0.0.1:3411/api/auth/csrf')).json();
 await ctx.request.post('http://127.0.0.1:3411/api/auth/callback/sms',{form:{phone,code:'834927',consent:'true',csrfToken:csrf.csrfToken,json:'true',callbackUrl:'http://127.0.0.1:3411/calculator/storage'}});
 const session=await (await ctx.request.get('http://127.0.0.1:3411/api/auth/session')).json();if(!session.user)throw new Error('real login failed for '+name);
 const pg=await ctx.newPage();let apis=[],pending=[];pg.on('response',r=>{if(r.url().includes('/api/'))pending.push((async()=>{const raw=await r.text().catch(()=>'<body unavailable>');let body=raw;try{body=JSON.parse(raw)}catch{};apis.push({url:r.url(),method:r.request().method(),status:r.status(),request_body:r.request().postDataJSON(),response_body:sanitize(body)})})())});
 await pg.goto('http://127.0.0.1:3411/calculator/storage',{waitUntil:'networkidle'});
 for(let day=1;day<=7;day++){
  apis=[];pending=[];
  await pg.locator('#storage-capacity').fill(String(power));await pg.locator('#storage-energy').fill(String(energy));await pg.locator('#storage-unitCost').fill(String(1200+day*50));
  const nums=pg.locator('input[type=number]');await nums.nth(3).fill('1.2');await nums.nth(4).fill('0.3');
  await pg.getByRole('button',{name:'执行测算',exact:true}).click();await pg.waitForLoadState('networkidle');await Promise.all(pending);
  await pg.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,30))}window.scrollTo({top:0,left:0,behavior:"instant"})});
  const id=String(rows.length+1).padStart(3,'0');const text=await pg.locator('body').innerText();
  await pg.screenshot({path:path.join(out,id+'.png'),fullPage:true});fs.writeFileSync(path.join(out,id+'.txt'),text);fs.writeFileSync(path.join(out,id+'.api.json'),JSON.stringify(apis,null,2));
  const resultVisible=await pg.getByTestId('storage-result').count();
  if(process.env.UI_ASSERT_COMPLETE==='1'){
    const response=apis.find(a=>a.url.endsWith('/api/calculator/storage'));
    if(response?.status===200){
      const data=response.response_body.data;
      if(await pg.locator('[data-testid=storage-cashflows] tbody tr').count()!==data.financial.cashFlows.length)throw new Error('missing cashflow years');
      for(const assumption of data.assumptions)if(!text.includes(assumption))throw new Error('missing assumption: '+assumption);
      if(!text.includes('净现值')||!text.includes('敏感性区间'))throw new Error('missing result sections');
    }else if(!(plan==='FREE'&&day>3&&response?.status===429&&text.includes('次数已用完')))throw new Error('unexpected calculation failure');
  }
  rows.push({id,profile:name,plan,day,route:'/calculator/storage',inputs:{power,energy,unitCost:1200+day*50,peak:1.2,valley:0.3},scenario:'七步成本敏感性及同日额度测试，非真实七天登录',image:id+'.png',text:id+'.txt',api:id+'.api.json',resultVisible:Boolean(resultVisible),statuses:apis.map(a=>a.status),layout:await pg.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})),capturedAt:new Date().toISOString(),evidence:'real NextAuth login + isolated PostgreSQL + actual calculator API; memberships and SMS codes seeded; no payment, SMS delivery or API mocks'});
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(rows,null,2));
 }
 await ctx.close();
 }
 console.log(JSON.stringify({captures:rows.length,results:rows.filter(r=>r.resultVisible).length,out}));
}finally{await browser.close();await db.$disconnect()}
