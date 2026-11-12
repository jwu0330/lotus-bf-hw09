import { useEffect, useMemo, useState } from 'react'
import { checkQuery } from '../api'

const EXAMPLES = ['amygdala', 'default mode', '[-22,-4,-18] NOT emotion', 'reward NOT pain', '[0,-52,26]']

// Draft text is local; the shared query only changes on Enter / Search, so typing does not
// fire four network requests per keystroke (the template updated on every key).
// The piece being typed: everything after the last AND/OR/NOT, parenthesis or [x,y,z].
// Terms may contain spaces ("default mode"), so the whole tail is the prefix, not just the last word.
const OPS = /\s*(?:\b(?:AND|OR|NOT)\b|[()]|\[[^\]]*\])\s*/g
function currentPiece (text) {
  let start = 0
  for (const m of text.matchAll(OPS)) start = m.index + m[0].length
  return { start, piece: text.slice(start).replace(/^\s+/, '') }
}

// Autocomplete uses the /terms list App already loaded (HW08 had the same suggestions).
export function QueryBuilder ({ query, setQuery, terms = [] }) {
  const [draft, setDraft] = useState(query)
  useEffect(() => { setDraft(query) }, [query])
  // Syntax errors appear only after a submit attempt, so a half-typed "(" is not flagged as wrong.
  const [tried, setTried] = useState(false)
  const { errors, warnings } = checkQuery(draft)
  const showErrors = tried && errors.length > 0
  const dirty = draft.trim() !== (query || '').trim()
  const submit = () => { setTried(true); if (!errors.length) { setQuery(draft.trim()); setTried(false) } }
  const append = (token) => setDraft((q) => (q ? `${q} ${token}` : token))
  const clear = () => { setDraft(''); setQuery(''); setTried(false) }

  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const { start, piece } = currentPiece(draft)
  const suggestions = useMemo(() => {
    const p = piece.trim().toLowerCase()
    if (!open || !p || p.startsWith('[')) return []
    const pre = []; const mid = []
    for (const t of terms) {
      const l = t.toLowerCase()
      if (l === p) continue
      if (l.startsWith(p)) pre.push(t)
      else if (mid.length < 8 && l.includes(p)) mid.push(t)
      if (pre.length >= 8) break
    }
    return [...pre, ...mid].slice(0, 8)
  }, [piece, terms, open])
  const pick = (t) => { setDraft(draft.slice(0, start) + t + ' '); setOpen(false); setHi(-1) }
  const onKey = (e) => {
    if (suggestions.length && e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % suggestions.length) }
    else if (suggestions.length && e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h <= 0 ? suggestions.length - 1 : h - 1)) }
    else if (e.key === 'Escape') { setOpen(false); setHi(-1) }
    else if ((e.key === 'Enter' || e.key === 'Tab') && hi >= 0 && suggestions[hi]) { e.preventDefault(); pick(suggestions[hi]) }
    else if (e.key === 'Enter') { e.preventDefault(); setOpen(false); submit() }
  }

  return (
    <div className='qb'>
      <label className='card__title qb__label' htmlFor='qb-input'>Search by term, MNI coordinate, or both <span className='muted small'>AND · OR · NOT · ( ) · [x,y,z]</span></label>
      <div className='qb__row'>
        <div className='qb__field'>
        <input
          id='qb-input'
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); setHi(-1) }}
          onKeyDown={onKey}
          onBlur={() => setOpen(false)}
          role='combobox' aria-expanded={suggestions.length > 0} aria-controls='qb-suggest' aria-autocomplete='list'
          aria-activedescendant={hi >= 0 ? `qb-opt-${hi}` : undefined}
          placeholder='e.g. [-22,-4,-18] NOT emotion — press Enter'
          className='input'
          aria-invalid={showErrors}
          aria-describedby='qb-hint'
          aria-label='Query'
          enterKeyHint='search'
          autoCapitalize='off' autoCorrect='off' spellCheck={false}
        />
        {suggestions.length > 0 && (
          <ul id='qb-suggest' className='qb__suggest' role='listbox'>
            {suggestions.map((t, i) => (
              <li key={t} id={`qb-opt-${i}`} role='option' aria-selected={i === hi} className={i === hi ? 'is-hi' : ''}
                onMouseDown={(e) => { e.preventDefault(); pick(t) }} onMouseEnter={() => setHi(i)}>
                {(() => { const q = piece.trim().toLowerCase(); const k = t.toLowerCase().indexOf(q); return <>{t.slice(0, k)}<b>{t.slice(k, k + q.length)}</b>{t.slice(k + q.length)}</> })()}
              </li>
            ))}
          </ul>
        )}
        {draft && <button type='button' className='qb__clear' onClick={clear} aria-label='Clear query' title='Clear query'>×</button>}
        </div>
        <button className='btn btn--primary' onClick={submit} disabled={showErrors || !draft.trim()}>Search</button>
      </div>
      <div className='qb__ops'>
        {['AND', 'OR', 'NOT', '(', ')'].map((t) => (
          <button key={t} className='btn btn--ghost' onClick={() => append(t)} title={`Insert ${t}`}>{t}</button>
        ))}
        <button className='btn btn--ghost' onClick={clear}>Reset</button>
        <span id='qb-hint' className='qb__hint muted' aria-live='polite'>{dirty && draft.trim() ? 'Press Enter or Search to apply' : ''}</span>
      </div>
      {showErrors && errors.map((e) => <div key={e} className='alert alert--error' role='alert'>{e}</div>)}
      {warnings.map((w) => <div key={w} className='alert alert--warn'>{w}</div>)}
      <div className='qb__examples'>
        <span className='muted'>Examples:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className='chip' onClick={() => { setTried(false); setQuery(ex) }}>{ex}</button>
        ))}
      </div>
    </div>
  )
}
