// CSV export shared by Studies and Compare (BOM so Excel reads UTF-8).
export function toCsv (rows) {
  const cols = ['study_id', 'year', 'journal', 'title', 'authors']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
export function downloadCsv (rows, name) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); URL.revokeObjectURL(url)
}
