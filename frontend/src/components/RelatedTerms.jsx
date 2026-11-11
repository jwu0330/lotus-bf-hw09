import { useEffect, useState } from 'react'
import { API_BASE } from '../api'

// API: GET /terms/<term>  ->  {related: [{term, co_count, jaccard}]}
// Unused by the template; shows which terms co-occur with the term last picked/queried.
export function RelatedTerms ({ term, onPickTerm }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!term) { setRows([]); return }
    const ac = new AbortController()
    setLoading(true); setErr('')
    fetch(`${API_BASE}/terms/${encodeURIComponent(term)}`, { signal: ac.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setRows(Array.isArray(data?.related) ? data.related.slice(0, 15) : [])
      })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setRows([]) } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [term])

  if (!term) return <div className='muted small'>Pick a term to see which terms co-occur with it.</div>
  const max = rows[0]?.jaccard || 1
  return (
    <div className='related'>
      <div className='small'>Co-occurring with <b>{term}</b> (Jaccard)</div>
      {loading && <div className='skeleton' />}
      {err && <div className='alert alert--error'>{err}</div>}
      {!loading && !err && rows.length === 0 && <div className='muted small'>No related terms.</div>}
      {!loading && !err && rows.map((r) => (
        <button key={r.term} className='related__row' onClick={() => onPickTerm(r.term)} title={`${r.co_count} studies mention both`}>
          <span className='related__bar' style={{ width: `${(r.jaccard / max) * 100}%` }} />
          <span className='related__term'>{r.term}</span>
          <span className='related__num'>{r.jaccard.toFixed(2)}</span>
        </button>
      ))}
    </div>
  )
}
