export type TrackType =
  | 'general'
  | 'menopause_peri'
  | 'menopause_post'
  | 'pregnant'
  | 'postpartum'
  | 'male'
  | 'male_menopause'

export const PHASE_LABELS: Record<string, string> = {
  '달빛기': '달빛기 🌙 (생리기)',
  '황금기': '황금기 ✨ (여포기)',
  '만개기': '만개기 🌸 (배란기)',
  '물들기': '물들기 🍂 (황체기)',
}

export const PHASE_DESC: Record<string, string> = {
  '달빛기': '생리 시작 후 1~5일차 · 예민한 시기예요',
  '황금기': '생리 종료 후 6~13일차 · 흡수력 최고예요',
  '만개기': '14~16일차 · 피부 컨디션 절정이에요',
  '물들기': '17일차~생리 전날 · 트러블 주의 시기예요',
}

export function isPeriodTrack(track: string | null | undefined) {
  return track === 'general' || track === 'menopause_peri'
}

export function calcCycleDay(lastPeriodDate: string | null | undefined, cycleLength: number | null | undefined, now = new Date()) {
  if (!lastPeriodDate) return 0
  const s = new Date(lastPeriodDate)
  if (Number.isNaN(s.getTime())) return 0
  const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()) / 86400000)
  const len = Math.max(21, Math.min(60, Number(cycleLength || 28)))
  const d = ((diff % len) + len) % len
  return d + 1
}

export function calcHormoneBriefing(row: any, now = new Date()) {
  const track = String(row?.track || 'general') as TrackType
  const cycleDay = calcCycleDay(row?.last_period_date || null, Number(row?.cycle_length || 28), now)
  if (track === 'general') {
    if (cycleDay >= 1 && cycleDay <= 5) return { track, cycleDay, phase: '달빛기', focus: '예민/진정' }
    if (cycleDay >= 6 && cycleDay <= 13) return { track, cycleDay, phase: '황금기', focus: '황금기/미백/집중케어' }
    if (cycleDay >= 14 && cycleDay <= 16) return { track, cycleDay, phase: '만개기', focus: '피지/모공' }
    return { track, cycleDay, phase: '물들기', focus: '유지/아로마' }
  }
  if (track === 'menopause_peri') return { track, cycleDay, phase: '불규칙기', focus: '체크인 기반 추천' }
  if (track === 'menopause_post') return { track, cycleDay: 0, phase: '폐경기', focus: '보습/장벽강화/아로마' }
  if (track === 'pregnant') return { track, cycleDay: 0, phase: '임신기', focus: '순한성분/안전성분만' }
  if (track === 'postpartum') {
    const d = row?.delivery_date ? new Date(row.delivery_date) : null
    const months = d && !Number.isNaN(d.getTime()) ? Math.max(0, Math.floor((now.getTime() - d.getTime()) / 2629800000)) : 0
    return { track, cycleDay: months, phase: `출산 후 ${months}개월차`, focus: '회복/장벽/진정' }
  }
  if (track === 'male_menopause') return { track, cycleDay: 0, phase: '남성 갱년기', focus: '피부타입+고민 기반' }
  return { track: 'male' as TrackType, cycleDay: 0, phase: '남성', focus: '피부타입+고민 기반' }
}

export const TOOLTIP_FALLBACKS: Record<string, string> = {
  period_start:
    '왜 기록해야 하나요?\n피부는 생리 주기에 따라 매주 달라져요.\n기록하면 AURAN이 오늘 딱 맞는 케어를 알려드려요 💜',
  hormone_phase: '호르몬 단계 설명',
  checkin: '체크인 안내',
  golden_period: '황금기란?',
  points: '포인트란?',
  grade: '등급 안내',
  routine_step: '루틴 단계 안내',
}
