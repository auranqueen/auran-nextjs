export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'all'
export type TypeFilterKey = 'all' | 'signup' | 'purchase' | 'attendance' | 'referral' | 'review' | 'store_review' | 'share_jam' | 'charge' | 'use'

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: '오늘' },
  { key: 'yesterday', label: '어제' },
  { key: 'week', label: '일주일' },
  { key: 'month', label: '한달' },
  { key: 'all', label: '전체' },
]

export const TYPE_FILTER_OPTIONS: { key: TypeFilterKey; label: string; sourceType?: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'signup', label: '가입', sourceType: 'signup' },
  { key: 'purchase', label: '구매', sourceType: 'order' },
  { key: 'attendance', label: '출석', sourceType: 'attendance' },
  { key: 'referral', label: '추천', sourceType: 'referral' },
  { key: 'review', label: '리뷰', sourceType: 'review_bonus' },
  { key: 'store_review', label: '스토어리뷰', sourceType: 'store_review_bonus' },
  { key: 'share_jam', label: '🍓딸기잼', sourceType: 'share_jam' },
  { key: 'charge', label: '충전', sourceType: 'charge' },
  { key: 'use', label: '사용', sourceType: 'use' },
]

export const TYPE_LABEL: Record<string, string> = {
  signup: '가입축하',
  purchase: '구매적립',
  attendance: '출석',
  referral: '추천보상',
  review: '리뷰',
  charge: '충전',
  use: '사용',
  share_reward: '공유보상',
  share_jam: '🍓딸기잼',
  store_review_bonus: '스토어리뷰',
  order: '구매적립',
  share: '공유',
  gift: '선물',
}

export type UserJoin = { name?: string | null; auth_id?: string | null; origin_track?: string | null }
export type ToastRow = {
  id: string
  user_id: string | null
  amount: number | null
  transaction_type: string | null
  source_type: string | null
  source_id: string | null
  reference_id: string | null
  created_at: string | null
  note: string | null
  admin_id: string | null
  status: string
  balance_after: number
  users?: UserJoin | UserJoin[] | null
}

export function pickUser(u: ToastRow['users']): UserJoin | null {
  if (!u) return null
  if (Array.isArray(u)) return u[0] ?? null
  return u
}

export function periodBounds(period: PeriodKey): { from?: string; to?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'yesterday') {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const yEnd = new Date(start)
    yEnd.setHours(23, 59, 59, 999)
    return { from: start.toISOString(), to: yEnd.toISOString() }
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  const start = new Date(now)
  start.setDate(start.getDate() - 29)
  start.setHours(0, 0, 0, 0)
  return { from: start.toISOString(), to: end.toISOString() }
}

export function typeLabel(tx: string | null | undefined) {
  const k = String(tx || '').trim()
  return TYPE_LABEL[k] || k || '—'
}

export function sourceText(row: ToastRow) {
  const parts = [row.source_type, row.reference_id || row.source_id].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}