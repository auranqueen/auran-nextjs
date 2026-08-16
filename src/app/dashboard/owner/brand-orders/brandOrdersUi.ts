/** Shared UI tokens/helpers for owner brand-orders (single source; do not duplicate hex in components). */
export const PURPLE = '#7B5EA7'
export const BORDER = '#ede9f7'
export const TEXT = '#1A1A2E'
export const SUB = '#888888'

export type OrderItemLine = {
  name: string
  qty: number
  unit_price?: number
  line_amount?: number
  bonus?: number
  promo?: string
}

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '대기중', color: '#A07830', bg: '#FBF5E8' },
  approved: { label: '승인됨', color: '#1E6B40', bg: '#EAF5EE' },
  shipping: { label: '배송중', color: '#185FA5', bg: '#E6F1FB' },
  done: { label: '완료', color: '#888888', bg: '#F5F5F5' },
  cancelled: { label: '취소', color: '#C0392B', bg: '#FAEAEA' },
}

export function formatOrderItemLine(it: OrderItemLine): string {
  const bonus = Math.trunc(Number(it.bonus) || 0)
  return `${it.name} ${it.qty}ea${bonus > 0 ? ` (+${bonus} 증정)` : ''}`
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}
