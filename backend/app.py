"""LoTUS-BF (HW09) backend.

One FastAPI service that
  1. serves the built React front end at /lotus-bf/ (same origin -> no CORS, no mixed content);
  2. forwards /lotus-bf/api/<path> to the course's LoTUS API, which only speaks plain http.

Why a proxy: the course API (hpc/mil.psy.ntu.edu.tw:5000) has no working https, so a page
served over https cannot call it directly (browsers block "mixed content"). Forwarding on the
server side keeps the numbers identical to the course site while the page stays on https.
"""
import os
from collections import OrderedDict
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

UPSTREAMS = [u.rstrip('/') for u in os.environ.get(
    'LOTUS_UPSTREAMS', 'http://hpc.psy.ntu.edu.tw:5000,http://mil.psy.ntu.edu.tw:5000').split(',') if u.strip()]
DIST = Path(__file__).resolve().parent.parent / 'frontend' / 'dist'
PREFIX = '/lotus-bf'
# Only the read-only routes the front end uses are forwarded (no open proxy).
ALLOWED = ('terms', 'query/')

app = FastAPI(title='LoTUS-BF HW09', docs_url=f'{PREFIX}/api/docs', openapi_url=f'{PREFIX}/api/openapi.json')
client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0), follow_redirects=True)

# Small in-memory cache of successful upstream answers: repeated queries are instant and keep
# working for a while if the course servers go down (observed 2026-11-11 15:05: both down).
CACHE: OrderedDict = OrderedDict()
CACHE_MAX_BYTES = 150 * 1024 * 1024
cache_bytes = 0


def cache_put(key, value):
    global cache_bytes
    if key in CACHE:
        return
    CACHE[key] = value
    cache_bytes += len(value[0])
    while cache_bytes > CACHE_MAX_BYTES and CACHE:
        _, old = CACHE.popitem(last=False)
        cache_bytes -= len(old[0])


@app.get('/health')
async def health():
    return {'ok': True}


@app.get(f'{PREFIX}/api/{{path:path}}')
async def proxy(path: str, request: Request):
    if not path.startswith(ALLOWED):
        return JSONResponse({'error': f'unknown endpoint: {path}'}, status_code=404)
    key = f'{path}?{request.url.query}'
    if key in CACHE:
        CACHE.move_to_end(key)
        body, ctype, extra = CACHE[key]
        return Response(body, media_type=ctype, headers={'Cache-Control': 'public, max-age=3600', 'X-Cache': 'hit', **extra})
    last_err = None
    for base in UPSTREAMS:  # fail over to the second course server
        try:
            r = await client.get(f'{base}/{path}', params=request.query_params)
        except httpx.HTTPError as e:
            last_err = f'{type(e).__name__} from {base}'
            continue
        if r.status_code >= 500:
            last_err = f'HTTP {r.status_code}'
            continue
        headers = {'Cache-Control': 'public, max-age=3600'} if r.status_code == 200 else {}
        if 'content-disposition' in r.headers:
            headers['Content-Disposition'] = r.headers['content-disposition']
        if r.status_code == 200:
            cache_put(key, (r.content, r.headers.get('content-type'),
                            {k: v for k, v in headers.items() if k == 'Content-Disposition'}))
        return Response(r.content, status_code=r.status_code,
                        media_type=r.headers.get('content-type'), headers=headers)
    return JSONResponse({'error': 'The course LoTUS server (hpc/mil.psy.ntu.edu.tw:5000) is not responding '
                                  f'right now ({last_err or "timeout"}). Please retry in a few minutes.'},
                        status_code=502)


@app.get('/')
async def root():
    return RedirectResponse(f'{PREFIX}/')


if DIST.exists():
    app.mount(f'{PREFIX}/assets', StaticFiles(directory=DIST / 'assets'), name='assets')
    app.mount(f'{PREFIX}/static', StaticFiles(directory=DIST / 'static'), name='static')

    @app.get(PREFIX)
    @app.get(f'{PREFIX}/')
    @app.get(f'{PREFIX}/{{rest:path}}')
    async def spa(rest: str = ''):
        f = DIST / rest
        if rest and f.is_file() and DIST in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(DIST / 'index.html')
