import sys, json
from enapi import *
from en_battery import P
pw='Test@12345Aa'
def login(c):
    st,j,_=call(c['port'],'POST','/api/v1/auth/login',{'email':c['email'],'password':pw}); return j['data']['access_token']
SK={'FM-001':dict(capex=36000000,opex_annual=450000,capacity_mw=10,capacity_factor=0.19,discount_rate=0.07,project_life=25,degradation_rate=0.005),
    'FM-002':dict(cashflows=[-36000000]+[4800000]*25,discount_rate=0.07),
    'RA-001':dict(lat=37.9,lon=102.6,latitude=37.9,longitude=102.6),
    'RA-002':dict(lat=41.8,lon=111.7,latitude=41.8,longitude=111.7,hub_height=100),
    'ST-001':dict(power_mw=5,capacity_mwh=10,peak_price=1.1,offpeak_price=0.35),
    'OM-001':dict(capacity_kw=10000,daily_soiling_loss=0.003,cleaning_cost=3000,electricity_price=0.32),
    'CA-001':dict(annual_generation_mwh=18000,emission_factor=0.5703,capacity_mw=10)}
for pid in sys.argv[1:]:
    c=P[pid]; port=c['port']; tok=login(c); f=f'../out/en_{pid}.json'; out=json.load(open(f)); stp=out['steps']
    def rec(k,res): stp[k]={'status':res[0],'sec':res[-1],'body':res[1]}; json.dump(out,open(f,'w'),ensure_ascii=False,indent=1)
    for i,q in enumerate(c['asks']): rec(f'ai_ask_{i+1}',call(port,'POST','/api/v1/ai/ask',{'query':q,'market':c['market']},tok)); print(pid,'ask',i,stp[f'ai_ask_{i+1}']['status'],flush=True)
    rec('papers',call(port,'GET','/api/v1/research/papers?q='+('光伏 组件 衰减' if c['market']=='cn' else 'solar degradation'),None,tok))
    for sid,pr in SK.items(): 
        if pid in('cn1','gl1','cn3','gl3') or sid in('FM-001','FM-002'): rec('skill_'+sid,call(port,'POST','/api/v1/skills/execute',{'skill_id':sid,'parameters':pr},tok))
    pj=stp['project_create']['body']; pd=pj.get('data',pj); pidd=pd.get('id') or pd.get('project_id')
    k='solar' if 'solar' in c else 'wind' if 'wind' in c else None
    if k:
        rec('save_model',call(port,'POST','/api/v1/finance/models/'+pidd,c[k],tok))
    for fmt in ('pdf','docx'):
        st,r,t=call(port,'POST','/api/v1/reports/generate',{'project_id':pidd,'report_type':'feasibility','format':fmt,'title':('可行性研究报告 - ' if c['market']=='cn' else 'Feasibility Report - ')+c['name']},tok); rec('report_'+fmt,(st,r,t))
        rd=r.get('data',r) if isinstance(r,dict) else {}; rid=rd.get('id') or rd.get('report_id')
        if rid:
            st,b,h,t=call(port,'GET',f'/api/v1/reports/{rid}/file',None,tok,raw=True)
            open(f'../out/en_{pid}_report.{fmt}','wb').write(b); stp['report_'+fmt]['file']=f'en_{pid}_report.{fmt}'; stp['report_'+fmt]['file_status']=st
    json.dump(out,open(f,'w'),ensure_ascii=False,indent=1); print('done',pid,flush=True)
