import { useEffect, useState } from 'react'
import { checkQuery } from '../api'

const EXAMPLES = ['amygdala', 'default mode', '[-22,-4,-18] NOT emotion', 'reward NOT pain', '[0,-52,26]']

// Draft text is local; the shared query only changes on Enter / Search, so typing does not
// fire four network requests per keystroke (the template updated on every key).
export function QueryBuilder ({ query, setQuery }) {
  const [draft, setDraft] = useState(query)
  useEffect(() => { setDraft(query) }, [query])
  const { errors, warnings } = checkQuery(draft)
  const submit = () => { if (!errors.length) setQuery(draft.trim()) }
  const append = (token) => setDraft((q) => (q ? `${q} ${token}` : token))

  return (
    <div className='qb'>
      <div className='card__title'>Query Builder</div>
      <div className='qb__row'>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder='e.g. [-22,-4,-18] NOT emotion — press Enter'
          className='input'
          aria-invalid={errors.length > 0}
          aria-label='Query'
        />
        <button className='btn btn--primary' onClick={submit} disabled={errors.length > 0 || !draft.trim()}>Search</button>
      </div>
      <div className='qb__ops'>
        {['AND', 'OR', 'NOT', '(', ')'].map((t) => (
          <button key={t} className='btn btn--ghost' onClick={() => append(t)}>{t}</button>
        ))}
        <button className='btn btn--ghost' onClick={() => { setDraft(''); setQuery('') }}>Reset</button>
      </div>
      {errors.map((e) => <div key={e} className='alert alert--error'>{e}</div>)}
      {warnings.map((w) => <div key={w} className='alert alert--warn'>{w}</div>)}
      <div className='qb__examples'>
        <span className='muted'>Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className='chip' onClick={() => setQuery(ex)}>{ex}</button>
        ))}
      </div>
    </div>
  )
}
