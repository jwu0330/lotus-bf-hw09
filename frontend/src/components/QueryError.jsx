import { isRetryable, parseSuggestions } from '../api'

// One error box for every query-driven panel. Unknown terms show the server's "did you mean"
// suggestions as buttons (replacing the misspelt term in the query); only network/server
// failures offer Retry, because retrying a 4xx query would fail the same way again.
export function QueryError ({ error, onRetry, onFix, prefix = '' }) {
  if (!error) return null
  const msg = String(error.message || error)
  const sug = onFix ? parseSuggestions(msg) : null
  const retry = isRetryable(error) && onRetry
  return (
    <div className={`alert ${retry ? 'alert--error' : 'alert--warn'} alert--row`} role='alert'>
      <span>
        {prefix}{sug ? msg.replace(/\s*Did you mean:[^?]*\??/, '') : msg}
        {sug && sug.options.length > 0 && (
          <span className='suggest'>
            {sug.options.map((o) => <button key={o} className='chip' onClick={() => onFix(sug.bad, o)}>{o}</button>)}
          </span>
        )}
      </span>
      {retry && <button className='btn btn--sm' onClick={onRetry}>Retry</button>}
    </div>
  )
}
