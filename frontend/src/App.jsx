import { useCallback, useEffect, useState } from 'react'
import { Terms } from './components/Terms'
import { RelatedTerms } from './components/RelatedTerms'
import { Locations } from './components/Locations'
import { QueryBuilder } from './components/QueryBuilder'
import { Studies } from './components/Studies'
import { Compare } from './components/Compare'
import { NiiViewer } from './components/NiiViewer'
import { Decoder } from './components/Decoder'
import { useUrlQueryState } from './hooks/useUrlQueryState'
import './App.css'

// Layout follows the course rule "one API <-> one component <-> one block":
//   left   Terms (/terms) · RelatedTerms (/terms/<t>) · Locations (/query/q/locations)
//   top    QueryBuilder (full width: the one input that drives every panel below)
//   middle Studies (/query/q/studies) | Compare (/query/q/studies x2)
//   right  NiiViewer (/query/q/nii) · Decoder (/decode/x_y_z)
// App only owns the shared query + crosshair and passes callbacks (onPickTerm, onPickLocation, onCoordChange) down.
export default function App () {
  const [query, setQuery] = useUrlQueryState('q')
  const [focusTerm, setFocusTerm] = useState('')
  const [leftTab, setLeftTab] = useState('terms')
  const [midTab, setMidTab] = useState('studies')
  const [server, setServer] = useState('ok') // ok | waking | down
  const [coord, setCoord] = useState(null) // brain-viewer crosshair, MNI mm [x,y,z]
  const [ping, setPing] = useState(0) // bump to re-check the server
  const [termList, setTermList] = useState([]) // from the same /terms health check: hero count + query autocomplete
  const nTerms = termList.length || null

  // Adjacent words form one term ("default mode"), so a picked term/location is joined with AND
  // unless the query already ends with an operator or "(".
  const append = useCallback((tok) => setQuery((q) => {
    const s = (q || '').trim()
    if (!s) return tok
    return /(\b(AND|OR|NOT)|\()$/i.test(s) ? `${s} ${tok}` : `${s} AND ${tok}`
  }), [setQuery])
  const handlePickTerm = useCallback((t) => { append(t); setFocusTerm(t) }, [append])
  const handlePickLocation = useCallback((xyz) => append(xyz), [append])
  // "Did you mean" button: swap the unknown term for the suggestion, keep the rest of the query.
  const fixQuery = useCallback((bad, good) => setQuery((q) => {
    // Last whole-word match, so fixing "fea" in "fear AND fea" does not touch "fear".
    const words = bad.trim().split(/[\s_]+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`\\b${words.join('[\\s_]+')}\\b`, 'gi')
    const s = q || ''
    let last = null
    for (const m of s.matchAll(re)) last = m
    return last ? s.slice(0, last.index) + good + s.slice(last.index + last[0].length) : good
  }), [setQuery])

  // Free hosting sleeps when idle: tell the user instead of looking broken.
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => alive && setServer('waking'), 4000)
    fetch(`${import.meta.env.BASE_URL}api/terms`, { signal: AbortSignal.timeout(30000) })
      .then(async (r) => {
        if (!alive) return
        setServer(r.ok ? 'ok' : 'down')
        if (r.ok) { const d = await r.json().catch(() => null); if (alive && Array.isArray(d?.terms)) setTermList(d.terms) }
      })
      .catch(() => alive && setServer('down'))
      .finally(() => clearTimeout(t))
    return () => { alive = false; clearTimeout(t) }
  }, [ping])

  // A single-term query also drives the related-terms panel.
  useEffect(() => {
    const q = (query || '').trim()
    if (q && !/[[\]()]|\b(AND|OR|NOT)\b/.test(q)) setFocusTerm(q)
  }, [query])

  return (
    <div className='app'>
      <header className='hero'>
        <div className='hero__inner'>
          <div className='hero__top'>
            <div className='brand'>
              <span className='brand__mark' aria-hidden='true'>L</span>
              <h1 className='app__title'>LoTUS-BF <span className='hero__tag'>HW09</span></h1>
            </div>
            {query && <div className='app__query' title={`Current query: ${query} — the URL is shareable`}><span>Query</span> <code>{query}</code></div>}
          </div>
          <p className='hero__lead'>
            <b>Location-or-Term Unified Search for Brain Functions.</b>{' '}
            Where does the brain do <i>X</i>? What does this region do? Ask with a term, a coordinate, or both.
          </p>
          <div className='hero__row'>
            <ul className='hero__stats' aria-label='Database size'>
              <li><b>14,371</b><span>studies</span></li>
              <li><b>{nTerms ? nTerms.toLocaleString() : '—'}</b><span>terms</span></li>
              <li><b>Neurosynth</b><span>HW08 PostgreSQL</span></li>
            </ul>
          </div>
        </div>
      </header>
      {server === 'waking' && <div className='banner' role='status'><span className='spinner spinner--xs' aria-hidden='true' />Connecting… (free hosting sleeps when idle; the first load can take up to a minute)</div>}
      {server === 'down' && (
        <div className='banner banner--err' role='alert'>
          <span>The data server is not responding right now, so searches may fail.</span>
          <button className='btn btn--sm' onClick={() => { setServer('ok'); setPing((n) => n + 1) }}>Check again</button>
        </div>
      )}

      <section className='querybar' aria-label='Search'>
        <QueryBuilder query={query} setQuery={setQuery} terms={termList} />
      </section>

      <main className='app__grid'>
        <section className='card app__left' aria-label='Terms and locations'>
          <div className='seg' role='tablist'>
            {[['terms', 'Terms'], ['locations', 'Locations']].map(([k, label]) => (
              <button key={k} role='tab' aria-selected={leftTab === k} className={`seg__btn ${leftTab === k ? 'is-active' : ''}`} onClick={() => setLeftTab(k)}>{label}</button>
            ))}
          </div>
          {leftTab === 'terms'
            ? (
              <>
                <Terms onPickTerm={handlePickTerm} />
                <div className='divider' />
                <div className='card__title'>Related terms</div>
                <RelatedTerms term={focusTerm} onPickTerm={handlePickTerm} />
              </>
              )
            : <Locations query={query} onPickLocation={handlePickLocation} />}
        </section>

        <section className='card app__mid' aria-label='Study results'>
          <div className='seg' role='tablist'>
            {[['studies', 'Studies'], ['compare', 'Compare two queries']].map(([k, label]) => (
              <button key={k} role='tab' aria-selected={midTab === k} className={`seg__btn ${midTab === k ? 'is-active' : ''}`} onClick={() => setMidTab(k)}>{label}</button>
            ))}
          </div>
          {midTab === 'studies'
            ? <Studies query={query} onFixQuery={fixQuery} />
            : <Compare queryA={query} onUseQuery={(q) => { setQuery(q); setMidTab('studies') }} />}
        </section>

        <div className='app__col'>
          <section className='card card--dark' aria-label='Brain map'>
            <NiiViewer query={query} onPickLocation={handlePickLocation} onCoordChange={setCoord} />
          </section>
          <section className='card' aria-label='Decode location'>
            <Decoder coord={coord} onPickTerm={handlePickTerm} />
          </section>
        </div>
      </main>
      <footer className='app__footer'>
        <div className='app__source'>
          <span>Data: Neurosynth (HW08 database)</span>
          <span>a study mentions a term when TF-IDF &gt; 0.001</span>
          <span>locations within r mm</span>
        </div>
        <div>Study links open PubMed · <a href={`${import.meta.env.BASE_URL}api/docs`}>API docs</a></div>
      </footer>
    </div>
  )
}
