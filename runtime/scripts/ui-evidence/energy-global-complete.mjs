const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
const out='/Users/feifei00/Documents/四项目UI完整证据-20261019/'+(process.env.UI_CAPTURE_PHASE || 'current-energy-global');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const rows=[];
const profiles=[
 {id:'US-homeowner',locale:'en-US',timezoneId:'America/New_York',lat:40.7,capacity:8,ghi:1400,width:390},
 {id:'UK-community',locale:'en-GB',timezoneId:'Europe/London',lat:51.5,capacity:80,ghi:1000,width:1440},
 {id:'AU-installer',locale:'en-AU',timezoneId:'Australia/Sydney',lat:-33.9,capacity:200,ghi:1700,width:390},
 {id:'SG-facility',locale:'en-SG',timezoneId:'Asia/Singapore',lat:1.35,capacity:500,ghi:1600,width:1440},
 {id:'DE-analyst',locale:'en-GB',timezoneId:'Europe/Berlin',lat:52.5,capacity:1000,ghi:1100,width:1440}
];
async function capture(page,meta,apis){
 const id=String(rows.length+1).padStart(3,'0');
 await page.evaluate(async()=>{await document.fonts.ready;for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}window.scrollTo({top:0,left:0,behavior:"instant"})});
 const text=await page.locator('body').innerText();
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
  clipped:[...document.querySelectorAll('main *')].filter(e=>{let s=getComputedStyle(e);return e.textContent.trim()&&((s.overflowY==='hidden'&&e.scrollHeight>e.clientHeight+2)||(s.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+2));}).map(e=>({tag:e.tagName,text:e.textContent,overflow:getComputedStyle(e).overflow})),
  media:[...document.querySelectorAll('audio,video')].map(e=>({tag:e.tagName,src:e.currentSrc,readyState:e.readyState,duration:Number.isFinite(e.duration)?e.duration:null,error:e.error?.code}))}));
 await page.screenshot({path:path.join(out,id+'.png'),fullPage:true});
 fs.writeFileSync(path.join(out,id+'.txt'),text);
 fs.writeFileSync(path.join(out,id+'.api.json'),JSON.stringify(apis,null,2));
 rows.push({id,...meta,url:page.url(),text:id+'.txt',image:id+'.png',api:id+'.api.json',layout,characters:text.length,capturedAt:new Date().toISOString(),evidence:'current local frontend; no API mocking; seven days are input scenarios, not elapsed days or persisted personalization'});
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(rows,null,2));
}
try{
 for(const profile of profiles){
  const context=await browser.newContext({viewport:{width:profile.width,height:900},locale:profile.locale,timezoneId:profile.timezoneId});
  const page=await context.newPage();let apis=[];let pending=[];
  page.on('response',r=>{if(/\/api\//.test(r.url()))pending.push((async()=>{apis.push({url:r.url(),status:r.status(),body:await r.text().catch(()=>'<body unavailable>')});})())});
  await page.goto('http://127.0.0.1:3412/assessment',{waitUntil:'networkidle'});
  for(let day=1;day<=7;day++){
   apis=[];
   const fields=page.locator('input[type=number]');
   await fields.nth(0).fill(String(profile.capacity*(1+(day-1)*0.05)));
   await fields.nth(1).fill(String(profile.ghi));await fields.nth(2).fill(String(profile.lat));
   await Promise.all(pending);pending=[];
   await capture(page,{profile:profile.id,day,route:'/assessment',scenario:'参数递进样例，不是实际连续登录',inputs:{capacity:profile.capacity*(1+(day-1)*0.05),ghi:profile.ghi,latitude:profile.lat}},apis);
  }
  if(profile.id==='US-homeowner'){
   if(process.env.UI_ASSERT_COMPLETE==='1'){
    if(!await page.locator('option[value=wind]').evaluate(e=>e.disabled)||!await page.locator('option[value=storage]').evaluate(e=>e.disabled))throw new Error('unsupported technology selectable');
    await capture(page,{profile:profile.id,scenario:'未实现的风电与储能明确禁用',finding:'PASS'},apis);
    for(const [index,value,label] of [[0,'-10','负数容量'],[0,'','空容量'],[0,'0','零容量'],[2,'91','纬度越界']]){
      await page.locator('input[type=number]').nth(0).fill('10');await page.locator('input[type=number]').nth(2).fill('40');
      await page.locator('input[type=number]').nth(index).fill(value);
      await page.locator('section[aria-label="Screening result"] [role=alert]').waitFor();
      if(await page.locator('.metric').count()!==0||await page.locator('section[aria-label="Screening result"] [role=alert]').count()!==1)throw new Error('invalid result shown: '+label);
      await capture(page,{profile:profile.id,scenario:label,finding:'PASS: invalid result hidden, explanation visible'},apis);
    }
   }else{
    const before=await page.locator('.metric').innerText();await page.locator('select').selectOption({label:'Onshore wind'});
    const after=await page.locator('.metric').innerText();
    await capture(page,{profile:profile.id,scenario:'切换风电后仍输出光伏结果',finding:before===after?'FAIL: technology selector does not change calculation':'review'},apis);
    await page.locator('input[type=number]').nth(0).fill('-10');
    await capture(page,{profile:profile.id,scenario:'负数装机容量边界'},apis);
   }
   for(const route of ['/','/evidence','/pricing','/login','/privacy','/terms']){
    apis=[];await page.goto('http://127.0.0.1:3412'+route,{waitUntil:'networkidle'});await Promise.all(pending);pending=[];
    await capture(page,{profile:profile.id,route,scenario:'当前本地页面'},apis);
   }
  }
  await context.close();
 }
}finally{await browser.close()}
console.log(JSON.stringify({captures:rows.length,path:out,overflow:rows.filter(r=>r.layout.scrollWidth>r.layout.width).length}));
