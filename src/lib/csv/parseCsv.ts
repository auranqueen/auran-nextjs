/** RFC4180-ish CSV parser (comma, quoted fields, UTF-8 BOM strip). */

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
  errors: string[]
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/**
 * Parse CSV text into header-keyed rows.
 * Empty lines skipped. Header names normalized to snake_case lowercase.
 */
export function parseCsv(text: string): ParsedCsv {
  const errors: string[] = []
  const raw = stripBom(String(text || '')).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = raw.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0)
  if (!lines.length) {
    return { headers: [], rows: [], errors: ['empty_csv'] }
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader)
  const headers = headerCells.filter(Boolean)
  if (!headers.length) {
    return { headers: [], rows: [], errors: ['missing_header_row'] }
  }

  const rows: Record<string, string>[] = []
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li])
    if (cells.every((c) => !String(c).trim())) continue
    const row: Record<string, string> = {}
    for (let ci = 0; ci < headers.length; ci++) {
      row[headers[ci]] = String(cells[ci] ?? '').trim()
    }
    rows.push(row)
  }

  if (!rows.length) errors.push('no_data_rows')
  return { headers, rows, errors }
}

/** Pick first matching column value from normalized header keys. */
export function pickColumn(row: Record<string, string>, aliases: string[]): string {
  for (const key of aliases) {
    const v = row[key]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/** 매장명 매칭용 정규화 키: trim + 소문자 + 공백 제거 */
export function normalizeStoreNameKey(name: string): string {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '')
}

export type StoreNameMatchResult<T> =
  | { status: 'matched'; item: T }
  | { status: 'no_match' }
  | { status: 'conflict'; items: T[] }

/**
 * 정규화된 매장명 키로 후보 목록에서 1건 매칭.
 * 0건=no_match, 1건=matched, 2건+=conflict
 */
export function matchByStoreNameKey<T extends { storeKey: string }>(
  rawStoreName: string,
  index: Map<string, T[]>,
): StoreNameMatchResult<T> {
  const key = normalizeStoreNameKey(rawStoreName)
  if (!key) return { status: 'no_match' }
  const hits = index.get(key) || []
  if (hits.length === 0) return { status: 'no_match' }
  if (hits.length === 1) return { status: 'matched', item: hits[0] }
  return { status: 'conflict', items: hits }
}
