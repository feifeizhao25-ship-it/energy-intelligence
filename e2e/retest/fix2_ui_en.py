"""fix2 UI retest 新能源: before/after Flutter web builds. usage: fix2_ui_en.py cn|gl before|after"""
import asyncio, sys, json, os, urllib.request
sys.path.insert(0, '/workspace/ui_full_test/run')
import fw
OUT = '/workspace/ui_full_test/retest/fix2/shots'; fw.SHOTS = OUT
from fw import *
PW = 'Test@12345Aa'
EDGE = {('cn', 'after'): 9701, ('gl', 'after'): 9702, ('cn', 'before'): 9703, ('gl', 'before'): 9704}
API = {'cn': 4291, 'gl': 4292}
def api(port, method, path, body=None, tok=None):
    h = {'content-type': 'application/json'}
    if tok: h['Authorization'] = 'Bearer ' + tok
    r = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try: return json.loads(urllib.request.urlopen(r, timeout=60).read())
    except urllib.error.HTTPError as e: return {'err': e.code}
async def main(ed, ver):
    cn = ed == 'cn'; port = API[ed]
    email = f'fix2.ui.{ver}@example.{"cn" if cn else "com"}'
    api(port, 'POST', '/api/v1/auth/register', dict(name='Fix2 UI', email=email, password=PW, company='Fix2 Co', role='developer', country='CN' if cn else 'AU', market='cn' if cn else 'global', data_transfer_consent=True))
    s = await Sess(f'en_{ed}_{ver}', locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'Australia/Sydney').start()
    await s.goto(f'https://localhost:{EDGE[(ed, ver)]}/', wait=8000)
    ys = (461, 520, 576) if cn else (425, 484, 625)
    await s.tap_xy(195, ys[0]); await s.type(email); await s.tap_xy(180, ys[1]); await s.type(PW)
    await s.tap_text('登录' if cn else 'Sign In', exact=True) or await s.tap_xy(195, ys[2]); await s.pg.wait_for_timeout(6000); await s.sem(); print('after login', (await s.texts())[:2], s.net[-12:], s.log[-10:])
    log = []
    async def snap(label, tall=1700):
        await s.sem(); t = await s.texts(); f = await s.shot(label, tall=tall)
        log.append({'label': label, 'shot': f.split('/')[-1], 'texts': t}); print(label, [x[:34] for x in t][:14], flush=True)
        json.dump(log, open(f'{OUT}/en_{ed}_{ver}.json', 'w'), ensure_ascii=False, indent=1)
    await snap('home')
    for i, nm in enumerate(['projects', 'resources', 'compute']):
        await s.tap_xy(117 + 78 * i, 815, 3500); await snap(nm)
    await s.tap_xy(351, 815, 3500); await snap('ai_tab')
    q = '收益率是什么意思？储能项目怎么看？' if cn else 'What does IRR mean and how should I read it for a storage project?'
    rect = await s.pg.evaluate("()=>{const e=[...document.querySelectorAll('textarea,input')].find(e=>e.getBoundingClientRect().width>0);if(!e)return null;const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}")
    print('input', rect, flush=True)
    if rect: await s.tap_xy(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 800)
    await s.type(q, delay=15); await s.pg.wait_for_timeout(500); await s.shot('ai_typed')
    await s.tap_text('发送' if cn else 'Send', exact=True)
    last = -1; same = 0
    for w in range(40):
        await s.pg.wait_for_timeout(3000); t = await s.texts(); n = sum(len(x) for x in t)
        same = same + 1 if n == last else 0; last = n
        busy = any(('正在思考' in x or 'Thinking' in x) for x in t)
        if same >= 3 and w >= 3 and not busy: break
    await snap('ai_answer', tall=2600)
    await s.tap_xy(39, 815, 3000)
    if await s.tap_text('设置' if cn else 'Settings', exact=False):
        await s.pg.wait_for_timeout(2500); await snap('settings')
        if await s.tap_text('会员权益与用量' if cn else 'Plan & usage', exact=False):
            await s.pg.wait_for_timeout(3500); await snap('plan_usage')
    await s.close()
asyncio.run(main(sys.argv[1], sys.argv[2]))
