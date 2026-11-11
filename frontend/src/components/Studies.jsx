import { useEffect, useMemo, useState } from 'react'
import { fetchStudies } from '../api'
import { downloadCsv } from '../csv'

export function Studies ({ query }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sortKey, setSortKey] = useState('year')
  const [sortDir, setSortDir] = useState('desc')
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => { setPage(1); setFilter('') }, [query])
  useEffect(() => { setPage(1) }, [filter])

  useEffect(() => {
    if (!query) { setRows([]); return }
    const ac = new AbortController()
    setLoading(true); setErr('')
    fetchStudies(query, ac.signal)
      .then(setRows)
      .catch((e) => { if (e.name !== 'AbortError') { setErr(`Unable to fetch studies: ${e.message}`); setRows([]) } })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
    return () => ac.abort()
  }, [query])

  const changeSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'year' ? 'desc' : 'asc') }
  }

  const sorted = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const arr = f ? rows.filter((r) => `${r.title} ${r.authors} ${r.journal}`.toLowerCase().includes(f)) : [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => sortKey === 'year'
      ? (Number(a.year || 0) - Number(b.year || 0)) * dir
      : String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''), 'en') * dir)
    return arr
  }, [rows, sortKey, sortDir, filter])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  if (!query) return <div className='muted'>Enter a query or pick a term to list matching studies.</div>
  return (
    <div className='studies'>
      <div className='studies__bar'>
        <div className='card__title'>Studies {!loading && !err && <span className='badge'>{rows.length}</span>}</div>
        <input className='input input--sm' placeholder='Filter title / author / journal' value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className='btn btn--ghost' disabled={!sorted.length} onClick={() => downloadCsv(sorted, `lotus-studies-${query.replace(/[^\w-]+/g, '_').slice(0, 40)}.csv`)}>CSV</button>
      </div>
      {loading && <div className='skeleton-list'>{Array.from({ length: 6 }).map((_, i) => <div key={i} className='skeleton' />)}</div>}
      {err && <div className='alert alert--error'>{err}</div>}
      {!loading && !err && (
        <>
          <div className='table-wrap'>
            <table className='table'>
              <thead>
                <tr>
                  {[['year', 'Year'], ['title', 'Title'], ['journal', 'Journal']].map(([k, label]) => (
                    <th key={k} onClick={() => changeSort(k)} aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      {label} <span className='muted'>{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0
                  ? <tr><td colSpan={3} className='muted'>No studies match.</td></tr>
                  : pageRows.map((r) => (
                    <tr key={r.id || r.study_id}>
                      <td className='nowrap'>{r.year ?? ''}</td>
                      <td>
                        <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.study_id}/`} target='_blank' rel='noreferrer'>{r.title || '(untitled)'}</a>
                        <div className='muted small'>{r.authors}</div>
                      </td>
                      <td className='small'>{r.journal}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className='pager'>
            <span>{sorted.length !== rows.length ? `${sorted.length} of ${rows.length}` : sorted.length} studies · page {page}/{totalPages}</span>
            <span>
              <button className='btn btn--ghost' disabled={page <= 1} onClick={() => setPage(1)}>⏮</button>
              <button className='btn btn--ghost' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className='btn btn--ghost' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              <button className='btn btn--ghost' disabled={page >= totalPages} onClick={() => setPage(totalPages)}>⏭</button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
