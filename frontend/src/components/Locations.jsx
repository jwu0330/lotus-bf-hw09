import { useEffect, useMemo, useState } from 'react'
import { queryUrl, apiFetch } from '../api'

// API: GET /query/{q}/locations  ->  {results: [{study_id, x, y, z}]}
// Present in the template but never mounted; the course design puts it in the left column.
// Clicking a row adds that coordinate to the query (location -> query, the "LoT" in LoTUS).
export function Locations ({ query, onPickLocation }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [page, setPage] = useState(1)
  const [nonce, setNonce] = useState(0)
  const pageSize = 25

  useEffect(() => {
    setPage(1)
    if (!query) { setRows([]); return }
    const ac = new AbortController()
    setLoading(true); setErr('')
    apiFetch(queryUrl(query, 'locations'), ac.signal)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setRows(Array.isArray(data?.results) ? data.results : [])
      })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setRows([]) } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [query, nonce])

  const nStudies = useMemo(() => new Set(rows.map((r) => r.study_id)).size, [rows])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  if (!query) return <div className='empty'>Run a query to list the activation peaks of matching studies.</div>
  if (loading) return <div className='loading' role='status'><span className='spinner' aria-hidden='true' />Loading activation peaks…<div className='skeleton-list'>{[0, 1, 2, 3, 4].map((i) => <div key={i} className='skeleton' />)}</div></div>
  if (err) return <div className='alert alert--error alert--row' role='alert'><span>{err}</span><button className='btn btn--sm' onClick={() => setNonce((n) => n + 1)}>Retry</button></div>
  if (!rows.length) return <div className='empty'>No activation peaks for <b>{query}</b>.</div>
  return (
    <div className='locations'>
      <div className='small'><b>{rows.length}</b> peaks from <b>{nStudies}</b> studies · click a peak to add it</div>
      <div className='table-wrap'>
      <table className='table table--compact'>
        <thead><tr><th>Study</th><th>x</th><th>y</th><th>z</th></tr></thead>
        <tbody>
          {pageRows.map((r, i) => (
            <tr key={`${r.study_id}-${i}`} className='clickable' tabIndex={0} onClick={() => onPickLocation(`[${r.x},${r.y},${r.z}]`)} onKeyDown={(e) => { if (e.key === 'Enter') onPickLocation(`[${r.x},${r.y},${r.z}]`) }} title='Add this coordinate to the query'>
              <td className='small'>{r.study_id}</td><td>{r.x}</td><td>{r.y}</td><td>{r.z}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className='pager'>
        <span>page {page}/{totalPages}</span>
        <span>
          <button className='btn btn--ghost' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <button className='btn btn--ghost' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </span>
      </div>
    </div>
  )
}
