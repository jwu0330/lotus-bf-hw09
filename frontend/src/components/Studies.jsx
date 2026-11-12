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
  const [nonce, setNonce] = useState(0) // bump to retry the same query
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
  }, [query, nonce])

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

  if (!query) return <div className='empty'>Enter a query above, pick a term, or try an example.</div>
  return (
    <div className='studies'>
      <div className='studies__bar'>
        <div className='card__title'>Studies {!loading && !err && <span className='badge'>{rows.length.toLocaleString()}</span>}</div>
        <input className='input input--sm' type='search' placeholder='Filter title / author / journal' aria-label='Filter studies' value={filter} onChange={(e) => setFilter(e.target.value)} disabled={loading || !!err || !rows.length} />
        <button className='btn btn--ghost' disabled={!sorted.length} onClick={() => downloadCsv(sorted, `lotus-studies-${query.replace(/[^\w-]+/g, '_').slice(0, 40)}.csv`)}>CSV</button>
      </div>
      {loading && (
        <div className='loading' role='status' aria-live='polite'>
          <span className='spinner' aria-hidden='true' />Searching studies for <code>{query}</code>…
          <div className='skeleton-list'>{Array.from({ length: 6 }).map((_, i) => <div key={i} className='skeleton' />)}</div>
        </div>
      )}
      {err && <div className='alert alert--error alert--row' role='alert'><span>{err}</span><button className='btn btn--sm' onClick={() => setNonce((n) => n + 1)}>Retry</button></div>}
      {!loading && !err && rows.length === 0 && <div className='empty'>No studies match <b>{query}</b>. Try a broader term, a larger radius, or remove a NOT clause.</div>}
      {!loading && !err && rows.length > 0 && (
        <>
          <div className='table-wrap'>
            <table className='table'>
              <thead>
                <tr>
                  {[['year', 'Year'], ['title', 'Title'], ['journal', 'Journal']].map(([k, label]) => (
                    <th key={k} className={k === 'journal' ? 'studies__journal' : undefined} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); changeSort(k) } }} onClick={() => changeSort(k)} aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      {label} <span className='muted'>{sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0
                  ? <tr><td colSpan={3} className='muted'>No studies match the filter “{filter}”. <button className='linklike' onClick={() => setFilter('')}>Clear filter</button></td></tr>
                  : pageRows.map((r) => (
                    <tr key={r.id || r.study_id}>
                      <td className='nowrap'>{r.year ?? ''}</td>
                      <td>
                        <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.study_id}/`} target='_blank' rel='noreferrer'>{r.title || '(untitled)'}</a>
                        <div className='muted small'>{r.authors}</div>
                        <div className='muted small studies__journal-inline'>{r.journal}</div>
                      </td>
                      <td className='small studies__journal'>{r.journal}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className='pager'>
            <span>{sorted.length !== rows.length ? `${sorted.length} of ${rows.length}` : sorted.length} studies · page {page}/{totalPages}</span>
            <span>
              <button className='btn btn--ghost' disabled={page <= 1} onClick={() => setPage(1)} aria-label='First page'>⏮</button>
              <button className='btn btn--ghost' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className='btn btn--ghost' disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              <button className='btn btn--ghost' disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label='Last page'>⏭</button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
