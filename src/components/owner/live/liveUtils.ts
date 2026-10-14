export const GOLD = '#C9A96E'
export const PURPLE = '#7B5EA7'
export const BORDER = '#ede9f7'
export const TEXT = '#1A1A2E'
export const SUB = '#888888'

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  upcoming: { label: '예정', color: GOLD, bg: '#FBF5EA' },
  live: { label: '방송중', color: '#A32D2D', bg: '#FCEBEB' },
  ended: { label: '종료', color: '#5F5E5A', bg: '#F1EFE8' },
}

export interface BroadcastRow {
  id: number
  title: string
  description: string | null
  scheduled_at: string | null
  status: string
  mux_live_stream_id: string | null
  hls_url: string | null
  started_at: string | null
  ended_at: string | null
  thumbnail_url: string | null
  viewer_count: number | null
}

export interface BroadcastActions {
  keyLoading: number | null
  deleteConfirm: number | null
  deleting: number | null
  onStreamKey: (id: number) => void
  onEdit: (b: BroadcastRow) => void
  onAskDelete: (id: number | null) => void
  onDelete: (id: number) => void
}

export type DateMarks = Record<string, { past: boolean; upcoming: boolean }>

export function toDateStr(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const EMPTY = { title: '', description: '' }

export function defaultSchedule() {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  return { date: toDateStr(d), hour: String(d.getHours()).padStart(2, '0'), minute: '00' }
}

export function scheduleFromIso(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return { date: toDateStr(d), hour: p(d.getHours()), minute: p(Math.floor(d.getMinutes() / 10) * 10) }
}

function timeOf(b: BroadcastRow, fallback: number) {
  const t = Date.parse(b.scheduled_at ?? b.started_at ?? '')
  return Number.isNaN(t) ? fallback : t
}

function dateKeyOf(b: BroadcastRow) {
  const iso = b.scheduled_at ?? b.started_at
  return iso ? toDateStr(new Date(iso)) : null
}

export function splitBroadcasts(list: BroadcastRow[]) {
  const rank = (b: BroadcastRow) => (b.status === 'live' ? 0 : 1)
  const upcoming = list
    .filter((b) => b.status !== 'ended')
    .sort((a, b) => rank(a) - rank(b) || timeOf(a, Number.MAX_SAFE_INTEGER) - timeOf(b, Number.MAX_SAFE_INTEGER))
  const past = list.filter((b) => b.status === 'ended').sort((a, b) => timeOf(b, 0) - timeOf(a, 0))
  return { upcoming, past }
}

export function pickHero(list: BroadcastRow[], now = Date.now()) {
  const live = list.find((b) => b.status === 'live')
  if (live) return live
  const next = list
    .filter((b) => b.status === 'upcoming' && timeOf(b, -1) >= now)
    .sort((a, b) => timeOf(a, 0) - timeOf(b, 0))
  return next[0] ?? null
}

export function buildDateMarks(list: BroadcastRow[]) {
  const marks: DateMarks = {}
  for (const b of list) {
    const key = dateKeyOf(b)
    if (!key) continue
    const m = marks[key] ?? { past: false, upcoming: false }
    if (b.status === 'ended') m.past = true
    else m.upcoming = true
    marks[key] = m
  }
  return marks
}

export function filterByDate(list: BroadcastRow[], date: string | null) {
  return date ? list.filter((b) => dateKeyOf(b) === date) : list
}

export function ddayLabel(b: BroadcastRow, now = Date.now()) {
  if (b.status === 'live') return 'LIVE'
  if (!b.scheduled_at) return ''
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = new Date(b.scheduled_at)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'D-DAY'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}

export function formatSchedule(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
