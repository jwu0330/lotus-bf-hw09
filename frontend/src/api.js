// Same-origin API: the backend in ../backend serves /lotus-bf/api/* by querying the HW08
// Neurosynth PostgreSQL database (a study "mentions" a term when its TF-IDF weight > 0.001).
export const API_BASE = new URL(`${import.meta.env.BASE_URL}api`, window.location.origin).href

export const queryUrl = (q, kind) => `${API_BASE}/query/${encodeURIComponent(q)}/${kind}`

// Fetch the study list for one query; throws Error with the server's message.
export async function fetchStudies (q, signal) {
  const res = await apiFetch(queryUrl(q, 'studies'), signal)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return Array.isArray(data?.results) ? data.results : []
}

// Client-side syntax check: catch typos before a round trip (the server also validates).
export function checkQuery (q) {
  const issues = []
  if (!q.trim()) return { errors: [], warnings: [] }
  let depth = 0
  for (const ch of q) { if (ch === '(') depth++; if (ch === ')') depth--; if (depth < 0) break }
  if (depth !== 0) issues.push('Unbalanced parentheses.')
  for (const m of q.matchAll(/\[([^\]]*)\]/g)) {
    const parts = m[1].split(',').map(s => s.trim())
    if (parts.length !== 3 || parts.some(p => p === '' || Number.isNaN(Number(p)))) issues.push(`Coordinate ${m[0]} must be [x,y,z] numbers.`)
  }
  if ((q.match(/\[/g) || []).length !== (q.match(/\]/g) || []).length) issues.push('Unbalanced square brackets.')
  const toks = q.replace(/\[[^\]]*\]/g, ' X ').trim().split(/\s+/)
  const ops = new Set(['AND', 'OR', 'NOT'])
  if (ops.has(toks[0]) && toks[0] !== 'NOT') issues.push(`Query cannot start with ${toks[0]}.`)
  if (ops.has(toks[toks.length - 1])) issues.push(`Query cannot end with ${toks[toks.length - 1]}.`)
  for (let i = 1; i < toks.length; i++) if (ops.has(toks[i]) && ops.has(toks[i - 1]) && toks[i] !== 'NOT') issues.push(`"${toks[i - 1]} ${toks[i]}" has no operand between.`)
  return { errors: [...new Set(issues)], warnings: [] }
}

// Every API call goes through here: a hard 70 s limit (the data server may need ~30 s to wake up) so a hung upstream shows an error
// instead of an endless loading skeleton.
export const TIMEOUT_MS = 70000
export function apiFetch (url, signal) {
  const t = AbortSignal.timeout(TIMEOUT_MS)
  return fetch(url, { signal: signal ? AbortSignal.any([signal, t]) : t })
    .catch((e) => {
      if (e.name === 'TimeoutError' || (e.name === 'AbortError' && t.aborted)) throw new Error('The data server did not answer in time. Please retry later.')
      throw e
    })
}
