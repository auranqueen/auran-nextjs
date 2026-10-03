'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HormoneSheet from '@/components/home/HormoneSheet'
import RhythmFix from '@/components/home/RhythmFix'
import {
  HormoneCalendarRecordModal,
  HormoneCalendarRecordToast,
  useHormoneCalendarRecord,
} from '@/components/home/HormoneCalendarRecord'
import { calcHormoneBriefing, isPeriodTrack } from '@/lib/hormoneUtils'

const BG = '#0D0B09'
const P = '#7B5EA7'

const PHASE_COLORS: Record<string, string> = {
  '달빛기': '#c4a8ff',
  '황금기': '#f0c060',
  '만개기': '#e87b9b',
  '물들기': '#d4904a',
  '불규칙기': '#5adb8a',
  '폐경기': '#5adb8a',
  '갱년기': '#5adb8a',
  '남성': '#64a0dc',
  '남성 갱년기': '#64a0dc',
}

const TIMELINE_SEGMENTS = [
  { phase: '달빛기', ratio: 5 / 28, color: '#c4a8ff' },
  { phase: '황금기', ratio: 8 / 28, color: '#f0c060' },
  { phase: '만개기', ratio: 3 / 28, color: '#e87b9b' },
  { phase: '물들기', ratio: 12 / 28, color: '#d4904a' },
]

const PHASE_INFO: Record<string, { emoji: string; sub: string; desc: string; care: string[] }> = {
  달빛기: { emoji: '🌙', sub: '1~5일차 · 생리기 · 에스트로겐 최저', desc: '생리 시작부터 5일간. 호르몬이 가장 낮아 피부가 예민하고 붓기 쉬워요.', care: ['🚫 레티놀·AHA·BHA 잠시 쉬어요', '💧 세라마이드로 장벽 보호', '🛁 반신욕으로 순환 도움'] },
  황금기: { emoji: '🌱', sub: '6~13일차 · 여포기 · 에스트로겐 상승', desc: '에스트로겐이 올라가면서 피부가 가장 좋아지는 황금 시기! 콜라겐 생성도 활발해요.', care: ['✨ 미백·항산화 집중 케어 최적', '💎 레티놀·AHA 사용해도 좋아요', '🌟 새 시술 시작하기 좋은 타이밍'] },
  만개기: { emoji: '☀️', sub: '14~16일차 · 배란기', desc: '배란이 일어나는 시기. 피지 분비가 늘고 모공이 넓어 보일 수 있어요.', care: ['🧴 피지 조절 제품 사용', '🧖 모공 관리에 집중', '☀️ 자외선 차단 꼼꼼히'] },
  물들기: { emoji: '🍂', sub: '17~28일차 · 황체기 · 프로게스테론 상승', desc: '프로게스테론이 올라가면서 트러블 생기기 쉽고 예민해요. PMS 시기예요.', care: ['🚫 자극 성분 피하기', '💆 스트레스 관리 중요', '🌿 진정·보습에 집중'] },
}

const MALE_WEEKLY_CHECKLIST = [
  { label: '월 · 수 · 금', task: '세안 + 보습 루틴' },
  { label: '화 · 목', task: '선크림 + 립케어' },
  { label: '주 2회', task: '저자극 스크럽 · 각질 관리' },
  { label: '매일', task: '면도 후 진정 토너' },
]

function ModeBadge({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ margin: '12px 16px 0', display: 'flex', justifyContent: 'center' }}>
      <span style={{
        fontSize: 11,
        padding: '5px 12px',
        borderRadius: 999,
        background: `${color}22`,
        border: `1px solid ${color}66`,
        color,
      }}>
        {text}
      </span>
    </div>
  )
}

