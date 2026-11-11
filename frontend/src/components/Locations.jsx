import { useEffect, useMemo, useState } from 'react'
import { queryUrl } from '../api'

// API: GET /query/{q}/locations  ->  {results: [{study_id, x, y, z}]}
// Present in the template but never mounted; the course design puts it in the left column.
// Clicking a row adds that coordinate to the query (location -> query, the "LoT" in LoTUS).
export function Locations ({ query, onPickLocation }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  useEffect(() => {
    setPage(1)
    if (!query) { setRows([]); return }
    const ac = new AbortController()
    setLoading(true); setErr('')
    fetch(queryUrl(query, 'locations'), { signal: ac.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        setRows(Array.isArray(data?.results) ? data.results : [])
      })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setRows([]) } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [query])

  const nStudies = useMemo(() => new Set(rows.map((r) => r.study_id)).size, [rows])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize)

  if (!query) return <div className='empty'>Run a query to list the activation peaks of matching studies.</div>
  if (loading) return <div className='skeleton' />
  if (err) return <div className='alert alert--error'>{err}</div>
  return (
    <div className='locations'>
      <div className='small'><b>{rows.length}</b> peaks from <b>{nStudies}</b> studies · click a peak to add it</div>
      <table className='table table--compact'>
        <thead><tr><th>Study</th><th>x</th><th>y</th><th>z</th></tr></thead>
        <tbody>
          {pageRows.map((r, i) => (
            <tr key={`${r.study_id}-${i}`} className='clickable' onClick={() => onPickLocation(`[${r.x},${r.y},${r.z}]`)} title='Add this coordinate to the query'>
              <td className='small'>{r.study_id}</td><td>{r.x}</td><td>{r.y}</td><td>{r.z}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
