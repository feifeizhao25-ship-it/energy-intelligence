import sys, json, time
from enapi import *
P={
 # CN
 'cn1':dict(port=4200,market='cn',name='周工',email='zhou.eng@example.cn',company='西北新能源设计院',role='光伏设计工程师',country='CN',
   asks=['136号文出台后，工商业分布式光伏的收益模型要怎么调整？请给出关键变量。','我在甘肃，想做10MW集中式光伏，需要关注哪些消纳和限电风险？'],
   solar=dict(capacity_mw=10,capex_per_w=3.6,opex_per_kw_yr=45,electricity_price=0.32,capacity_factor=0.19,currency='CNY',debt_ratio=0.7,interest_rate=0.036,tax_rate=0.25),
   loc=(37.9,102.6,'甘肃武威'),tech='solar',cap=10000),
 'cn2':dict(port=4200,market='cn',name='林小白',email='lin.newbie@example.cn',company='',role='个人投资者',country='CN',
   asks=['我是普通人，听说家里屋顶装光伏能赚钱，到底靠谱吗？大概多少年回本？','用大白话讲讲什么是“绿电交易”和“绿证”？'],
   solar=dict(capacity_mw=0.01,capex_per_w=3.2,opex_per_kw_yr=30,electricity_price=0.45,capacity_factor=0.14,currency='CNY',debt_ratio=0,interest_rate=0.04,tax_rate=0.0),
   loc=(30.6,114.3,'武汉自建房屋顶'),tech='solar',cap=10),
 'cn3':dict(port=4200,market='cn',name='王储能',email='wang.storage@example.cn',company='江苏某储能集成商',role='储能项目经理',country='CN',
   asks=['江苏工商业储能峰谷价差套利，两充两放的收益怎么测算？电芯衰减如何考虑？','钠离子电池相比磷酸铁锂在储能场景的优缺点是什么？'],
   storage=dict(power_mw=5,capacity_mwh=10,cycles_per_year=660,peak_price_per_mwh=1100,offpeak_price_per_mwh=350,capex_per_kwh=1100,currency='CNY'),
   loc=(31.3,120.6,'江苏苏州'),tech='storage',cap=5000),
 'cn4':dict(port=4200,market='cn',name='赵政策',email='zhao.policy@example.cn',company='某能源研究院',role='政策分析师',country='CN',
   asks=['请总结近期国家层面对新能源全面入市的主要政策要点，并标注来源与发布时间。','CCER重启对风电光伏项目有什么影响？'],
   wind=dict(capacity_mw=50,capex_per_kw=6200,opex_per_kw_yr=110,electricity_price=0.35,wind_capacity_factor=0.28,currency='CNY',debt_ratio=0.7,interest_rate=0.036,tax_rate=0.25),
   loc=(41.8,111.7,'内蒙古乌兰察布'),tech='wind',cap=50000),
 # GLOBAL
 'gl1':dict(port=4201,market='global',name='Marcus Hill',email='marcus.hill@example.com',company='SunBridge Developers',role='Solar developer',country='US',
   asks=['How does the 2025 phase-out of the residential ITC and the OBBBA changes affect utility-scale solar project IRR in Texas?','What should I check in an interconnection queue study for a 100 MW solar + storage project in ERCOT?'],
   solar=dict(capacity_mw=100,capex_per_w=1.1,opex_per_kw_yr=17,electricity_price=45,capacity_factor=0.27,itc_rate=0.3,currency='USD',debt_ratio=0.6,interest_rate=0.06,tax_rate=0.21),
   loc=(31.0,-100.0,'West Texas'),tech='solar',cap=100000),
 'gl2':dict(port=4201,market='global',name='Ingrid Larsen',email='ingrid.larsen@example.com',company='Nordic Wind AS',role='Wind analyst',country='NO',
   asks=['Compare capacity factors and LCOE trends for offshore vs onshore wind in the North Sea in the last 3 years, with sources.','What are the main permitting risks for onshore wind in the EU under RED III?'],
   wind=dict(capacity_mw=300,capex_per_kw=1500,opex_per_kw_yr=45,electricity_price=70,wind_capacity_factor=0.4,currency='EUR',debt_ratio=0.7,interest_rate=0.045,tax_rate=0.22),
   loc=(57.0,3.0,'North Sea'),tech='wind',cap=300000),
 'gl3':dict(port=4201,market='global',name='Arjun Mehta',email='arjun.mehta@example.com',company='GridFlex India',role='Storage planner',country='IN',
   asks=['Explain how a 4-hour BESS earns revenue in the Indian market and what viability gap funding covers.','Lithium iron phosphate vs sodium-ion for stationary storage: current cost and cycle life evidence?'],
   storage=dict(power_mw=50,capacity_mwh=200,cycles_per_year=330,peak_price_per_mwh=120,offpeak_price_per_mwh=40,capex_per_kwh=180,currency='USD'),
   loc=(26.9,75.8,'Rajasthan'),tech='storage',cap=50000),
 'gl4':dict(port=4201,market='global',name='Sofia Reyes',email='sofia.reyes@example.com',company='',role='Retail investor',country='ES',
   asks=['I am new to clean energy investing. In plain English, what is a PPA and what is LCOE?','Is rooftop solar worth it for a household in Spain today? How long is the payback?'],
   solar=dict(capacity_mw=0.006,capex_per_w=1.4,opex_per_kw_yr=15,electricity_price=0.22,capacity_factor=0.18,currency='EUR',debt_ratio=0,interest_rate=0.04,tax_rate=0.0,itc_rate=0.0),
   loc=(37.4,-5.98,'Seville rooftop'),tech='solar',cap=6),
}
def run(pid):
    c=P[pid]; port=c['port']; out={'persona':{k:v for k,v in c.items() if k in('name','role','company','country','market')},'steps':{}}
    def rec(k,res): out['steps'][k]={'status':res[0],'sec':res[-1],'body':res[1]}; json.dump(out,open(f'../out/en_{pid}.json','w'),ensure_ascii=False,indent=1)
    pw='Test@12345Aa'
    st,j,_=call(port,'POST','/api/v1/auth/register',dict(name=c['name'],email=c['email'],password=pw,company=c['company'] or None,role=c['role'],country=c['country'],market=c['market'],data_transfer_consent=True))
    st,j,t=call(port,'POST','/api/v1/auth/login',{'email':c['email'],'password':pw})
    d=j.get('data',j) if isinstance(j,dict) else {}
    tok=d.get('access_token') or d.get('token')
    if not tok: out['login_fail']=j; json.dump(out,open(f'../out/en_{pid}.json','w'),ensure_ascii=False,indent=1); return
    for i,q in enumerate(c['asks']): rec(f'ai_ask_{i+1}',call(port,'POST','/api/v1/ai/ask',{'query':q,'market':c['market']},tok)); 
    for i,q in enumerate(c['asks']): rec(f'ai_chat_json_{i+1}',call(port,'POST','/api/v1/ai/chat-json',{'message':q},tok))
    for k in('solar','wind','storage'):
        if k in c: rec('finance_'+k,call(port,'POST','/api/v1/finance/'+k,c[k],tok))
    lat,lng,addr=c['loc']
    st,pj,t=call(port,'POST','/api/v1/projects',{'name':f"{c['name']} 项目" if c['market']=='cn' else f"{c['name']} project",'location':{'latitude':lat,'longitude':lng,'address':addr},'capacity_kw':c['cap'],'technology':c['tech']},tok); rec('project_create',(st,pj,t))
    pd=pj.get('data',pj) if isinstance(pj,dict) else {}; pidd=pd.get('id') or pd.get('project_id')
    for k,path in [('me','/api/v1/users/me'),('entitlements','/api/entitlements'),('plans','/api/v1/billing/plans'),('subscription','/api/v1/billing/subscription'),('usage','/api/v1/billing/usage'),('rules','/api/v1/billing/rules'),('daily_layout','/api/v1/personalization/daily-layout'),('market_trends','/api/v1/research/market-trends'),('trends','/api/v1/research/trends'),('papers','/api/v1/research/papers'),('tech','/api/v1/research/technologies/'+c['tech']),('skill_categories','/api/v1/skills/categories'),('skills','/api/v1/skills'),('report_templates','/api/v1/reports/templates'),('projects','/api/v1/projects'),('settings','/api/v1/settings')]:
        rec(k,call(port,'GET',path,None,tok))
    if pidd:
        for fmt in ('pdf','docx'):
            st,r,t=call(port,'POST','/api/v1/reports/generate',{'project_id':pidd,'report_type':'feasibility','format':fmt,'title':('可行性研究报告 - ' if c['market']=='cn' else 'Feasibility Report - ')+c['name']},tok); rec('report_'+fmt,(st,r,t))
            rd=r.get('data',r) if isinstance(r,dict) else {}; rid=rd.get('id') or rd.get('report_id')
            if rid:
                st,b,h,t=call(port,'GET',f'/api/v1/reports/{rid}/file',None,tok,raw=True)
                open(f'../out/en_{pid}_report.{fmt}','wb').write(b if isinstance(b,bytes) else str(b).encode()); out['steps']['report_'+fmt]['file']=f'en_{pid}_report.{fmt}'; out['steps']['report_'+fmt]['file_status']=st
        rec('ai_suggestions',call(port,'GET','/api/v1/ai/suggestions/'+pidd,None,tok))
        rec('operations_health',call(port,'GET','/api/v1/operations/health/'+pidd,None,tok))
    json.dump(out,open(f'../out/en_{pid}.json','w'),ensure_ascii=False,indent=1)
    json.dump({'tok_len':len(tok)},open('/dev/null','w'))
if __name__=='__main__':
    for pid in sys.argv[1:]: run(pid); print('done',pid,flush=True)
