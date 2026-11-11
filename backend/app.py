"""LoTUS-BF (HW09) backend.

One FastAPI service that
  1. serves the built React front end at /lotus-bf/ (same origin -> no CORS, no mixed content);
  2. forwards /lotus-bf/api/<path> to the course's LoTUS API, which only speaks plain http.

Why a proxy: the course API (hpc/mil.psy.ntu.edu.tw:5000) has no working https, so a page
served over https cannot call it directly (browsers block "mixed content"). Forwarding on the
server side keeps the numbers identical to the course site while the page stays on https.
"""
import os
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
client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=8.0), follow_redirects=True)


@app.get('/health')
async def health():
    return {'ok': True}


@app.get(f'{PREFIX}/api/{{path:path}}')
async def proxy(path: str, request: Request):
    if not path.startswith(ALLOWED):
        return JSONResponse({'error': f'unknown endpoint: {path}'}, status_code=404)
    last_err = None
    for base in UPSTREAMS:  # fail over to the second course server
        try:
            r = await client.get(f'{base}/{path}', params=request.query_params)
        except httpx.HTTPError as e:
            last_err = e
            continue
        if r.status_code >= 500:
            last_err = f'HTTP {r.status_code}'
            continue
        headers = {'Cache-Control': 'public, max-age=3600'} if r.status_code == 200 else {}
        if 'content-disposition' in r.headers:
            headers['Content-Disposition'] = r.headers['content-disposition']
        return Response(r.content, status_code=r.status_code,
                        media_type=r.headers.get('content-type'), headers=headers)
    return JSONResponse({'error': f'course API unreachable ({last_err})'}, status_code=502)


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
