'use client'

import { useEffect, useMemo, useState } from 'react'
import { calcHormoneBriefing } from '@/lib/hormoneUtils'
import { CALENDAR_SHEET_CONDITION_LABELS } from '@/lib/calendarConstants'
import type { SupabaseClient } from '@supabase/supabase-js'

const getSeoulToday = () => {
  const s = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return s
}

/** 서버·클라이언트 첫 페인트를 맞춰 getSeoulToday() 기반 렌더로 인한 hydration mismatch를 막음 */
const HYDRATION_PLACEHOLDER_SEOUL = new Date('2026-01-01T12:00:00+09:00')

/** 로컬 TZ와 무관하게 Asia/Seoul 기준 연·월(0~11)·일 */
function seoulYmdFromDate(d: Date): { y: number; m0: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  let y = 2026
  let m0 = 0
  let day = 1
  for (const p of parts) {
    if (p.type === 'year') y = Number(p.value)
    if (p.type === 'month') m0 = Number(p.value) - 1
    if (p.type === 'day') day = Number(p.value)
  }
  return { y, m0, d: day }
}

/** seoulClient 없는 첫 페인트에서는 Intl을 쓰지 않아 서버·브라우저 ICU 차이로 인한 hydration mismatch 방지 */
function seoulYmdForHydrationSafeCalendar(seoulClient: Date | null): { y: number; m0: number; d: number } {
  if (seoulClient == null) return { y: 2026, m0: 0, d: 1 }
  return seoulYmdFromDate(seoulClient)
}

/** 해당 서울 달력일 정오(+09:00) 시각의 UTC ms — 요일·일수 계산을 TZ 일치시키기 위함 */
function seoulNoonUtcMs(y: number, m0: number, day: number): number {
  return Date.parse(`${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+09:00`)
}

const GOLD = '#C9A96E'
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export type CalendarSectionProps = {
  supabase: SupabaseClient
  myUserId: string
  hormoneCycle: any
  hormoneTrack: string
  skinRecList: any[]
  cycleType: string | null
}

