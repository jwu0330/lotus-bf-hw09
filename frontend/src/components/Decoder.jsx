import { useEffect, useState } from 'react'
import { API_BASE, apiFetch } from '../api'

// API: GET /decode/<x>_<y>_<z>?r=6
//   -> {xyz, r, n_studies, n_total, terms: [{term, k, rate, base_rate, lift}]}
// Reverse inference: which terms are over-represented among studies reporting a peak near
// the crosshair. Fires only on the button (not on every crosshair move).
const fmtXYZ = (xyz) => `[${xyz.map((v) => Math.round(Number(v) || 0)).join(', ')}]`
const pct = (v) => { const n = Number(v); return Number.isFinite(n) ? `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%` : '—' }

export function Decoder ({ coord, onPickTerm }) {
  const [r, setR] = useState(6)
  const [target, setTarget] = useState(null) // {xyz, r} that was requested
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const xyz = Array.isArray(coord) && coord.length === 3 ? coord.map((v) => Math.round(Number(v) || 0)) : null

  useEffect(() => {
    if (!target) return
    const ac = new AbortController()
    setLoading(true); setErr('')
    apiFetch(`${API_BASE}/decode/${target.xyz.join('_')}?r=${encodeURIComponent(target.r)}`, ac.signal)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`)
        setData(d && typeof d === 'object' ? d : {})
      })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setData(null) } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [target])

  const decode = () => { if (xyz) setTarget({ xyz, r: Number(r) > 0 ? Number(r) : 6 }) }
  const terms = Array.isArray(data?.terms) ? data.terms.slice(0, 15) : []
  const maxLift = Math.max(1, ...terms.map((t) => Number(t.lift) || 0))
  const shownXYZ = Array.isArray(data?.xyz) && data.xyz.length === 3 ? data.xyz : target?.xyz
  const stale = target && xyz && (target.xyz.join() !== xyz.join() || target.r !== Number(r))

  return (
    <div className='decoder'>
      <div className='panel-head'>
        <div className='card__title'>Decode location</div>
        <span className='muted small'>which terms are linked to this spot?</span>
      </div>
      <div className='decoder__bar'>
        <span className='decoder__xyz' title='Current crosshair (MNI mm)'>{xyz ? fmtXYZ(xyz) : '—'}</span>
        <label className='decoder__r small muted'>r
          <input className='input input--sm' type='number' min={1} max={30} step={1} value={r} onChange={(e) => setR(e.target.value)} aria-label='Search radius (mm)' />
          mm
        </label>
        <button className='btn btn--primary' onClick={decode} disabled={!xyz || loading}>
          {loading ? 'Decoding…' : stale ? 'Decode new position' : 'Decode this location'}
        </button>
      </div>

      {!target && <div className='empty'>Move the crosshair on the brain map, then press <b>Decode this location</b> to rank the terms most associated with it.</div>}
      {loading && <div className='skeleton-list'>{[0, 1, 2, 3, 4].map((i) => <div key={i} className='skeleton' style={{ width: `${90 - i * 12}%` }} />)}</div>}
      {!loading && err && <div className='alert alert--error'>{err}</div>}
      {!loading && !err && data && (
        <>
          <div className='small muted'>
            <b className='decoder__n'>{Number(data.n_studies || 0).toLocaleString()}</b> studies within {data.r ?? target?.r} mm of {shownXYZ ? fmtXYZ(shownXYZ) : '—'}
            {data.n_total ? <> (of {Number(data.n_total).toLocaleString()})</> : null}
          </div>
          {terms.length === 0
            ? <div className='empty'>No term stands out here — too few nearby studies. Try a larger radius.</div>
            : (
              <div className='decoder__list'>
                <div className='decoder__legend small muted'><span>term</span><span>lift · k · rate</span></div>
                {terms.map((t) => (
                  <button
                    key={t.term} className='related__row decoder__row' onClick={() => onPickTerm(t.term)}
                    title={`${t.k} of ${data.n_studies} nearby studies mention "${t.term}" (${pct(t.rate)}) vs ${pct(t.base_rate)} of all studies. Click to add to the query.`}
                  >
                    <span className='related__bar' style={{ width: `${((Number(t.lift) || 0) / maxLift) * 100}%` }} />
                    <span className='related__term'>{t.term}</span>
                    <span className='related__num'><b>{(Number(t.lift) || 0).toFixed(1)}×</b> · {t.k} · {pct(t.rate)}</span>
                  </button>
                ))}
              </div>
              )}
        </>
      )}
    </div>
  )
}
