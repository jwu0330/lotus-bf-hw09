// src/main.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Fix vs template: style must be an object in JSX (a string crashed the error screen itself),
// and aborted fetches (AbortError) are normal when the query changes, not fatal errors.
function ErrorBoundary ({ children }) {
  const [err, setErr] = React.useState(null)
  React.useEffect(() => {
    const handler = (e) => {
      const x = e?.error || e?.reason || e
      if (x?.name === 'AbortError') return
      setErr(x)
    }
    window.addEventListener('error', handler)
    window.addEventListener('unhandledrejection', handler)
    return () => {
      window.removeEventListener('error', handler)
      window.removeEventListener('unhandledrejection', handler)
    }
  }, [])
  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Runtime error</h2>
        <pre style={{ whiteSpace: 'pre-wrap', padding: 12, borderRadius: 8, background: 'var(--surface-2)' }}>
          {String(err?.stack || err?.message || err)}
        </pre>
        <button className='btn btn--primary' onClick={() => setErr(null)}>Dismiss</button>
      </div>
    )
  }
  return children
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
