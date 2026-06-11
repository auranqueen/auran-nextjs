'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import HormoneCard from '@/components/home/HormoneCard'
import RhythmFix from '@/components/home/RhythmFix'
import { calcHormoneBriefing, isPeriodTrack } from '@/lib/hormoneUtils'
import { computeComposite, computeSkinAge } from '@/lib/skinAge'

const BG = '#0D0B09'
const P = '#7B5EA7'
const GOLD = '#C9A96E'

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

function phaseColor(phase: string): string {
  return PHASE_COLORS[phase] || P
}

function getNextPhases(cycleDay: number, cycleLen: number): { phase: string; dday: number }[] {
  const transitions = [
    { day: 6, phase: '황금기' },
    { day: 14, phase: '만개기' },
    { day: 17, phase: '물들기' },
    { day: cycleLen + 1, phase: '달빛기' },
  ]
  const list = transitions
    .map((t) => ({ phase: t.phase, dday: t.day - cycleDay }))
    .filter((x) => x.dday > 0)
  if (list.length >= 3) return list.slice(0, 3)
  const extra = { phase: '달빛기', dday: cycleLen - cycleDay + 1 }
  return [...list, extra].slice(0, 3)
}

function skinAgeOf(r: {
  skin_age: number | null
  skin_score: number | null
  moisture_score: number | null
  oil_score: number | null
  sensitivity_score: number | null
  elasticity_score: number | null
  pigmentation_score: number | null
  pore_score: number | null
  age_at_analysis: number | null
}): number | null {
  if (r.skin_age != null) return r.skin_age
  const comp = r.skin_score != null ? r.skin_score : computeComposite({
    moisture: r.moisture_score ?? undefined,
    oil: r.oil_score ?? undefined,
    sensitivity: r.sensitivity_score ?? undefined,
    elasticity: r.elasticity_score ?? undefined,
    pigmentation: r.pigmentation_score ?? undefined,
    pore: r.pore_score ?? undefined,
  } as Parameters<typeof computeComposite>[0])
  return computeSkinAge(comp, r.age_at_analysis)
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
  const [userName, setUserName] = useState('고객')
  const [hca, setHca] = useState<boolean | null>(null)
  const [hormoneCycle, setHormoneCycle] = useState<any>(null)
  const [skinLatest, setSkinLatest] = useState<any>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'calendar' | 'record' | 'analysis'>('calendar')
  const [recordOpen, setRecordOpen] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [recordPeriod, setRecordPeriod] = useState('')
  const [recordCondition, setRecordCondition] = useState('')
  const [recordMemo, setRecordMemo] = useState('')

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

      const [profileRes, hcRes, skinRes] = await Promise.all([
        sb
          .from('profiles')
          .select('cycle_type, gender, hormone_cycle_applicable, birth_date, full_name')
          .eq('auth_id', user.id)
          .maybeSingle(),
        sb.from('hormone_cycle').select('*').eq('auth_id', user.id).maybeSingle(),
        sb
          .from('skin_analyses')
          .select('skin_age, skin_score, moisture_score, oil_score, elasticity_score, sensitivity_score, pigmentation_score, pore_score, age_at_analysis')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      const profile = profileRes.data
      if (profile) {
        const nm = String((profile as any).full_name || '').trim()
        if (nm) setUserName(nm)
        setHca(
          (profile as any).hormone_cycle_applicable === true ? true :
          (profile as any).hormone_cycle_applicable === false ? false :
          null,
        )
      } else {
        setHca(null)
      }

      setHormoneCycle(hcRes.data ?? null)
      setSkinLatest((skinRes.data as any[])?.[0] ?? null)
    } catch {
      setHormoneCycle(null)
      setSkinLatest(null)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const calc = hormoneCycle ? calcHormoneBriefing(hormoneCycle) : null
  const currentPhase = calc?.phase ?? '달빛기'
  const cycleDay = calc?.cycleDay ?? 0
  const cycleLen = Math.max(21, Math.min(60, Number(hormoneCycle?.cycle_length || 28)))
  const hasCalendar = hormoneCycle != null && hca !== false && isPeriodTrack(String(hormoneCycle?.track || 'general'))

  const hormoneMainLine = calc
    ? `${userName}님, 지금 ${calc.phase} 예요 🌿`
    : `${userName}님의 호르몬 달력`
  const hormoneSubLine = calc ? `오늘의 피부 이야기 · ${calc.focus}` : '주기를 입력하면 맞춤 케어가 시작돼요'

  const calendarDays = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const startPad = first.getDay()
    const days: { date: Date | null; isToday: boolean; phase: string; color: string }[] = []
    for (let i = 0; i < startPad; i++) days.push({ date: null, isToday: false, phase: '', color: 'transparent' })
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(y, m, d)
      const isToday = d === now.getDate()
      if (hormoneCycle && hasCalendar) {
        const dayCalc = calcHormoneBriefing(hormoneCycle, date)
        days.push({ date, isToday, phase: dayCalc.phase, color: phaseColor(dayCalc.phase) })
      } else {
        days.push({ date, isToday, phase: '', color: 'rgba(255,255,255,0.06)' })
      }
    }
    return days
  }, [hormoneCycle, hasCalendar])

  const nextPhases = hasCalendar && cycleDay > 0 ? getNextPhases(cycleDay, cycleLen) : []

  const analysisBars = useMemo(() => {
    const phases = ['달빛기', '황금기', '만개기', '물들기']
    const base = skinLatest?.moisture_score ?? 55
    return phases.map((ph, i) => ({
      phase: ph,
      value: Math.max(20, Math.min(95, base + (i - 1) * 6 + (ph === currentPhase ? 8 : 0))),
      color: phaseColor(ph),
    }))
  }, [skinLatest, currentPhase])

  const onTab = (tab: 'calendar' | 'record' | 'analysis') => {
    setActiveTab(tab)
    if (tab === 'record') setRecordOpen(true)
    if (tab === 'analysis') setAnalysisOpen(true)
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

      {hasCalendar ? (
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

      {hasCalendar ? (
        <div style={{ margin: '14px 16px 0' }}>
          <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
            {TIMELINE_SEGMENTS.map((seg) => (
              <div key={seg.phase} style={{ flex: seg.ratio, background: seg.color, opacity: seg.phase === currentPhase ? 1 : 0.45 }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {TIMELINE_SEGMENTS.map((seg) => (
              <span key={seg.phase} style={{ fontSize: 9, color: seg.phase === currentPhase ? seg.color : 'rgba(255,255,255,0.3)' }}>
                {seg.phase}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ margin: '14px 16px 0', display: 'flex', gap: 8 }}>
        {(['calendar', 'record', 'analysis'] as const).map((tab) => {
          const label = tab === 'calendar' ? '달력' : tab === 'record' ? '기록' : '분석'
          const on = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTab(tab)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                border: on ? `1px solid ${P}` : '1px solid rgba(255,255,255,0.1)',
                background: on ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.04)',
                color: on ? '#d8c4f0' : 'rgba(255,255,255,0.55)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {!hasCalendar ? (
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
      ) : activeTab === 'calendar' ? (
        <div style={{ margin: '14px 16px 0', padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10, textAlign: 'center' }}>
            {new Date().getFullYear()}년 {new Date().getMonth() + 1}월
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{w}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {calendarDays.map((cell, idx) => (
              <div
                key={idx}
                style={{
                  aspectRatio: '1',
                  borderRadius: 8,
                  background: cell.date ? cell.color : 'transparent',
                  opacity: cell.date ? (cell.isToday ? 1 : 0.72) : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: cell.date ? '#1a1028' : 'transparent',
                  fontWeight: cell.isToday ? 600 : 400,
                  boxShadow: cell.isToday
                    ? `0 0 0 3px #fff, 0 0 0 5px ${cell.color}`
                    : 'none',
                }}
              >
                {cell.date ? cell.date.getDate() : ''}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {hasCalendar ? (
        <div style={{ margin: '14px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>오늘 케어</div>
          <HormoneCard
            hormoneMainLine={hormoneMainLine}
            hormoneSubLine={hormoneSubLine}
            hormonePhaseTipDesc={calc?.focus ? `${calc.phase}에는 ${calc.focus} 케어를 추천해요.` : ''}
            hormonePhaseTipOpen={tipOpen}
            onTipToggle={() => setTipOpen((v) => !v)}
            showEditChrome={false}
            onEditClick={() => {}}
            currentPhase={currentPhase}
            cycleDay={cycleDay}
            hormoneCycle={hormoneCycle}
            supabaseClient={supabase}
            onRefreshCycle={() => void load()}
          />
        </div>
      ) : null}

      {hasCalendar && nextPhases.length > 0 ? (
        <div style={{ margin: '14px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>다음 페이즈 예고</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nextPhases.map((item) => (
              <div
                key={`${item.phase}-${item.dday}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ fontSize: 13, color: phaseColor(item.phase) }}>{item.phase}</span>
                <span style={{ fontSize: 12, color: GOLD }}>D-{item.dday}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hasCalendar ? <RhythmFix /> : null}

      {recordOpen ? (
        <Modal title="기록" onClose={() => { setRecordOpen(false); setActiveTab('calendar') }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              생리 상태
              <input
                value={recordPeriod}
                onChange={(e) => setRecordPeriod(e.target.value)}
                placeholder="예: 생리 2일차, 가벼운 양"
                style={{
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
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              컨디션
              <input
                value={recordCondition}
                onChange={(e) => setRecordCondition(e.target.value)}
                placeholder="예: 피로, 붓기, 컨디션 좋음"
                style={{
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
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              피부 메모
              <textarea
                value={recordMemo}
                onChange={(e) => setRecordMemo(e.target.value)}
                placeholder="오늘 피부 상태를 적어주세요"
                rows={4}
                style={{
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
                  resize: 'vertical',
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => { setRecordOpen(false); setActiveTab('calendar') }}
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: P,
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              저장
            </button>
          </div>
        </Modal>
      ) : null}

      {analysisOpen ? (
        <Modal title="분석" onClose={() => { setAnalysisOpen(false); setActiveTab('calendar') }}>
          {skinLatest ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: '피부나이', value: skinAgeOf(skinLatest) != null ? `${skinAgeOf(skinLatest)}세` : '—' },
                  { label: '수분', value: skinLatest.moisture_score != null ? `${skinLatest.moisture_score}%` : '—' },
                  { label: '유분', value: skinLatest.oil_score != null ? `${skinLatest.oil_score}%` : '—' },
                  { label: '탄력', value: skinLatest.elasticity_score != null ? `${skinLatest.elasticity_score}%` : '—' },
                ].map((m) => (
                  <div key={m.label} style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, color: GOLD, fontFamily: 'Georgia, serif' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>페이즈별 수분 시뮬</div>
                {analysisBars.map((bar) => (
                  <div key={bar.phase} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: bar.color }}>{bar.phase}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{bar.value}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ width: `${bar.value}%`, height: '100%', borderRadius: 3, background: bar.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, textAlign: 'center', padding: '12px 0' }}>
              피부 분석 데이터가 없어요.<br />
              <a href="/skin-analysis" style={{ color: P, textDecoration: 'none' }}>피부 분석하러 가기 →</a>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