export default function CalendarSection({
  supabase,
  myUserId,
  hormoneCycle,
  hormoneTrack,
  skinRecList,
  cycleType,
}: CalendarSectionProps) {
  const [monthCycleRows, setMonthCycleRows] = useState<any[]>([])
  const [calendarPickDate, setCalendarPickDate] = useState('')
  const [skinCalTab, setSkinCalTab] = useState<'TODAY' | 'MONTHLY' | 'YEARLY'>('TODAY')
  const [skinCalYM, setSkinCalYM] = useState({ y: 2026, m: 3 })
  const [seoulClient, setSeoulClient] = useState<Date | null>(null)
  const [magicCalendarMounted, setMagicCalendarMounted] = useState(false)
  const [skinDailyRows, setSkinDailyRows] = useState<any[]>([])
  const [calSheetOpen, setCalSheetOpen] = useState(false)
  const [calSheetIso, setCalSheetIso] = useState('')
  const [calSheetNote, setCalSheetNote] = useState('')
  const [calSheetRoutine, setCalSheetRoutine] = useState(false)
  const [calSheetConditionStr, setCalSheetConditionStr] = useState('')
  const [calSheetConditionPick, setCalSheetConditionPick] = useState<string[]>([])
  const [periodTipOpen, setPeriodTipOpen] = useState(false)
  const [profileCreatedAt, setProfileCreatedAt] = useState<string | null>(null)
  const [calToast, setCalToast] = useState('')

  useEffect(() => {
    const s = getSeoulToday()
    setSeoulClient(s)
    const ymd = seoulYmdFromDate(s)
    setSkinCalYM({ y: ymd.y, m: ymd.m0 })
    setMagicCalendarMounted(true)
  }, [])

  useEffect(() => {
    if (!myUserId) {
      setProfileCreatedAt(null)
      return
    }
    void supabase
      .from('profiles')
      .select('created_at')
      .eq('auth_id', myUserId)
      .maybeSingle()
      .then(({ data }) => {
        setProfileCreatedAt(data?.created_at != null ? String((data as any).created_at) : null)
      })
  }, [myUserId])

  useEffect(() => {
    if (!myUserId) {
      setMonthCycleRows([])
      setSkinDailyRows([])
      setCalendarPickDate('')
      setCalSheetOpen(false)
      return
    }
    const run = async () => {
      const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
      const maxY = seoul.getFullYear() + 1
      const minY = profileCreatedAt ? new Date(profileCreatedAt).getFullYear() : seoul.getFullYear()
      const yearStart = `${minY}-01-01`
      const yearEnd = `${maxY}-12-31`
      const { data } = await supabase
        .from('skin_cycle_analysis')
        .select('record_date,hormone_stage,checkin_condition')
        .eq('auth_id', myUserId)
        .gte('record_date', yearStart)
        .lte('record_date', yearEnd)
        .order('record_date', { ascending: true })
      setMonthCycleRows(data || [])
      const { data: dailyD } = await supabase
        .from('skin_cycle_daily')
        .select('record_date,note,routine_completed')
        .eq('auth_id', myUserId)
        .gte('record_date', yearStart)
        .lte('record_date', yearEnd)
      setSkinDailyRows(dailyD || [])
      const todayIso = `${seoul.getFullYear()}-${String(seoul.getMonth() + 1).padStart(2, '0')}-${String(seoul.getDate()).padStart(2, '0')}`
      setCalendarPickDate(todayIso)
    }
    void run()
  }, [myUserId, profileCreatedAt])

  useEffect(() => {
    if (!myUserId) setCalSheetOpen(false)
  }, [myUserId])

  useEffect(() => {
    if (!calToast) return
    const t = setTimeout(() => setCalToast(''), 2400)
    return () => clearTimeout(t)
  }, [calToast])

  useEffect(() => {
    if (!calSheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [calSheetOpen])

  const seoulForRender = seoulClient ?? HYDRATION_PLACEHOLDER_SEOUL

  const hiddenCalendarTracks = ['menopause_post', 'male', 'male_menopause']
  const homeCalendarKind =
    cycleType === 'menopause'
      ? 'menopause'
      : cycleType === 'pregnancy' || cycleType === 'postpartum'
        ? 'pregnancy'
        : 'menstrual'
  const showSkinCalendar =
    cycleType === 'male'
      ? false
      : cycleType === 'menopause' || cycleType === 'pregnancy' || cycleType === 'postpartum'
        ? true
        : !hiddenCalendarTracks.includes(String(hormoneTrack || ''))
  const calendarTitleStr =
    homeCalendarKind === 'menopause'
      ? '🌸 호르몬 캘린더'
      : homeCalendarKind === 'pregnancy'
        ? '🤰 임신 캘린더'
        : '🔮 마법 캘린더'
  const calendarTipText =
    homeCalendarKind === 'menopause'
      ? `💜 폐경 후에도 호르몬 변화로
피부가 매일 달라져요.
매일 컨디션을 기록하면
AURAN이 내 피부 패턴을
파악해드려요 🌸`
      : homeCalendarKind === 'pregnancy'
        ? `💜 임신·출산 후 피부는
호르몬 변화로 빠르게 달라져요.
매일 기록하면 안전한 성분의
제품을 먼저 추천해드려요 🤰`
        : `💜 마법(생리) 기록은 캘린더에서 해요

📍 기록하는 방법
날짜를 클릭하면 생리 시작·끝을
직접 기록할 수 있어요.
예정일보다 빨리 시작했거나
늦어지는 경우에도 캘린더에서
원하는 날짜를 눌러 기록하면 돼요 🔮

✨ 왜 기록해야 하나요?
생리 주기에 따라 피부가 매주 달라져요.
기록이 쌓일수록 AURAN이 내 피부 패턴을
정확하게 파악해서 딱 맞는 케어를
먼저 알려드려요.
내 피부를 가장 잘 아는 앱이 되는 비결이에요 💜`
  const hasHormoneCycleData = Boolean(
    hormoneCycle &&
      ((hormoneCycle as any).track ||
        (hormoneCycle as any).last_period_date ||
        (hormoneCycle as any).cycle_length ||
        (hormoneCycle as any).due_date ||
        (hormoneCycle as any).delivery_date)
  )
  const isPeriTrack = hormoneTrack === 'menopause_peri'
  const isPregnancyTrack = hormoneTrack === 'pregnant' || hormoneTrack === 'postpartum'
  const calPhaseNeutral = isPeriTrack || homeCalendarKind !== 'menstrual'
  const hasCycleBase = Boolean(hormoneCycle?.last_period_date)
  const cycleRowByDate = useMemo(() => {
    const m: Record<string, any> = {}
    ;(monthCycleRows || []).forEach((r: any) => {
      const k = String(r.record_date || '')
      if (k) m[k] = r
    })
    return m
  }, [monthCycleRows])
  const skinDailyByDate = useMemo(() => {
    const m: Record<string, any> = {}
    ;(skinDailyRows || []).forEach((r: any) => {
      const k = String(r.record_date || '')
      if (k) m[k] = r
    })
    return m
  }, [skinDailyRows])
  const calendarDataBounds = useMemo(() => {
    const { y: seoulY } = seoulYmdForHydrationSafeCalendar(seoulClient)
    const maxY = seoulY + 1
    const minY = profileCreatedAt ? new Date(profileCreatedAt).getFullYear() : seoulY
    const suY = profileCreatedAt ? new Date(profileCreatedAt).getFullYear() : minY
    const suM0 = profileCreatedAt ? new Date(profileCreatedAt).getMonth() : 0
    return {
      minY,
      maxY,
      yearStart: `${minY}-01-01`,
      yearEnd: `${maxY}-12-31`,
      signupYear: suY,
      signupMonth0: suM0,
    }
  }, [profileCreatedAt, seoulClient])
  const periodPinkSet = useMemo(() => {
    const pink = new Set<string>()
    if (homeCalendarKind !== 'menstrual' || isPregnancyTrack) return pink
    const seoulCap = seoulYmdForHydrationSafeCalendar(seoulClient)
    const todayIsoCap = `${seoulCap.y}-${String(seoulCap.m0 + 1).padStart(2, '0')}-${String(seoulCap.d).padStart(2, '0')}`
    const L = String(hormoneCycle?.last_period_date || hormoneCycle?.period_started_at || '').trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(L)) return pink
    let endStr = String(hormoneCycle?.period_end_date || '').trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
      const se = seoulYmdForHydrationSafeCalendar(seoulClient)
      endStr = `${se.y}-${String(se.m0 + 1).padStart(2, '0')}-${String(se.d).padStart(2, '0')}`
    }
    if (endStr < L) return pink
    const walk = new Date(L + 'T12:00:00')
    const endTime = new Date(endStr + 'T12:00:00').getTime()
    while (walk.getTime() <= endTime) {
      const isoStr = `${walk.getFullYear()}-${String(walk.getMonth() + 1).padStart(2, '0')}-${String(walk.getDate()).padStart(2, '0')}`
      if (isoStr <= todayIsoCap) pink.add(isoStr)
      walk.setDate(walk.getDate() + 1)
    }
    return pink
  }, [homeCalendarKind, isPregnancyTrack, hormoneCycle, seoulClient])
  const yearNavDailyCounts = useMemo(() => {
    const y = skinCalYM.y
    const out: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
      10: 0,
      11: 0,
    }
    ;(skinDailyRows || []).forEach((r: any) => {
      const rd = String(r.record_date || '')
      if (rd.length < 8) return
      if (!rd.startsWith(`${y}-`)) return
      const m = Number(rd.slice(5, 7)) - 1
      if (m >= 0 && m < 12) out[m] = (out[m] || 0) + 1
    })
    return out
  }, [skinDailyRows, skinCalYM.y])
  const monthlyHasAnyRecord = useMemo(() => {
    const y = skinCalYM.y
    const m = skinCalYM.m
    const pref = `${y}-${String(m + 1).padStart(2, '0')}-`
    const hasA = (monthCycleRows || []).some((r: any) => String(r.record_date || '').startsWith(pref))
    const hasD = (skinDailyRows || []).some((r: any) => String(r.record_date || '').startsWith(pref))
    return hasA || hasD
  }, [skinCalYM.y, skinCalYM.m, monthCycleRows, skinDailyRows])
  const monthCalendarDays = useMemo(() => {
    if (skinCalTab !== 'TODAY') return [] as { iso: string; day: number; isToday: boolean; stripOff: number }[]
    const { y: sy, m0: sm, d: sd } = seoulYmdForHydrationSafeCalendar(seoulClient)
    const todayIso = `${sy}-${String(sm + 1).padStart(2, '0')}-${String(sd).padStart(2, '0')}`
    const baseMs = seoulNoonUtcMs(sy, sm, sd)
    const out: { iso: string; day: number; isToday: boolean; stripOff: number }[] = []
    for (let off = -3; off <= 3; off++) {
      const { y, m0, d } = seoulYmdFromDate(new Date(baseMs + off * 86400000))
      const iso = `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      out.push({ iso, day: d, isToday: iso === todayIso, stripOff: off })
    }
    return out
  }, [skinCalTab, skinCalYM.y, skinCalYM.m, seoulClient])
  const selectedCalendarDate = useMemo(() => {
    if (calendarPickDate) return calendarPickDate
    const { y, m0, d } = seoulYmdForHydrationSafeCalendar(seoulClient)
    return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }, [calendarPickDate, seoulClient])
  const skinCalTitleEn = useMemo(() => {
    if (skinCalTab === 'TODAY') {
      const { y, m0 } = seoulYmdForHydrationSafeCalendar(seoulClient)
      return `${MONTHS[m0]} ${y}`
    }
    if (skinCalTab === 'YEARLY') return `${skinCalYM.y}`
    return `${MONTHS[skinCalYM.m]} ${skinCalYM.y}`
  }, [skinCalTab, skinCalYM.y, skinCalYM.m, seoulClient])
  const monthlyGridSlots = useMemo(() => {
    if (skinCalTab !== 'MONTHLY') return [] as ({ iso: string; day: number } | null)[]
    const y = skinCalYM.y
    const m = skinCalYM.m
    const firstDow = new Date(seoulNoonUtcMs(y, m, 1)).getUTCDay()
    const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const slots: ({ iso: string; day: number } | null)[] = []
    for (let i = 0; i < firstDow; i++) slots.push(null)
    for (let d = 1; d <= count; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      slots.push({ iso, day: d })
    }
    while (slots.length < 42) slots.push(null)
    slots.length = 42
    return slots
  }, [skinCalTab, skinCalYM.y, skinCalYM.m])
  const selectedCycleRow = cycleRowByDate[selectedCalendarDate]
  const phaseColor = (phase: string) => {
    if (phase === '생리기') return '#D04558'
    if (phase === '여포기') return '#C9A96E'
    if (phase === '배란기') return '#D8C64E'
    return '#7B5EA7'
  }
  const phaseGuide = (phase: string) => {
    if (phase === '생리기') return '생리기 - 진정/장벽 케어 중심으로 쉬어가요'
    if (phase === '여포기') return '황금기 - 미백앰플 집중투입 타이밍'
    if (phase === '배란기') return '배란기 - 유분 밸런스와 모공 케어 집중'
    return '황체기 - 진정/보습으로 컨디션 기복 완충'
  }
  const getPhaseByDate = (iso: string) => {
    const d = new Date(`${iso}T12:00:00+09:00`)
    const c = calcHormoneBriefing({ ...(hormoneCycle || {}), track: 'general' }, d)
    return String(c.phase || '황체기')
  }
  const pregnancyWeekText = useMemo(() => {
    const nowMs = seoulForRender.getTime()
    const baseDayMs = (raw: unknown) => {
      const bStr = String(raw ?? '').trim().slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(bStr)) return Date.parse(`${bStr}T12:00:00+09:00`)
      const t = new Date(raw as string).getTime()
      return Number.isFinite(t) ? t : 0
    }
    if (hormoneTrack === 'pregnant') {
      const base = hormoneCycle?.pregnancy_start_date || hormoneCycle?.last_period_date
      if (!base) return '임신 주차를 입력하면 주차가 표시돼요'
      const diff = Math.max(0, Math.floor((nowMs - baseDayMs(base)) / 86400000))
      return `임신 ${Math.floor(diff / 7) + 1}주차`
    }
    if (hormoneTrack === 'postpartum') {
      const base = hormoneCycle?.delivery_date
      if (!base) return '출산일을 입력하면 주차가 표시돼요'
      const diff = Math.max(0, Math.floor((nowMs - baseDayMs(base)) / 86400000))
      return `출산 후 ${Math.floor(diff / 7) + 1}주차`
    }
    return ''
  }, [hormoneTrack, hormoneCycle, seoulClient])

  return (
    <>
      {showSkinCalendar && magicCalendarMounted ? (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.78)' }}>{calendarTitleStr}</div>
                <button
                  type="button"
                  onClick={() => setPeriodTipOpen(o => !o)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: 'rgba(123,94,167,0.3)',
                    border: '1px solid rgba(123,94,167,0.5)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 10,
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}
                >
                  ?
                </button>
              </div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>{skinCalTitleEn}</div>
            </div>
            {periodTipOpen ? (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(123,94,167,0.1)',
                  border: '1px solid rgba(123,94,167,0.2)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginTop: 8,
                  lineHeight: 1.7,
                  fontWeight: 400,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {calendarTipText}
              </div>
            ) : null}
          </div>
          <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['TODAY', 'MONTHLY', 'YEARLY'] as const).map(tab => {
                  const on = skinCalTab === tab
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        if (tab === 'TODAY') {
                          const s = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
                          setSkinCalYM({ y: s.getFullYear(), m: s.getMonth() })
                        }
                        if (tab === 'YEARLY') {
                          setSkinCalYM(p => ({
                            ...p,
                            y: Math.min(Math.max(p.y, calendarDataBounds.minY), calendarDataBounds.maxY),
                          }))
                        }
                        setSkinCalTab(tab)
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        borderRadius: 8,
                        border: 'none',
                        background: on ? '#7B5EA7' : 'transparent',
                        color: on ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        fontWeight: 400,
                        cursor: 'pointer',
                      }}
                    >
                      {tab}
                    </button>
                  )
                })}
              </div>
              {skinCalTab === 'TODAY' ? (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', alignItems: 'center' }}>
                  {monthCalendarDays.map((d) => {
                    const row = cycleRowByDate[d.iso]
                    const phase = calPhaseNeutral ? '' : getPhaseByDate(d.iso)
                    const baseBg = calPhaseNeutral ? 'rgba(255,255,255,0.03)' : phaseColor(phase)
                    const hasCheckin = Boolean(row?.checkin_condition)
                    const inPeriodPink = periodPinkSet.has(d.iso)
                    const absOff = Math.abs(d.stripOff)
                    const sc = absOff === 0 ? 1 : absOff === 1 ? 0.88 : absOff === 2 ? 0.78 : 0.68
                    const bg = d.isToday
                      ? 'rgba(123,94,167,0.4)'
                      : inPeriodPink
                        ? 'rgba(224,120,152,0.25)'
                        : baseBg
                    const todayMinW = d.isToday ? 56 : 42
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => {
                          const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
                          const todayIso = `${seoul.getFullYear()}-${String(seoul.getMonth() + 1).padStart(2, '0')}-${String(seoul.getDate()).padStart(2, '0')}`
                          if (d.iso > todayIso) {
                            setCalToast('아직 오지 않은 날이에요 💜')
                            return
                          }
                          setCalendarPickDate(d.iso)
                          setCalSheetIso(d.iso)
                          const cr = cycleRowByDate[d.iso]
                          const rawC = String(cr?.checkin_condition || '').trim()
                          setCalSheetConditionStr(rawC)
                          const pcs = rawC ? rawC.split(' / ').map(s => s.trim()).filter(Boolean) : []
                          setCalSheetConditionPick(pcs.filter(s => CALENDAR_SHEET_CONDITION_LABELS.includes(s)))
                          const dr = skinDailyByDate[d.iso]
                          setCalSheetNote(String(dr?.note || ''))
                          setCalSheetRoutine(!!dr?.routine_completed)
                          setCalSheetOpen(true)
                        }}
                        style={{
                          minWidth: todayMinW,
                          borderRadius: 10,
                          border: d.isToday
                            ? '1px solid #7B5EA7'
                            : hasCheckin
                              ? '1px solid rgba(201,169,110,0.55)'
                              : '1px solid rgba(255,255,255,0.12)',
                          background: bg,
                          color: d.isToday ? '#fff' : inPeriodPink ? '#e07898' : '#fff',
                          padding: d.isToday ? '10px 0 8px' : '7px 0 6px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          opacity: calPhaseNeutral && !hasCheckin && !d.isToday ? 0.45 : 1,
                          transform: `scale(${sc})`,
                          transition: 'transform 0.2s ease',
                          boxSizing: 'border-box',
                          pointerEvents: 'auto',
                        }}
                      >
                        {d.isToday ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: 44,
                              width: '100%',
                            }}
                          >
                            <span style={{ fontSize: 24, lineHeight: 1 }}>⭐</span>
                            <span style={{ fontSize: 9, fontWeight: 400, marginTop: 2 }}>오늘</span>
                          </span>
                        ) : (
                                <div style={{ fontSize: 10, opacity: inPeriodPink ? 1 : 0.85 }}>{d.day}</div>
                              )}
                            </button>
                          )
                        })}
                </div>
              ) : null}
              {false && skinCalTab === 'MONTHLY' ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                  }}
                >
                  {monthlyGridSlots.map((slot, si) => {
                    if (!slot) {
                      return <div key={`e-${si}`} style={{ minHeight: 44 }} />
                    }
                    const { iso, day } = slot
                    const row = cycleRowByDate[iso]
                    const phase = calPhaseNeutral ? '' : getPhaseByDate(iso)
                    const inPeriodPink = periodPinkSet.has(iso)
                    const hormoneBgBase = calPhaseNeutral
                      ? 'rgba(255,255,255,0.04)'
                      : phase === '여포기'
                        ? 'rgba(201,169,110,0.28)'
                        : phase === '생리기' || phase === '황체기'
                          ? 'rgba(168,130,220,0.22)'
                          : phase === '배란기'
                            ? 'rgba(216,198,78,0.16)'
                            : 'rgba(255,255,255,0.04)'
                    const hormoneBg = inPeriodPink ? 'rgba(224,120,152,0.25)' : hormoneBgBase
                    const cc = String(row?.checkin_condition || '')
                    const dotC = !row?.checkin_condition
                      ? 'rgba(255,255,255,0.25)'
                      : cc.includes('열감')
                        ? '#e05555'
                        : cc.includes('건조')
                          ? '#6ab0e0'
                          : cc.includes('트러블')
                            ? '#E8945C'
                            : cc.includes('좋음')
                              ? '#5cb88a'
                              : 'rgba(255,255,255,0.25)'
                    const periodMark = homeCalendarKind === 'menstrual' && !isPeriTrack && !isPregnancyTrack && phase === '생리기'
                    const sel = calendarPickDate === iso
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => {
                          const seoul = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
                          const todayIso = `${seoul.getFullYear()}-${String(seoul.getMonth() + 1).padStart(2, '0')}-${String(seoul.getDate()).padStart(2, '0')}`
                          if (iso > todayIso) {
                            setCalToast('아직 오지 않은 날이에요 💜')
                            return
                          }
                          setCalendarPickDate(iso)
                          setCalSheetIso(iso)
                          const cr = cycleRowByDate[iso]
                          const rawC = String(cr?.checkin_condition || '').trim()
                          setCalSheetConditionStr(rawC)
                          const pcs = rawC ? rawC.split(' / ').map(s => s.trim()).filter(Boolean) : []
                          setCalSheetConditionPick(pcs.filter(s => CALENDAR_SHEET_CONDITION_LABELS.includes(s)))
                          const dr = skinDailyByDate[iso]
                          setCalSheetNote(String(dr?.note || ''))
                          setCalSheetRoutine(!!dr?.routine_completed)
                          setCalSheetOpen(true)
                        }}
                        style={{
                          minHeight: 44,
                          borderRadius: 8,
                          border: sel ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)',
                          background: hormoneBg,
                          color: inPeriodPink ? '#e07898' : '#fff',
                          padding: '4px 2px 5px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: 2,
                        }}
                      >
                        <div style={{ fontSize: 9, opacity: 0.9 }}>{day}</div>
                        {periodMark && !inPeriodPink ? <span style={{ fontSize: 8, lineHeight: 1 }}>💜</span> : <span style={{ fontSize: 8, height: 10 }} />}
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: dotC,
                            marginTop: 1,
                          }}
                        />
                      </button>
                    )
                  })}
                </div>
              ) : null}
              {false && skinCalTab === 'MONTHLY' && !monthlyHasAnyRecord ? (
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    textAlign: 'center',
                    marginTop: 10,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {`📅 날짜를 클릭해서 오늘 피부를 기록해보세요\n기록이 쌓일수록 내 피부 패턴이 보여요 💜`}
                </div>
              ) : null}
              {false && skinCalTab === 'YEARLY' ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 14,
                      marginBottom: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSkinCalYM(p => ({ ...p, y: Math.max(calendarDataBounds.minY, p.y - 1) }))
                      }
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.75)',
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      &lt;
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.88)', minWidth: 52, textAlign: 'center' }}>
                      {skinCalYM.y}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSkinCalYM(p => ({ ...p, y: Math.min(calendarDataBounds.maxY, p.y + 1) }))
                      }
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.75)',
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      &gt;
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {(() => {
                      const { y: cY, m0: cM } = seoulYmdForHydrationSafeCalendar(seoulClient)
                      return MONTHS.map((ml, mi) => {
                        if (skinCalYM.y === calendarDataBounds.signupYear && mi < calendarDataBounds.signupMonth0) {
                          return <div key={ml} style={{ minHeight: 40 }} />
                        }
                        const isFuture = skinCalYM.y > cY || (skinCalYM.y === cY && mi > cM)
                        const cnt = yearNavDailyCounts[mi] || 0
                        if (isFuture) {
                          return (
                            <button
                              key={ml}
                              type="button"
                              className="home-cal-yearly-month-btn"
                              onClick={e => {
                                e.preventDefault()
                                e.stopPropagation()
                                setCalToast('아직 오지 않은 날들이에요 💜')
                              }}
                              style={{
                                padding: '12px 6px',
                                borderRadius: 10,
                                border: '1px dashed rgba(255,255,255,0.15)',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: 10,
                                fontFamily: 'monospace',
                                fontWeight: 400,
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: 9 }}>✨</span>
                            </button>
                          )
                        }
                        const hasRec = cnt > 0
                        let boxShadow = '0 0 14px rgba(123,94,167,0.5), inset 0 0 8px rgba(123,94,167,0.2)'
                        let borderSt = '1px solid rgba(123,94,167,0.8)'
                        let monthColor = '#e8d9ff'
                        let bgM = 'rgba(123,94,167,0.35)'
                        if (hasRec) {
                          if (cnt >= 16) {
                            boxShadow = '0 0 22px rgba(123,94,167,0.7), inset 0 0 8px rgba(123,94,167,0.2)'
                            borderSt = '1px solid #a855f7'
                          } else if (cnt >= 6) {
                            boxShadow = '0 0 14px rgba(123,94,167,0.5), inset 0 0 8px rgba(123,94,167,0.2)'
                          } else {
                            boxShadow = '0 0 8px rgba(123,94,167,0.3), inset 0 0 8px rgba(123,94,167,0.2)'
                          }
                        } else {
                          bgM = 'rgba(255,255,255,0.03)'
                          borderSt = '1px solid rgba(255,255,255,0.08)'
                          monthColor = 'rgba(255,255,255,0.25)'
                          boxShadow = 'none'
                        }
                        return (
                          <button
                            key={ml}
                            type="button"
                            className="home-cal-yearly-month-btn"
                            onClick={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              setSkinCalYM({ y: skinCalYM.y, m: mi })
                              if (false) setSkinCalTab('MONTHLY')
                            }}
                            style={{
                              padding: '12px 6px',
                              borderRadius: 10,
                              border: borderSt,
                              background: bgM,
                              boxShadow,
                              color: monthColor,
                              fontSize: 10,
                              fontFamily: 'monospace',
                              fontWeight: 400,
                              cursor: 'pointer',
                            }}
                          >
                            {ml}
                          </button>
                        )
                      })
                    })()}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.35)',
                      textAlign: 'center',
                      marginTop: 10,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {`✨ 기록한 달이 빛나요\n꾸준히 기록할수록 더 밝아져요 💜`}
                  </div>
                </>
              ) : null}
              {(false && skinCalTab === 'MONTHLY') || (false && skinCalTab === 'YEARLY') ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '6px 10px',
                    marginTop: 10,
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>💜</span>
                    <span>생리기</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#C9A96E' }} />
                    <span>황금기</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(168,130,220,0.9)' }} />
                    <span>민감기</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#e05555' }} />
                    <span>열감</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6ab0e0' }} />
                    <span>건조</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: '#E8945C' }} />
                    <span>트러블</span>
                  </span>
                </div>
              ) : null}
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.82)' }}>
                {homeCalendarKind === 'pregnancy' || isPregnancyTrack
                  ? `${pregnancyWeekText || '임신·출산 케어'} - 순한 성분 중심 케어를 추천해요`
                  : homeCalendarKind === 'menopause' || isPeriTrack
                    ? (selectedCycleRow?.checkin_condition
                      ? `체크인 기록 - ${String(selectedCycleRow.checkin_condition)}`
                      : '선택한 날짜에 체크인 기록이 없어요')
                    : `${getPhaseByDate(selectedCalendarDate)} - ${phaseGuide(getPhaseByDate(selectedCalendarDate)).split(' - ')[1]}`}
              </div>
          </>
        </div>
      ) : null}
      {calSheetOpen ? (
        <>
          <div
            onClick={() => setCalSheetOpen(false)}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.preventDefault()}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 160 }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxWidth: 390,
              margin: '0 auto',
              zIndex: 180,
              background: '#141018',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: '16px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#fff' }}>{calSheetIso}</div>
              <button
                type="button"
                onClick={() => setCalSheetOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: 16,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {CALENDAR_SHEET_CONDITION_LABELS.map(label => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setCalSheetConditionPick(prev =>
                      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
                    )
                  }
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: 'none',
                    cursor: 'pointer',
                    background: calSheetConditionPick.includes(label) ? '#7B5EA7' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 11,
                    pointerEvents: 'auto',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={async () => {
                  const { data: u } = await supabase.auth.getUser()
                  const uid = u.user?.id
                  if (!uid) {
                    setCalToast('로그인 후 이용해 주세요')
                    return
                  }
                  const cycleLen = Math.max(21, Math.min(60, Number(hormoneCycle?.cycle_length || 28)))
                  const baseP = new Date(`${calSheetIso}T12:00:00+09:00`)
                  const next = new Date(baseP)
                  next.setDate(baseP.getDate() + cycleLen)
                  const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
                  const { error } = await supabase.from('hormone_cycle').upsert(
                    {
                      ...(hormoneCycle || {}),
                      auth_id: uid,
                      track: hormoneTrack,
                      last_period_date: calSheetIso,
                      period_started_at: calSheetIso,
                      expected_period_date: nextIso,
                      cycle_length: cycleLen,
                      updated_at: new Date().toISOString(),
                    } as any,
                    { onConflict: 'auth_id' }
                  )
                  if (error) {
                    setCalToast('생리 시작 저장에 실패했어요')
                    return
                  }
                  setCalToast('생리 시작일을 반영했어요')
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.4)',
                  background: 'rgba(123,94,167,0.2)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                생리 시작
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { data: u } = await supabase.auth.getUser()
                  const uid = u.user?.id
                  if (!uid) {
                    setCalToast('로그인 후 이용해 주세요')
                    return
                  }
                  const { error } = await supabase
                    .from('hormone_cycle')
                    .update({ period_end_date: calSheetIso, updated_at: new Date().toISOString() } as any)
                    .eq('auth_id', uid)
                  if (error) {
                    setCalToast(
                      '생리 끝 저장 실패: hormone_cycle에 period_end_date 컬럼이 없을 수 있어요. Supabase SQL: ALTER TABLE public.hormone_cycle ADD COLUMN IF NOT EXISTS period_end_date date;'
                    )
                    return
                  }
                  setCalToast('생리 종료일을 저장했어요')
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.4)',
                  background: 'rgba(123,94,167,0.2)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                생리 끝
              </button>
            </div>
            <input
              value={calSheetNote}
              onChange={e => setCalSheetNote(e.target.value)}
              placeholder="오늘 피부 한마디..."
              maxLength={200}
              style={{
                width: '100%',
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={async () => {
                const { data: auth } = await supabase.auth.getUser()
                const uid = auth.user?.id || myUserId
                if (!uid) {
                  setCalToast('로그인 후 이용해 주세요')
                  return
                }
                const calc = calcHormoneBriefing(
                  { ...(hormoneCycle || {}), track: hormoneTrack },
                  new Date(`${calSheetIso}T12:00:00+09:00`)
                )
                const ids = skinRecList.slice(0, 16).map((p: any) => String(p.id)).filter(Boolean)
                const condJoined = calSheetConditionPick.join(' / ')
                const { error: aErr } = await supabase.from('skin_cycle_analysis').upsert(
                  {
                    auth_id: uid,
                    record_date: calSheetIso,
                    cycle_day: calc.cycleDay,
                    hormone_stage: calc.phase,
                    checkin_condition: condJoined,
                    recommended_products: ids,
                    updated_at: new Date().toISOString(),
                  } as any,
                  { onConflict: 'auth_id,record_date' }
                )
                if (aErr) {
                  console.error('[calendar save] skin_cycle_analysis', aErr)
                  setCalToast('기록 저장에 실패했어요')
                  return
                }
                const { error: dErr } = await supabase.from('skin_cycle_daily').upsert(
                  {
                    auth_id: uid,
                    record_date: calSheetIso,
                    note: calSheetNote.trim() || null,
                    routine_completed: calSheetRoutine,
                    updated_at: new Date().toISOString(),
                  } as any,
                  { onConflict: 'auth_id,record_date' }
                )
                if (dErr) {
                  console.error('[calendar save] skin_cycle_daily', dErr)
                  setCalToast(
                    'skin_cycle_daily 저장 실패: 테이블·컬럼을 확인하세요. 예) CREATE TABLE public.skin_cycle_daily (auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, record_date date NOT NULL, note text, routine_completed boolean DEFAULT false, updated_at timestamptz DEFAULT now(), PRIMARY KEY (auth_id, record_date));'
                  )
                  return
                }
                const { data: ar } = await supabase
                  .from('skin_cycle_analysis')
                  .select('record_date,hormone_stage,checkin_condition')
                  .eq('auth_id', uid)
                  .gte('record_date', calendarDataBounds.yearStart)
                  .lte('record_date', calendarDataBounds.yearEnd)
                  .order('record_date', { ascending: true })
                setMonthCycleRows(ar || [])
                const { data: dr } = await supabase
                  .from('skin_cycle_daily')
                  .select('record_date,note,routine_completed')
                  .eq('auth_id', uid)
                  .gte('record_date', calendarDataBounds.yearStart)
                  .lte('record_date', calendarDataBounds.yearEnd)
                setSkinDailyRows(dr || [])
                setCalSheetConditionStr(condJoined)
                setCalToast('저장했어요')
                setCalSheetOpen(false)
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: 'none',
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
            >
              저장
            </button>
            </div>
          </div>
        </>
      ) : null}

      {calToast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 100,
            transform: 'translateX(-50%)',
            zIndex: 300,
            background: 'rgba(20,16,24,0.95)',
            border: '1px solid rgba(123,94,167,0.4)',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 12,
            color: '#fff',
            maxWidth: 320,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {calToast}
        </div>
      ) : null}
    </>
  )
}
