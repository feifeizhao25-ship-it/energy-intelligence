"""fix2 retest for 新能源: same calls against base backend (:4297 cn/:4298 global) and fix2 backend (:4291 cn/:4292 global)."""
import sys, json, re, time, os
sys.path.insert(0, '/workspace/ui_full_test/run')
from enapi import call
CJK = re.compile(r'[\u3400-\u9fff]')
PW = 'Test@12345Aa'
STORAGE = {"power_mw": 20, "capacity_mwh": 40, "cycles_per_year": 330, "peak_price_per_mwh": 120, "offpeak_price_per_mwh": 40,
           "capex_per_kwh": 250, "roundtrip_efficiency": 0.86, "project_life": 12, "currency": "USD"}
STORAGE_CN = dict(STORAGE, peak_price_per_mwh=900, offpeak_price_per_mwh=300, capex_per_kwh=1400, currency="CNY")
def run(label, port, market, suffix):
    gl = market == 'global'; o = {'label': label, 'port': port, 'market': market}
    email = f'fix2.{label}.{suffix}.{market}@example.{"com" if gl else "cn"}'
    call(port, 'POST', '/api/v1/auth/register', dict(name='Fix2 Tester', email=email, password=PW, company='Fix2 Co', role='developer', country='AU' if gl else 'CN', market=market, data_transfer_consent=True))
    st, j, _ = call(port, 'POST', '/api/v1/auth/login', {'email': email, 'password': PW})
    tok = (j.get('data', j) or {}).get('access_token'); o['login'] = bool(tok)
    st, pj, _ = call(port, 'POST', '/api/v1/projects', {'name': 'Fix2 storage', 'location': {'latitude': -33.9, 'longitude': 151.2, 'address': 'Sydney'} if gl else {'latitude': 30.6, 'longitude': 114.3, 'address': '武汉'}, 'capacity_kw': 20000, 'technology': 'storage'}, tok)
    pd = pj.get('data', pj) if isinstance(pj, dict) else {}; pid = pd.get('id') or pd.get('project_id'); o['project'] = st
    q = {'plain': ('What does IRR mean for my storage project and how should I read it?' if gl else '收益率是什么意思？我该怎么看储能项目的收益？'),
         'pro': ('Explain IRR versus NPV for a 20 MW / 40 MWh storage project.' if gl else '请对比储能项目的 IRR 与 NPV。')}
    for style, msg in q.items():
        t = time.time(); st, b, _ = call(port, 'POST', '/api/v1/ai/chat-json', {'message': msg, 'style': style}, tok)
        txt = json.dumps(b, ensure_ascii=False) if not isinstance(b, dict) else (b.get('message') or json.dumps(b, ensure_ascii=False))
        s = (b.get('structured') if isinstance(b, dict) else None)
        o[f'chat_{style}'] = {'status': st, 'seconds': round(time.time() - t, 1), 'keys': sorted(b.keys()) if isinstance(b, dict) else None,
                              'structured_keys': sorted(s.keys()) if isinstance(s, dict) else None,
                              'conclusion': (s or {}).get('conclusion') if isinstance(s, dict) else None, 'has_cjk': bool(CJK.search(txt)), 'reply_head': str(txt)[:300]}
    st, b, _ = call(port, 'GET', '/api/v1/billing/usage', None, tok); o['billing_usage'] = {'status': st, 'body': b if st == 200 else str(b)[:200]}
    st, b, _ = call(port, 'POST', f'/api/v1/finance/models/{pid}', STORAGE if gl else STORAGE_CN, tok)
    o['storage_model_save'] = {'status': st, 'detail': (str(b)[:220]) if st != 200 else {k: b.get(k) for k in ('npv', 'irr', 'lcoe', 'scenario_name')}}
    if st == 200:
        src = [{'title': 'Grid tariff notice', 'url': 'https://example.gov/tariff', 'publisher': 'Regulator'}] if gl else [{'title': '地方电价通知', 'url': 'https://example.gov/tariff', 'publisher': '地方发改委'}]
        call(port, 'PUT', f'/api/v1/finance/data-sources/{pid}', {'sources': src}, tok)
        st2, b2, _ = call(port, 'POST', '/api/v1/reports/generate', {'project_id': pid, 'report_type': 'feasibility', 'format': 'pdf', 'market': market}, tok)
        o['storage_report'] = {'status': st2, 'detail': None if st2 == 200 else str(b2)[:200]}
    st, b, _ = call(port, 'GET', '/api/v1/status'); o['status_language_guard'] = b.get('language_guard') if isinstance(b, dict) else None
    return o
if __name__ == '__main__':
    out = '/workspace/ui_full_test/retest/fix2'; os.makedirs(out, exist_ok=True)
    suffix = str(int(time.time()))[-6:]
    for label, ports in (('before', {'cn': 4297, 'global': 4298}), ('after', {'cn': 4291, 'global': 4292})):
        res = [run(label, p, m, suffix) for m, p in ports.items()]
        json.dump(res, open(f'{out}/en_api_{label}.json', 'w'), ensure_ascii=False, indent=1)
        for r in res: print(label, r['market'], {k: (v.get('status') if isinstance(v, dict) and 'status' in v else v) for k, v in r.items() if k not in ('status_language_guard',)}, flush=True)
