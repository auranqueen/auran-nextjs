/** admin/orders 송장 CSV 업로드와 동일한 parseLine 패턴 */

export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let c = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      q = !q
      continue
    }
    if (ch === ',' && !q) {
      cells.push(c.trim())
      c = ''
      continue
    }
    c += ch
  }
  cells.push(c.trim())
  return cells.map((x) => x.replace(/^"(.*)"$/, '$1'))
}

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const rawLines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (rawLines.length < 1) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(rawLines[0])
  const rows = rawLines.slice(1).map(parseCsvLine)
  return { headers, rows }
}

export function findHeaderIndex(headers: string[], matchers: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  for (const m of matchers) {
    const needle = m.toLowerCase()
    const idx = normalized.findIndex((h) => h.includes(needle))
    if (idx >= 0) return idx
  }
  return -1
}

export function readCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('CSV read failed'))
    reader.readAsText(file, 'UTF-8')
  })
}

/** 매장명 정규화 키 — trim + 소문자 + 모든 공백 제거 */
export function normalizeStoreNameKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

export type OwnerPointCsvRow = {
  line: number
  store_name: string
  amount: number
  memo: string | null
}

export function parseOwnerPointCsvRows(
  headers: string[],
  rows: string[][],
): { ok: true; rows: OwnerPointCsvRow[] } | { ok: false; error: string } {
  const iStore = findHeaderIndex(headers, ['매장명', '살롱명', '상호', 'store'])
  const iAmount = findHeaderIndex(headers, ['금액', '적립', '포인트', 'amount', 't'])
  const iMemo = findHeaderIndex(headers, ['메모', 'memo', '비고'])

  if (iStore < 0 || iAmount < 0) {
    return { ok: false, error: '헤더에 매장명, 금액 컬럼이 필요합니다.' }
  }

  const maxIdx = Math.max(iStore, iAmount, iMemo >= 0 ? iMemo : -1)
  const out: OwnerPointCsvRow[] = []

  for (let li = 0; li < rows.length; li++) {
    const cells = rows[li]
    if (cells.length <= maxIdx) continue

    const store_name = (cells[iStore] || '').trim()
    const amountRaw = (cells[iAmount] || '').trim().replace(/,/g, '')
    const amount = Math.trunc(Number(amountRaw))
    const memo = iMemo >= 0 ? ((cells[iMemo] || '').trim() || null) : null

    if (!store_name && !amountRaw) continue
    out.push({ line: li + 2, store_name, amount, memo })
  }

  if (!out.length) {
    return { ok: false, error: '유효한 데이터 행이 없습니다.' }
  }

  return { ok: true, rows: out }
}
