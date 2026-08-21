import type { CSSProperties } from 'react'

export const PURPLE = '#7B5EA7'
export const GOLD = '#C9A96E'
export const SUB = 'rgba(255,255,255,0.3)'
export const TEXT = 'rgba(255,255,255,0.9)'
export const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
}

export type OrderRow = {
  id: string
  batch_id?: string | null
  salon_name?: string | null
  items?: unknown
}

export type ClosePreviewGroup = {
  salonName: string
  firstProductName: string
  extraCount: number
  badgeCount: number
}

export function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function nextKstDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + 1))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function staffSubmittedBy(): string {
  if (typeof window === 'undefined') return 'unknown'
  const name = sessionStorage.getItem('brand_staff_name') || '물류'
  const role = sessionStorage.getItem('brand_staff_role') || ''
  return role ? `${name} (${role})` : name
}

function flattenItems(items: unknown): Array<{ name?: string; product_name?: string }> {
  return Array.isArray(items) ? items : []
}

function itemName(it: { name?: string; product_name?: string }): string {
  return String(it?.name || it?.product_name || '').trim() || '제품'
}

export function groupBySalon(rows: OrderRow[]): ClosePreviewGroup[] {
  const map = new Map<string, ReturnType<typeof flattenItems>>()
  for (const r of rows) {
    const key = String(r.salon_name || '').trim() || '살롱명 없음'
    const next = flattenItems(r.items)
    const prev = map.get(key)
    if (prev) prev.push(...next)
    else map.set(key, [...next])
  }
  return Array.from(map.entries()).map(([salonName, items]) => ({
    salonName,
    firstProductName: items[0] ? itemName(items[0]) : '제품',
    extraCount: Math.max(0, items.length - 1),
    badgeCount: items.length,
  }))
}
