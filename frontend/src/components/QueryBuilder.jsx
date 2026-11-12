import { useEffect, useState } from 'react'
import { checkQuery } from '../api'

const EXAMPLES = ['amygdala', 'default mode', '[-22,-4,-18] NOT emotion', 'reward NOT pain', '[0,-52,26]']

// Draft text is local; the shared query only changes on Enter / Search, so typing does not
// fire four network requests per keystroke (the template updated on every key).
export function QueryBuilder ({ query, setQuery }) {
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

  return (
    <div className='qb'>
      <label className='card__title qb__label' htmlFor='qb-input'>Search by term, MNI coordinate, or both <span className='muted small'>AND · OR · NOT · ( ) · [x,y,z]</span></label>
      <div className='qb__row'>
        <div className='qb__field'>
        <input
          id='qb-input'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder='e.g. [-22,-4,-18] NOT emotion — press Enter'
          className='input'
          aria-invalid={showErrors}
          aria-describedby='qb-hint'
          aria-label='Query'
          enterKeyHint='search'
          autoCapitalize='off' autoCorrect='off' spellCheck={false}
        />
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
