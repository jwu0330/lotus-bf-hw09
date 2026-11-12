import { useEffect, useMemo, useState } from 'react'
import { fetchStudies, checkQuery } from '../api'
import { downloadCsv } from '../csv'
import { QueryError } from './QueryError'

// Highlight: compare two queries side by side (same /query/{q}/studies API, run twice).
// Set operations are done here on study_id (two plain queries), which also lets us show the
// overlap and both differences at once instead of three separate boolean queries.
// A\B and B\A are exactly HW08's "functional dissociation" between two terms/locations.
export function Compare ({ queryA, onUseQuery }) {
  const [a, setA] = useState(queryA || 'amygdala')
  const [b, setB] = useState('hippocampus')
  const [run, setRun] = useState(null)
  const [state, setState] = useState({ loading: false, err: null, A: [], B: [] })
  const [view, setView] = useState('onlyA')
  const [nonce, setNonce] = useState(0)

  useEffect(() => { if (queryA) setA(queryA) }, [queryA])

  useEffect(() => {
    if (!run) return
    const ac = new AbortController()
    setState((s) => ({ ...s, loading: true, err: null }))
    Promise.all([fetchStudies(run.a, ac.signal), fetchStudies(run.b, ac.signal)])
      .then(([A, B]) => setState({ loading: false, err: null, A, B }))
      .catch((e) => { if (e.name !== 'AbortError') setState({ loading: false, err: e, A: [], B: [] }) })
    return () => ac.abort()
  }, [run, nonce])

  const sets = useMemo(() => {
    const idsB = new Set(state.B.map((r) => r.study_id))
    const idsA = new Set(state.A.map((r) => r.study_id))
    const both = state.A.filter((r) => idsB.has(r.study_id))
    const onlyA = state.A.filter((r) => !idsB.has(r.study_id))
    const onlyB = state.B.filter((r) => !idsA.has(r.study_id))
    const union = state.A.length + onlyB.length
    return { both, onlyA, onlyB, union, jaccard: union ? both.length / union : 0 }
  }, [state])

  const bad = [...checkQuery(a).errors, ...checkQuery(b).errors]
  const go = () => { if (a.trim() && b.trim() && !bad.length) setRun({ a: a.trim(), b: b.trim() }) }
  const lists = { onlyA: sets.onlyA, both: sets.both, onlyB: sets.onlyB }
  const labels = run ? { onlyA: `${run.a} only`, both: 'both', onlyB: `${run.b} only` } : {}
  const max = Math.max(sets.onlyA.length, sets.both.length, sets.onlyB.length, 1)

  return (
    <div className='compare'>
      <div className='card__title'>Compare two queries</div>
      <div className='compare__inputs'>
        <label><span className='dot dot--a' />A <input className='input' aria-label='Query A' value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
        <label><span className='dot dot--b' />B <input className='input' aria-label='Query B' value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></label>
        <span className='compare__actions'>
          <button className='btn btn--ghost' onClick={() => { setA(b); setB(a) }} title='Swap A and B' aria-label='Swap A and B'>⇄</button>
          <button className='btn btn--primary' onClick={go} disabled={!a.trim() || !b.trim() || bad.length > 0 || state.loading}>{state.loading ? 'Comparing…' : 'Compare'}</button>
        </span>
      </div>
      {bad.map((e) => <div key={e} className='alert alert--error'>{e}</div>)}
      {state.loading && <div className='loading' role='status'><span className='spinner' aria-hidden='true' />Fetching both study lists…<div className='skeleton-list'>{[0, 1, 2].map((i) => <div key={i} className='skeleton' />)}</div></div>}
      <QueryError error={state.err} prefix='Comparison failed: ' onRetry={() => setNonce((n) => n + 1)} />
      {run && !state.loading && !state.err && (
        <>
          <div className='compare__stats'>
            {['onlyA', 'both', 'onlyB'].map((k) => (
              <button key={k} className={`stat stat--${k} ${view === k ? 'is-active' : ''}`} onClick={() => setView(k)}>
                <span className='stat__num'>{lists[k].length}</span>
                <span className='stat__label'>{labels[k]}</span>
                <span className='stat__bar' style={{ width: `${(lists[k].length / max) * 100}%` }} />
              </button>
            ))}
          </div>
          <div className='small muted'>
            A = {state.A.length}, B = {state.B.length}, union = {sets.union}, overlap (Jaccard) = {sets.jaccard.toFixed(3)}.
            {' '}“A only” is the HW08 dissociation A\B: studies that report A but not B.
          </div>
          <div className='compare__list-head'>
            <b>{labels[view]}</b>
            <span>
              {view !== 'both' && <button className='btn btn--ghost' onClick={() => onUseQuery(view === 'onlyA' ? `${run.a} NOT ${run.b}` : `${run.b} NOT ${run.a}`)} title='Load this query in the main view and brain map'>Show on brain</button>}
              <button className='btn btn--ghost' disabled={!lists[view].length} onClick={() => downloadCsv(lists[view], `lotus-compare-${view}.csv`)}>CSV</button>
            </span>
          </div>
          <ul className='compare__list'>
            {lists[view].slice(0, 100).map((r) => (
              <li key={r.id || r.study_id}>
                <span className='muted nowrap'>{r.year}</span>{' '}
                <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.study_id}/`} target='_blank' rel='noreferrer'>{r.title}</a>
              </li>
            ))}
            {lists[view].length > 100 && <li className='muted'>…and {lists[view].length - 100} more (download CSV for all)</li>}
          </ul>
        </>
      )}
      {!run && <div className='empty'>Enter two terms or coordinates (e.g. A = amygdala, B = hippocampus) to see what they share and what dissociates them.</div>}
    </div>
  )
}
