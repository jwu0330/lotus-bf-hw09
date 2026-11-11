import { useCallback, useEffect, useState } from 'react'
import { Terms } from './components/Terms'
import { RelatedTerms } from './components/RelatedTerms'
import { Locations } from './components/Locations'
import { QueryBuilder } from './components/QueryBuilder'
import { Studies } from './components/Studies'
import { Compare } from './components/Compare'
import { NiiViewer } from './components/NiiViewer'
import { useUrlQueryState } from './hooks/useUrlQueryState'
import './App.css'

// Layout follows the course rule "one API <-> one component <-> one block":
//   left   Terms (/terms) · RelatedTerms (/terms/<t>) · Locations (/query/q/locations)
//   middle QueryBuilder · Studies (/query/q/studies) | Compare (/query/q/studies x2)
//   right  NiiViewer (/query/q/nii)
// App only owns the shared query and passes callbacks (onPickTerm, onPickLocation) down.
export default function App () {
  const [query, setQuery] = useUrlQueryState('q')
  const [focusTerm, setFocusTerm] = useState('')
  const [leftTab, setLeftTab] = useState('terms')
  const [midTab, setMidTab] = useState('studies')
  const [server, setServer] = useState('ok') // ok | waking | down

  const append = useCallback((tok) => setQuery((q) => (q ? `${q} ${tok}` : tok)), [setQuery])
  const handlePickTerm = useCallback((t) => { append(t); setFocusTerm(t) }, [append])
  const handlePickLocation = useCallback((xyz) => append(xyz), [append])

  // Free hosting sleeps when idle: tell the user instead of looking broken.
  useEffect(() => {
    const t = setTimeout(() => setServer('waking'), 4000)
    fetch(`${import.meta.env.BASE_URL}api/terms`)
      .then((r) => setServer(r.ok ? 'ok' : 'down'))
      .catch(() => setServer('down'))
      .finally(() => clearTimeout(t))
    return () => clearTimeout(t)
  }, [])

  // A single-term query also drives the related-terms panel.
  useEffect(() => {
    const q = (query || '').trim()
    if (q && !/[[\]()]|\b(AND|OR|NOT)\b/.test(q)) setFocusTerm(q)
  }, [query])

  return (
    <div className='app'>
      <header className='app__header'>
        <div>
          <h1 className='app__title'>LoTUS-BF</h1>
          <div className='app__subtitle'>Location-or-Term Unified Search for Brain Functions</div>
        </div>
        {query && <div className='app__query' title='Current query (shareable URL)'>q = <code>{query}</code></div>}
      </header>
      {server === 'waking' && <div className='banner'>Connecting… (free hosting sleeps when idle; the first load can take up to a minute)</div>}
      {server === 'down' && <div className='banner banner--err'>The course LoTUS data server (psy.ntu.edu.tw:5000) is not responding right now, so searches will fail. This site is up; please retry in a few minutes.</div>}

      <main className='app__grid'>
        <section className='card' aria-label='Terms and locations'>
          <div className='tabs' role='tablist'>
            {[['terms', 'Terms'], ['locations', 'Locations']].map(([k, label]) => (
              <button key={k} role='tab' aria-selected={leftTab === k} className={`tab ${leftTab === k ? 'is-active' : ''}`} onClick={() => setLeftTab(k)}>{label}</button>
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

        <section className='card' aria-label='Query and studies'>
          <QueryBuilder query={query} setQuery={setQuery} />
          <div className='tabs' role='tablist'>
            {[['studies', 'Studies'], ['compare', 'Compare A vs B']].map(([k, label]) => (
              <button key={k} role='tab' aria-selected={midTab === k} className={`tab ${midTab === k ? 'is-active' : ''}`} onClick={() => setMidTab(k)}>{label}</button>
            ))}
          </div>
          {midTab === 'studies'
            ? <Studies query={query} />
            : <Compare queryA={query} onUseQuery={(q) => { setQuery(q); setMidTab('studies') }} />}
        </section>

        <section className='card' aria-label='Brain map'>
          <NiiViewer query={query} onPickLocation={handlePickLocation} />
        </section>
      </main>
      <footer className='app__footer'>
        Data: course LoTUS API (Neurosynth). Study links open PubMed. <a href={`${import.meta.env.BASE_URL}api/docs`}>API docs</a>
      </footer>
    </div>
  )
}