function phaseColor(phase: string): string {
  return PHASE_COLORS[phase] || P
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9998 }}
      />
      <div style={{
        position: 'fixed',
        left: '50%',
        bottom: 0,
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 390,
        maxHeight: '85vh',
        overflowY: 'auto',
        background: '#1e1830',
        borderRadius: '20px 20px 0 0',
        zIndex: 9999,
        padding: '16px 18px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#f3ecff' }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

export default function HormoneCalendarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [authId, setAuthId] = useState<string | null>(null)
  const [userName, setUserName] = useState('고객')
  const [hca, setHca] = useState<boolean | null>(null)
  const [cycleType, setCycleType] = useState('')
  const [hormoneCycle, setHormoneCycle] = useState<any>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [maleExercise, setMaleExercise] = useState('')
  const [maleFatigue, setMaleFatigue] = useState('')
  const [maleStress, setMaleStress] = useState('')
  const [maleSleep, setMaleSleep] = useState('')
  const [menoFlush, setMenoFlush] = useState('')
  const [menoSleep, setMenoSleep] = useState('')
  const [menoMood, setMenoMood] = useState('')
  const [menoJoint, setMenoJoint] = useState('')
  const today = new Date()
  const [viewYM, setViewYM] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [phasePopup, setPhasePopup] = useState<string | null>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    const sb = createClient()
    try {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer&redirect=/my/hormone')
        return
      }
      setAuthChecked(true)
      setAuthId(user.id)

      const [profileRes, hcRes] = await Promise.all([
        sb
          .from('profiles')
          .select('cycle_type, gender, hormone_cycle_applicable, birth_date, full_name')
          .eq('auth_id', user.id)
          .maybeSingle(),
        sb.from('hormone_cycle').select('*').eq('auth_id', user.id).maybeSingle(),
      ])

      const profile = profileRes.data
      if (profile) {
        const nm = String((profile as any).full_name || '').trim()
        if (nm) setUserName(nm)
        setCycleType(String((profile as any).cycle_type || ''))
        setHca(
          (profile as any).hormone_cycle_applicable === true ? true :
          (profile as any).hormone_cycle_applicable === false ? false :
          null,
        )
      } else {
        setHca(null)
        setCycleType('')
      }

      setHormoneCycle(hcRes.data ?? null)
    } catch {
      setHormoneCycle(null)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const calc = hormoneCycle ? calcHormoneBriefing(hormoneCycle) : null
  const currentPhase = !calc || (isPeriodTrack(String(hormoneCycle?.track || 'general')) && !hormoneCycle?.last_period_date) ? '' : calc.phase
  const cycleDay = calc?.cycleDay ?? 0
  const cycleLen = Math.max(21, Math.min(60, Number(hormoneCycle?.cycle_length || 28)))
  const hasCalendar = hormoneCycle != null && hca !== false && isPeriodTrack(String(hormoneCycle?.track || 'general'))

  const isPregnant = cycleType === 'pregnant'
  const isPostpartum = cycleType === 'postpartum'
  const isMale = cycleType === 'male'
  const isMenopause = cycleType === 'menopause'
  const isIrregular = cycleType === 'irregular'
  const showMenopauseCalendar = isMenopause && hormoneCycle != null && isPeriodTrack(String(hormoneCycle?.track || 'menopause_peri'))
  const calendarActive = hasCalendar || showMenopauseCalendar
  const recordActive = calendarActive || isPregnant || isPostpartum || isMale || isIrregular || isMenopause
  const showRhythmFix = isPostpartum || isIrregular || (!hasCalendar && !isPregnant && !isMale && !isMenopause)

  const sheetPhase = isMale ? '남성' : isMenopause ? '폐경기' : isPregnant ? '만개기' : currentPhase
  const cardPhase = isPregnant ? '만개기' : isMenopause ? '폐경기' : isMale ? '남성' : currentPhase
  const cardMainLine = isPregnant
    ? `${userName}님, 임신 케어 모드예요 🤱`
    : isPostpartum
      ? `${userName}님, 산후 회복 중이에요 💜`
      : isMale
        ? `${userName}님, 남성 케어 모드예요 💪`
        : isMenopause
          ? `${userName}님, 갱년기 케어 모드예요 🌸`
          : calc
            ? `${userName}님, 지금 ${calc.phase} 예요 🌿`
            : `${userName}님의 호르몬 달력`
  const cardSubLine = isPregnant
    ? '임신 중엔 미백 레이저·레티놀·살리실산은 피해주세요.'
    : isPostpartum
      ? '출산 후 호르몬이 회복 중이에요. 순한 케어로 시작해요.'
      : calc
        ? `오늘의 피부 이야기 · ${calc.focus}`
        : '주기를 입력하면 맞춤 케어가 시작돼요'

  const record = useHormoneCalendarRecord({
    authId,
    hormoneCycle,
    hasCalendar: recordActive,
    viewY: viewYM.y,
    viewM: viewYM.m,
  })

  useEffect(() => {
    if (isMale) setSheetOpen(true)
  }, [isMale])

  useEffect(() => {
    if (!record.recordOpen) return
    if (isMale) {
      setMaleExercise(record.recordPeriod)
      const parts = record.recordCondition.split(' / ').map((x) => x.trim())
      setMaleFatigue(parts[0] || '')
      setMaleStress(parts[1] || '')
      setMaleSleep(parts[2] || '')
    }
    if (isMenopause) {
      setMenoFlush(record.recordPeriod)
      const parts = record.recordCondition.split(' / ').map((x) => x.trim())
      setMenoSleep(parts[0] || '')
      setMenoMood(parts[1] || '')
      setMenoJoint(parts[2] || '')
    }
  }, [record.recordOpen, record.recordPeriod, record.recordCondition, isMale, isMenopause])

  const hormoneMainLine = cardMainLine
  const hormoneSubLine = cardSubLine

  const calendarDays = useMemo(() => {
    const now = new Date()
    const y = viewYM.y
    const m = viewYM.m
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const startPad = first.getDay()
    const days: { date: Date | null; isToday: boolean; phase: string; color: string }[] = []
    for (let i = 0; i < startPad; i++) days.push({ date: null, isToday: false, phase: '', color: 'transparent' })
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(y, m, d)
      const isToday = viewYM.y === now.getFullYear() && viewYM.m === now.getMonth() && d === now.getDate()
      if (hormoneCycle?.last_period_date && calendarActive) {
        const dayCalc = calcHormoneBriefing(hormoneCycle, date)
        days.push({ date, isToday, phase: dayCalc.phase, color: phaseColor(dayCalc.phase) })
      } else {
        days.push({ date, isToday, phase: '', color: 'rgba(255,255,255,0.06)' })
      }
    }
    return days
  }, [hormoneCycle, calendarActive, viewYM])

  const saveMaleRecord = () => {
    record.setRecordPeriod(maleExercise)
    record.setRecordCondition([maleFatigue, maleStress, maleSleep].filter(Boolean).join(' / '))
    setTimeout(() => { void record.saveRecord() }, 0)
  }

  const saveMenopauseRecord = () => {
    record.setRecordPeriod(menoFlush)
    record.setRecordCondition([menoSleep, menoMood, menoJoint].filter(Boolean).join(' / '))
    setTimeout(() => { void record.saveRecord() }, 0)
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: 6,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'inherit',
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, padding: 24, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  if (!authChecked) return null

  return (
    <div style={{
      minHeight: '100vh',
      maxWidth: 390,
      margin: '0 auto',
      background: BG,
      color: '#fff',
      fontFamily: "'Noto Sans KR', sans-serif",
      fontWeight: 300,
      paddingBottom: 32,
    }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 20, cursor: 'pointer', padding: 4 }}
        >
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>호르몬 달력</div>
        <div style={{ width: 28 }} />
      </div>

      {isPregnant ? (
        <ModeBadge text="임신 케어 모드 🤱" color="#e87b9b" />
      ) : isPostpartum ? (
        <ModeBadge text="산후 회복 모드 💜" color={P} />
      ) : isMale ? (
        <ModeBadge text="남성 케어 모드 💪" color="#64a0dc" />
      ) : isMenopause ? (
        <ModeBadge text="갱년기 케어 모드 🌸" color="#5adb8a" />
      ) : isIrregular ? (
        <ModeBadge text="불규칙 주기 모드" color="#c4a8ff" />
      ) : hasCalendar && currentPhase ? (
        <div style={{ margin: '12px 16px 0', display: 'flex', justifyContent: 'center' }}>
          <span style={{
            fontSize: 11,
            padding: '5px 12px',
            borderRadius: 999,
            background: `${phaseColor(currentPhase)}22`,
            border: `1px solid ${phaseColor(currentPhase)}66`,
            color: phaseColor(currentPhase),
          }}>
            {currentPhase}{cycleDay > 0 ? ` · ${cycleDay}일차` : ''}
          </span>
        </div>
      ) : null}

      {!currentPhase && hasCalendar && isPeriodTrack(String(hormoneCycle?.track || 'general')) && !isMenopause ? (
        <div style={{ margin: '8px 16px 0', fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          🌙 생리 시작일을 기록하면 내 시기가 보여요
        </div>
      ) : null}

      {hasCalendar && !isPregnant && !isPostpartum && !isMale && !isIrregular && !isMenopause ? (
        <div style={{ margin: '14px 16px 0' }}>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
            {TIMELINE_SEGMENTS.map((seg) => (
              <div key={seg.phase} onClick={() => setPhasePopup(seg.phase)} style={{ flex: seg.ratio, background: seg.color, opacity: seg.phase === currentPhase ? 1 : 0.45, cursor: 'pointer' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {TIMELINE_SEGMENTS.map((seg) => (
              <span key={seg.phase} onClick={() => setPhasePopup(seg.phase)} style={{ fontSize: 9, color: seg.phase === currentPhase ? seg.color : 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                {seg.phase}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!hasCalendar ? (
        <>
          {isPregnant ? (
            <div style={{ margin: '16px 16px 0', padding: '18px 16px', borderRadius: 14, background: 'rgba(232,123,155,0.1)', border: '0.5px solid rgba(232,123,155,0.35)' }}>
              <div style={{ fontSize: 14, color: '#f5dce6', lineHeight: 1.65, marginBottom: 12 }}>
                임신 중엔 미백 레이저·레티놀·살리실산은 피해주세요.
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#e87b9b', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                임신 케어 가이드 (만개기) 보기 →
              </button>
            </div>
          ) : null}

          {isPostpartum ? (
            <div style={{ margin: '16px 16px 0', padding: '18px 16px', borderRadius: 14, background: 'rgba(123,94,167,0.1)', border: '0.5px solid rgba(123,94,167,0.35)' }}>
              <div style={{ fontSize: 14, color: '#e8dff5', lineHeight: 1.65 }}>
                출산 후 호르몬이 회복 중이에요. 순한 케어로 시작해요.
              </div>
            </div>
          ) : null}

          {isMale ? (
            <div style={{ margin: '16px 16px 0', padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>주간 케어 체크리스트</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MALE_WEEKLY_CHECKLIST.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'rgba(100,160,220,0.08)',
                      border: '0.5px solid rgba(100,160,220,0.2)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#64a0dc', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{item.task}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isIrregular ? (
            <div style={{ margin: '16px 16px 0', padding: '18px 16px', borderRadius: 14, background: 'rgba(196,168,255,0.1)', border: '0.5px solid rgba(196,168,255,0.35)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                생리가 시작되면 기록해주세요. 오렌이 다시 리셋해드려요.
              </div>
            </div>
          ) : null}

          {!isPregnant && !isPostpartum && !isMale && !isIrregular && !isMenopause ? (
            <div style={{
              margin: '16px 16px 0',
              padding: '20px 16px',
              borderRadius: 14,
              background: 'rgba(123,94,167,0.08)',
              border: '0.5px dashed rgba(123,94,167,0.35)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🌙</div>
              <div style={{ fontSize: 14, color: '#e8dff5', lineHeight: 1.65, marginBottom: 8 }}>
                호르몬 주기를 입력하면 달력이 완성돼요
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                생리 주기·리듬을 설정하면 날짜별 페이즈 색상과 맞춤 케어를 볼 수 있어요
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {/* ── 공통 달력 (일반+갱년기 통합) ── */}
      {calendarActive ? (
        <div style={{ margin: '14px 16px 0', padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div
              onClick={() => setViewYM(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })}
              style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}
            >‹</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{viewYM.y}년 {viewYM.m + 1}월</div>
            <div
              onClick={() => setViewYM(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })}
              style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}
            >›</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {calendarDays.map((cell, idx) => {
              const cellIso = cell.date
                ? `${cell.date.getFullYear()}-${String(cell.date.getMonth() + 1).padStart(2, '0')}-${String(cell.date.getDate()).padStart(2, '0')}`
                : ''
              const isSelected = cellIso === record.selectedDateIso
              const hasRecord = cellIso ? record.recordedDates.has(cellIso) : false
              return (
              <div
                key={idx}
                role={cell.date ? 'button' : undefined}
                tabIndex={cell.date ? 0 : undefined}
                onClick={cell.date && cell.date <= new Date() ? () => { void record.openForDate(cell.date!) } : undefined}
                onKeyDown={cell.date ? (e) => { if (e.key === 'Enter') void record.openForDate(cell.date!) } : undefined}
                style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  background: cell.date ? cell.color : 'transparent',
                  opacity: cell.date ? (cell.isToday || isSelected ? 1 : 0.72) : 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: cell.date ? '#1a1028' : 'transparent',
                  fontWeight: cell.isToday || isSelected ? 600 : 400,
                  boxShadow: cell.isToday
                    ? `0 0 0 3px #fff, 0 0 0 5px ${cell.color}`
                    : isSelected
                      ? `0 0 0 2px #fff, 0 0 0 4px ${P}`
                      : 'none',
                  cursor: cell.date && cell.date <= new Date() ? 'pointer' : 'default',
                  position: 'relative',
                }}
              >
                {cell.date ? cell.date.getDate() : ''}
                {hasRecord ? (
                  <span style={{
                    position: 'absolute',
                    bottom: 3,
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: '#2A2433',
                  }} />
                ) : null}
              </div>
              )
            })}
          </div>
          {showMenopauseCalendar ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 10, border: 'none', background: '#5adb8a', color: '#1a1028', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              갱년기 케어 가이드 보기 →
            </button>
          ) : null}
          {isMenopause && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '10px 0 0' }}>
              <div
                onClick={async () => {
                  if (!window.confirm('생리가 완전히 끝난 상태(폐경기)로 바꿀까요?')) return
                  const res = await fetch('/api/hormone/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'post_menopause' }) })
                  const json = await res.json().catch(() => ({}))
                  if (!res.ok || !json.ok) { console.error('저장 실패:', json.error); alert('저장 중 오류가 발생했어요. 다시 시도해주세요.'); return }
                  window.location.reload()
                }}
                style={{ background: 'rgba(196,168,255,0.1)', border: '0.5px solid rgba(196,168,255,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'rgba(196,168,232,0.8)', textAlign: 'center', cursor: 'pointer' }}
              >
                🌸 생리가 완전히 끝났어요
              </div>
              <div
                onClick={async () => {
                  if (!window.confirm('생리 주기로 바꿀까요? 오늘 날짜가 시작일로 기록돼요.')) return
                  const res = await fetch('/api/hormone/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resume' }) })
                  const json = await res.json().catch(() => ({}))
                  if (!res.ok || !json.ok) { console.error('저장 실패:', json.error); alert('저장 중 오류가 발생했어요. 다시 시도해주세요.'); return }
                  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
                  const psRes = await fetch('/api/hormone/period-start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today }) })
                  const psJson = await psRes.json().catch(() => ({}))
                  if (!psRes.ok || !psJson.ok) { console.error('시작일 저장 실패:', psJson.error); alert('시작일 저장 중 오류가 발생했어요. 다시 시도해주세요.'); return }
                  window.location.reload()
                }}
                style={{ background: 'rgba(255,182,193,0.08)', border: '0.5px solid rgba(255,182,193,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: 'rgba(255,182,193,0.8)', textAlign: 'center', cursor: 'pointer' }}
              >
                🌙 생리가 다시 시작됐어요
              </div>
            </div>
          )}
        </div>
      ) : null}

      {currentPhase && hasCalendar && !isMenopause && (
        <div style={{ margin: '8px 16px 0', fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.6 }}>
          💜 생리가 시작되면 기록해주세요 · 기록할수록 내 주기가 더 정확해져요
        </div>
      )}

      {hasCalendar && hormoneCycle?.last_period_date && String(hormoneCycle.track || 'general') === 'general' && (() => {
        const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
        const daysSince = Math.floor((new Date(todayIso).getTime() - new Date(hormoneCycle.last_period_date).getTime()) / 86400000)
        return daysSince > cycleLen + 3 ? (
          <div style={{ margin: '10px 16px 0', background: 'rgba(255,182,193,0.08)', border: '0.5px solid rgba(255,182,193,0.2)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,182,193,0.9)' }}>🌸 생리 예정일이 지났어요</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>몸의 변화가 있으신가요? 기록해두면 도움이 돼요</div>
          </div>
        ) : null
      })()}

      {hasCalendar && (
        <div style={{ margin: '14px 16px 0' }}>
          <div
            onClick={() => setSheetOpen(true)}
            style={{ background: 'rgba(196,168,255,0.1)', border: '0.5px solid rgba(196,168,255,0.3)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>🌙 생리 기록하기</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>›</span>
          </div>
        </div>
      )}

      {showRhythmFix ? <RhythmFix /> : null}

      {!isMale && !isMenopause ? (
        <HormoneCalendarRecordModal open={record.recordOpen} currentPhase={currentPhase} cycleDay={cycleDay} selectedDateIso={record.selectedDateIso} recordPeriod={record.recordPeriod} setRecordPeriod={record.setRecordPeriod} recordCondition={record.recordCondition} setRecordCondition={record.setRecordCondition} recordMemo={record.recordMemo} setRecordMemo={record.setRecordMemo} recordSleep={record.recordSleep} setRecordSleep={record.setRecordSleep} recordUv={record.recordUv} setRecordUv={record.setRecordUv} recordStress={record.recordStress} setRecordStress={record.setRecordStress} recordSkinStatus={record.recordSkinStatus} setRecordSkinStatus={record.setRecordSkinStatus} saving={record.saving} onClose={record.closeRecord} onSave={() => { void record.saveRecord() }} viewMode={record.viewMode} setViewMode={record.setViewMode} />
      ) : null}

      {isMale && record.recordOpen ? (
        <Modal title={`기록 · ${record.selectedDateIso}`} onClose={record.closeRecord}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {([
              ['운동', maleExercise, setMaleExercise, '예: 가벼운 조깅, 헬스'],
              ['피로', maleFatigue, setMaleFatigue, '예: 피곤함, 컨디션 보통'],
              ['스트레스', maleStress, setMaleStress, '예: 업무 스트레스, 양호'],
              ['수면', maleSleep, setMaleSleep, '예: 6시간, 숙면'],
            ] as const).map(([label, val, setter, ph]) => (
              <label key={label} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                {label}
                <input value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} style={inputStyle} />
              </label>
            ))}
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              피부 메모
              <textarea value={record.recordMemo} onChange={(e) => record.setRecordMemo(e.target.value)} placeholder="오늘 피부 상태를 적어주세요" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            <button type="button" disabled={record.saving} onClick={saveMaleRecord} style={{ marginTop: 4, padding: 12, borderRadius: 10, border: 'none', background: '#64a0dc', color: '#fff', fontSize: 13, cursor: record.saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: record.saving ? 0.7 : 1 }}>
              {record.saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </Modal>
      ) : null}

      {isMenopause && record.recordOpen ? (
        <Modal title={`기록 · ${record.selectedDateIso}`} onClose={record.closeRecord}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {([
              ['안면홍조', menoFlush, setMenoFlush, '예: 얼굴 열감, 가끔 홍조'],
              ['수면', menoSleep, setMenoSleep, '예: 자주 깸, 5시간'],
              ['기분', menoMood, setMenoMood, '예: 예민함, 안정적'],
              ['관절', menoJoint, setMenoJoint, '예: 무릎 뻐근함'],
            ] as const).map(([label, val, setter, ph]) => (
              <label key={label} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                {label}
                <input value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} style={inputStyle} />
              </label>
            ))}
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              피부 메모
              <textarea value={record.recordMemo} onChange={(e) => record.setRecordMemo(e.target.value)} placeholder="오늘 피부 상태를 적어주세요" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            <button type="button" disabled={record.saving} onClick={saveMenopauseRecord} style={{ marginTop: 4, padding: 12, borderRadius: 10, border: 'none', background: '#5adb8a', color: '#1a1028', fontSize: 13, cursor: record.saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: record.saving ? 0.7 : 1 }}>
              {record.saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </Modal>
      ) : null}

      <HormoneCalendarRecordToast message={record.toast} />

      <HormoneSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        currentPhase={sheetPhase}
        cycleDay={cycleDay}
        hormoneCycle={hormoneCycle}
        showEditChrome={false}
        supabaseClient={supabase}
        onRefreshCycle={() => void load()}
      />

      {phasePopup && PHASE_INFO[phasePopup] && (() => {
        const info = PHASE_INFO[phasePopup]
        const isActive = phasePopup === currentPhase
        return (
          <>
            <style>{`@keyframes slideUpIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
            <div onClick={() => setPhasePopup(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 95 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', width: '100%', maxWidth: 390, background: '#1A1030', borderRadius: '20px 20px 0 0', padding: '24px 20px 44px', zIndex: 96, animation: 'slideUpIn 0.25s ease-out' }}>
              <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, margin: '0 auto 20px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
                    {info.emoji} {phasePopup}
                    {isActive && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 400, marginLeft: 8 }}>← 지금 여기</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{info.sub}</div>
                </div>
                <div onClick={() => setPhasePopup(null)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>✕</div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 14, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>{info.desc}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>케어 포인트</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {info.care.map(c => <div key={c} style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{c}</div>)}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
