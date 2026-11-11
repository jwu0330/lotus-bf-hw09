// Same-origin API: the backend in ../backend forwards /lotus-bf/api/* to the course LoTUS API.
// (The course API is http-only; calling it directly from an https page is blocked as mixed content.)
export const API_BASE = new URL(`${import.meta.env.BASE_URL}api`, window.location.origin).href

export const queryUrl = (q, kind) => `${API_BASE}/query/${encodeURIComponent(q)}/${kind}`

// Fetch the study list for one query; throws Error with the server's message.
export async function fetchStudies (q, signal) {
  const res = await fetch(queryUrl(q, 'studies'), { signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return Array.isArray(data?.results) ? data.results : []
}

// Client-side syntax check (the course API silently returns odd results instead of errors).
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
  const warn = []
  if (/\bOR\b/.test(q) || /[()]/.test(q)) warn.push('Note: the course API currently treats OR like AND and ignores parentheses (e.g. "amygdala OR fear" returns 45 = the AND result, not 501). Use Compare for reliable union / difference.')
  return { errors: [...new Set(issues)], warnings: warn }
}
