import json, urllib.request, time
def call(port, method, path, data=None, tok=None, hdr=None, timeout=170, raw=False):
    h={'content-type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    if hdr: h.update(hdr)
    r=urllib.request.Request(f'http://127.0.0.1:{port}'+path, data=(json.dumps(data).encode() if data is not None else None), headers=h, method=method)
    t=time.time()
    try:
        resp=urllib.request.urlopen(r, timeout=timeout); b=resp.read()
        if raw: return resp.status, b, resp.headers, round(time.time()-t,1)
        try: b=json.loads(b)
        except Exception: b=b.decode('utf8','replace')
        return resp.status, b, round(time.time()-t,1)
    except urllib.error.HTTPError as e:
        b=e.read().decode('utf8','replace')
        try: b=json.loads(b)
        except Exception: pass
        return e.code, b, round(time.time()-t,1)
    except Exception as e: return 0,str(e),round(time.time()-t,1)
