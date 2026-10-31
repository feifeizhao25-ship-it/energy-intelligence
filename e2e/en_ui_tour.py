import asyncio, sys, json; sys.path.insert(0,'/workspace/ui_full_test/run')
from fw import *
PW='Test@12345Aa'
PERS={'cn1':('zhou.eng@example.cn','cn'),'cn2':('lin.newbie@example.cn','cn'),'cn3':('wang.storage@example.cn','cn'),'cn4':('zhao.policy@example.cn','cn'),
      'gl1':('marcus.hill@example.com','gl'),'gl2':('ingrid.larsen@example.com','gl'),'gl3':('arjun.mehta@example.com','gl'),'gl4':('sofia.reyes@example.com','gl')}
async def main(pid):
    em,ed=PERS[pid]; cn=ed=='cn'
    s=await Sess('en_'+pid, locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'America/Chicago').start()
    await s.goto('https://127.0.0.1:%d/'%(9201 if cn else 9202), wait=7000)
    ys=(461,520,576) if cn else (425,484,625)
    await s.tap_xy(195,ys[0]); await s.type(em); await s.tap_xy(180,ys[1]); await s.type(PW)
    await s.tap_xy(195,ys[2],6000); await s.sem()
    log=[]
    async def snap(label, tall=1700):
        s.net.clear(); await s.sem(); t=await s.texts(); f=await s.shot(label,tall=tall); 
        log.append({'label':label,'shot':f.split('/')[-1],'texts':t,'api':[a for a in s.net if True][-12:]}); json.dump(log,open(f'../out/en_tour_{pid}.json','w'),ensure_ascii=False,indent=1)
        print(label,len(t),[x[:40] for x in t][:12],flush=True)
    await snap('home')
    for i,nm in enumerate(['projects','resources','compute','ai']):
        await s.tap_xy(117+78*i,815,3500); await snap(nm)
    await s.close()
if __name__=="__main__": asyncio.run(main(sys.argv[1]))
