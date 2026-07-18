import { canShowCyclePhase } from '@/lib/hormoneUtils'

export type PhaseInfo = { label: string; emoji: string; style: string }

export type BookingRow = {
  id: string
  booking_time?: string | null
  service_name?: string | null
  service_price?: number | null
  status?: string | null
  external_customer_id?: string | null
  customer_name?: string | null
}

export type ExtCustomer = {
  id: string
  name: string
  memo?: string | null
  auran_user_id?: string | null
  last_purchase_at?: string | null
  visit_count?: number | null
  auran_joined?: boolean | null
}

export function parseMemo(raw: string | null | undefined) {
  try {
    return JSON.parse(String(raw || '{}'))
  } catch {
    return {}
  }
}

export function getPhase(last: string | null | undefined): PhaseInfo | null {
  if (!last) return null
  const diff = Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
  const day = ((diff % 28) + 28) % 28
  if (day < 5) return { label: '달빛기', emoji: '🌙', style: 'pm' }
  if (day < 13) return { label: '황금기', emoji: '✨', style: 'pg' }
  if (day < 20) return { label: '만개기', emoji: '🌸', style: 'pb' }
  return { label: '물들기', emoji: '🍂', style: 'pf' }
}

export function parseTreatmentName(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw)
      return String(j?.name || '')
    } catch {
      return raw
    }
  }
  if (typeof raw === 'object' && raw !== null) return String((raw as any).name || '')
  return ''
}

export function initials(name: string) {
  return String(name || '고').slice(0, 1)
}

export { canShowCyclePhase }
