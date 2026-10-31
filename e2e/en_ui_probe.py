import asyncio, sys; sys.path.insert(0,'/workspace/ui_full_test/run')
from fw import *
async def main(ed):
    cn=ed=='cn'
    s=await Sess('en_probe_'+ed, locale='zh-CN' if cn else 'en-US', tz='Asia/Shanghai' if cn else 'America/Chicago').start()
    await s.goto('https://127.0.0.1:%d/'%(9201 if cn else 9202), wait=7000)
    em='zhou.eng@example.cn' if cn else 'marcus.hill@example.com'
    ys=(461,520,576) if cn else (425,484,625)
    await s.tap_xy(195,ys[0]); await s.type(em); await s.tap_xy(180,ys[1]); await s.type('Test@12345Aa')
    await s.shot('filled')
    await s.tap_xy(195,ys[2],15000)
    await s.sem(); t=await s.texts(); print(s.pg.url, t, flush=True); await s.shot('after_login', tall=1500)
    print(await s.pg.evaluate("()=>[...document.querySelectorAll('flt-semantics')].map(e=>[e.getAttribute('role'),e.textContent.slice(0,20),Math.round(e.getBoundingClientRect().x),Math.round(e.getBoundingClientRect().y),Math.round(e.getBoundingClientRect().width),Math.round(e.getBoundingClientRect().height)].join('|')).slice(0,60)"))
    print(s.net[-8:])
    await s.close()
asyncio.run(main(sys.argv[1]))
