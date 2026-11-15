import asyncio, sys, json, os; sys.path.insert(0,'/workspace/ui_full_test/run')
from fw import *
from en_ui_tour import PERS, PW
from en_battery import P
async def main(pid):
    em,ed=PERS[pid]; cn=ed=='cn'
    s=await Sess('enai_'+pid+os.environ.get('TAG',''), locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'America/Chicago').start()
    await s.goto('https://127.0.0.1:%d/'%(9201 if cn else 9202), wait=7000)
    ys=(461,520,576) if cn else (425,484,625)
    await s.tap_xy(195,ys[0]); await s.type(em); await s.tap_xy(180,ys[1]); await s.type(PW)
    await s.tap_xy(195,ys[2],6000); await s.sem()
    await s.tap_xy(351,815,3000)
    rect=await s.pg.evaluate("()=>{const e=[...document.querySelectorAll('flt-semantics')].find(e=>e.getAttribute('role')==='textbox'||e.tagName==='INPUT'||e.querySelector('input,textarea'));if(!e)return null;const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}")
    print('input',rect,flush=True)
    res=[]
    asks=[os.environ['Q']] if os.environ.get('Q') else P[pid]['asks']
    for i,q in enumerate(asks):
        await s.tap_xy(150,757,800)
        await s.type(q); await s.shot(f'q{i+1}_typed')
        await s.tap_xy(352,757,1500)
        for w in range(14):
            await s.pg.wait_for_timeout(3000)
            t=await s.texts()
            if any(x.startswith('[S') or '来源' in x or 'Source' in x for x in t) or w>=12: break
        await s.sem(); t=await s.texts(); f=await s.shot(f'q{i+1}_answer',tall=2600)
        res.append({'q':q,'shot':f.split('/')[-1],'texts':t}); json.dump(res,open(f'../out/en_ui_ai_{pid}{os.environ.get('TAG','')}.json','w'),ensure_ascii=False,indent=1)
        print(i,len(t),flush=True)
    await s.close()
if __name__=='__main__': asyncio.run(main(sys.argv[1]))
