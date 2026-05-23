'use client'

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

type Gender = 'female' | 'male' | 'none'
type HormoneStatus = 'pregnant' | 'menstrual' | 'pre_menstrual' | 'post_menstrual' | 'ovulation' | 'irregular' | 'menopause_transition' | 'post_menopause' | 'hrt' | 'still_menstruating' | 'shaving' | 'no_shaving' | 'unknown'
type PregnancyWeek = 'early' | 'mid' | 'late' | 'unknown'
type SleepQuality = 'good' | 'okay' | 'frequent_waking' | 'insomnia'

interface Answers {
  skinType: string
  concerns: string[]
  condition: string
  concernArea: string[]
  freeText: string
  tightness: string
  trouble: string
  pore: string
  pigmentation: string
  elasticity: string
  afterWash: string
  event: string
  gender: Gender
  hormoneStatus: HormoneStatus | ''
  pregnancyWeek: PregnancyWeek | ''
  sleepQuality: SleepQuality | ''
  pregnancyConcerns: string[]
  menstrualChanges: string[]
  menopauseSymptoms: string[]
  environment: string
  currentSteps: string[]
  careFrequency: string
  diet: string
  usingSalon: boolean
  water: number
  sleep: number
  uv: number
  stress: number
}

function SkinAnalysisQPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const aiScores = {
    moisture: Number(searchParams.get('moisture') || 55),
    oil: Number(searchParams.get('oil') || 40),
    sensitivity: Number(searchParams.get('sensitivity') || 70),
    elasticity: Number(searchParams.get('elasticity') || 65),
    pigmentation: Number(searchParams.get('pigmentation') || 25),
    pore: Number(searchParams.get('pore') || 40),
  }
  const userAge = Number(searchParams.get('age') || 42)

  const [step, setStep] = useState(1) // 1~3
  const [answers, setAnswers] = useState<Answers>({
    skinType: '', concerns: [], condition: '', concernArea: [], freeText: '',
    tightness: '', trouble: '',
    pore: '', pigmentation: '', elasticity: '', afterWash: '',
    event: '', gender: 'none', hormoneStatus: '',
    pregnancyWeek: '', sleepQuality: '', pregnancyConcerns: [],
    menstrualChanges: [], menopauseSymptoms: [],
    environment: '', currentSteps: [], careFrequency: '',
    diet: '', usingSalon: false,
    water: 6, sleep: 7, uv: 2, stress: 3,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadProfileGender = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId) return

      const { data } = await supabase
        .from('profiles')
        .select('gender, skin_type')
        .eq('id', userId)
        .maybeSingle()

      const g = String((data as any)?.gender || '').toLowerCase()
      if (cancelled) return
      if (g === 'female' || g === 'male') {
        setAnswers(prev => (prev.gender === g ? prev : { ...prev, gender: g as Gender }))
      }
      const st = String((data as any)?.skin_type ?? '')
      if (st) setAnswers(prev => ({ ...prev, skinType: st }))
    }

    loadProfileGender()
    return () => {
      cancelled = true
    }
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  const toggleArr = (arr: string[], val: string, max = 99) => {
    if (arr.includes(val)) return arr.filter(x => x !== val)
    if (arr.length >= max) return arr
    return [...arr, val]
  }

  const isOlderWoman = answers.gender === 'female' && userAge >= 45
  const isPregnant = answers.hormoneStatus === 'pregnant'

  const handleNext = async () => {
    if (step < 3) {
      setStep(s => s + 1)
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const ageFactor = userAge >= 55 ? 0.8 : userAge >= 50 ? 0.85 : userAge >= 45 ? 0.9 : userAge >= 40 ? 0.95 : 1.0

      const hormoneDeltaMap: Record<string, { sensitivity?: number; moisture?: number; oil?: number; trouble?: number; elasticity?: number; note?: string }> = {
        pregnant: { sensitivity: +15, moisture: -5, note: 'pregnant' },
        menstrual: { sensitivity: +20, moisture: -10, note: 'menstrual' },
        pre_menstrual: { oil: +15, trouble: +20, note: 'pre_menstrual' },
        post_menstrual: { note: 'post_menstrual' },
        ovulation: { note: 'ovulation' },
        irregular: { sensitivity: +10, note: 'irregular' },
        menopause_transition: { elasticity: -15, moisture: -10, note: 'menopause' },
        post_menopause: { elasticity: -25, moisture: -20, note: 'post_menopause' },
        hrt: { note: 'hrt' },
        shaving: { sensitivity: +10, moisture: -5, note: 'shaving' },
      }
      const hormoneFactor = hormoneDeltaMap[answers.hormoneStatus] || {}

      const eventMod = answers.event === 'laser' ? { sensitivity: +25 }
        : answers.event === 'travel' ? { pigmentation: +5 }
        : answers.event === 'season' ? { moisture: -5 }
        : {}

      const lifeFactor = (
        (answers.water / 8) * 0.3 +
        (answers.sleep / 8) * 0.3 +
        ((4 - answers.uv) / 4) * 0.2 +
        ((5 - answers.stress) / 5) * 0.2
      )

      const finalScores = {
        moisture: Math.max(10, Math.min(100, Math.round(aiScores.moisture * ageFactor * lifeFactor + ((hormoneFactor as any).moisture || 0) + ((eventMod as any).moisture || 0)))),
        oil: Math.max(10, Math.min(100, Math.round(aiScores.oil + ((hormoneFactor as any).oil || 0)))),
        sensitivity: Math.max(10, Math.min(100, Math.round(aiScores.sensitivity + ((hormoneFactor as any).sensitivity || 0) + ((eventMod as any).sensitivity || 0)))),
        elasticity: Math.max(10, Math.min(100, Math.round(aiScores.elasticity * ageFactor + ((hormoneFactor as any).elasticity || 0)))),
        pigmentation: Math.max(5, Math.min(100, Math.round(aiScores.pigmentation + ((eventMod as any).pigmentation || 0)))),
        pore: Math.max(5, Math.min(100, Math.round(aiScores.pore))),
      }

      const { data: analysis } = await supabase.from('skin_analyses').insert({
        user_id: user.id,
        moisture_score: finalScores.moisture,
        oil_score: finalScores.oil,
        sensitivity_score: finalScores.sensitivity,
        elasticity_score: finalScores.elasticity,
        pigmentation_score: finalScores.pigmentation,
        pore_score: finalScores.pore,
        skin_event: answers.event,
        condition: answers.condition || null,
        concern_area: answers.concernArea.length > 0 ? answers.concernArea : null,
        free_text: answers.freeText.trim() || null,
        hormone_status: answers.hormoneStatus,
        pregnancy_week: answers.pregnancyWeek || null,
        lifestyle_water: answers.water,
        lifestyle_sleep: answers.sleep,
        lifestyle_uv: answers.uv,
        lifestyle_stress: answers.stress,
        age_at_analysis: userAge,
        is_pregnant: isPregnant,
      }).select().single()

      const params = new URLSearchParams({
        moisture: String(finalScores.moisture),
        oil: String(finalScores.oil),
        sensitivity: String(finalScores.sensitivity),
        elasticity: String(finalScores.elasticity),
        pigmentation: String(finalScores.pigmentation),
        pore: String(finalScores.pore),
        skinType: answers.skinType || '',
        event: answers.event,
        age: String(userAge),
        gender: answers.gender,
        hormone: answers.hormoneStatus,
        pregnant: isPregnant ? '1' : '0',
        id: analysis?.id || '',
      })
      router.push(`/skin-analysis/result?${params.toString()}`)
    } catch (e) {
      const params = new URLSearchParams({
        moisture: String(aiScores.moisture), oil: String(aiScores.oil),
        sensitivity: String(aiScores.sensitivity), elasticity: String(aiScores.elasticity),
        pigmentation: String(aiScores.pigmentation), pore: String(aiScores.pore),
        skinType: answers.skinType || '',
        event: answers.event, age: String(userAge), gender: answers.gender,
        hormone: answers.hormoneStatus, pregnant: isPregnant ? '1' : '0',
      })
      router.push(`/skin-analysis/result?${params.toString()}`)
    } finally {
      setSaving(false)
    }
  }

  const SelCard = ({ val, icon, label, desc, selected, onSelect, color = GOLD }: any) => (
    <div onClick={() => onSelect(val)} style={{ borderRadius: '12px', padding: '10px', textAlign: 'center', cursor: 'pointer', border: selected ? `1.5px solid rgba(201,169,110,0.4)` : CARD_BORDER, background: selected ? 'rgba(201,169,110,0.1)' : CARD_BG }}>
      <div style={{ fontSize: '22px', marginBottom: '5px' }}>{icon}</div>
      <div style={{ fontSize: '11px', fontWeight: selected ? 400 : 300, color: selected ? color : '#fff', marginBottom: '2px' }}>{label}</div>
      {desc && <div style={{ fontSize: '8px', color: TEXT_DIM }}>{desc}</div>}
    </div>
  )

  const LevelRow = ({ label, options, val, onSelect }: any) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '5px' }}>
        {options.map((opt: any) => (
          <div key={opt.val} onClick={() => onSelect(opt.val)} style={{ flex: 1, padding: '7px 0', textAlign: 'center', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', background: val === opt.val ? 'rgba(201,169,110,0.12)' : CARD_BG, border: val === opt.val ? '1.5px solid rgba(201,169,110,0.4)' : CARD_BORDER, color: val === opt.val ? GOLD : TEXT_MUTED }}>
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  )

  const PillChip = ({ label, selected, onToggle, color = GOLD, bg = 'rgba(201,169,110,0.1)', border = 'rgba(201,169,110,0.4)' }: any) => (
    <div onClick={onToggle} style={{ padding: '5px 10px', borderRadius: '20px', fontSize: '10px', cursor: 'pointer', background: selected ? bg : CARD_BG, border: selected ? `1.5px solid ${border}` : CARD_BORDER, color: selected ? color : TEXT_MUTED }}>
      {label}
    </div>
  )

  const SliderRow = ({ icon, label, val, min, max, unit, onSet }: any) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{icon} {label}</span>
        <span style={{ fontSize: '11px', color: GOLD, fontFamily: 'monospace' }}>{val}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={val} onChange={e => onSet(Number(e.target.value))} style={{ width: '100%', accentColor: GOLD }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ fontSize: '8px', color: TEXT_DIM }}>{min}{unit}</span>
        <span style={{ fontSize: '8px', color: TEXT_DIM }}>{max}{unit}</span>
      </div>
    </div>
  )

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '30px' }}>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER }}>
        <button onClick={() => step === 1 ? router.back() : setStep(s => s - 1)} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#fff' }}>‹</button>
        <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>피부 상태 질문</span>
        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_DIM }}>{step} / 3</span>
      </header>

      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px 0' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: '3px', borderRadius: '2px', background: s < step ? GOLD : s === step ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      <div style={{ margin: '10px 16px 0', padding: '8px 12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '10px' }}>
        <div style={{ fontSize: '8px', color: 'rgba(201,169,110,0.6)', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '5px' }}>🔬 AI 1차 분석 완료 · 질문으로 정확도 보완</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <div style={{ padding: '2px 7px', background: 'rgba(106,176,224,0.1)', border: '1px solid rgba(106,176,224,0.2)', borderRadius: '14px', fontSize: '9px', color: 'rgba(140,190,255,0.9)' }}>수분 {aiScores.moisture}%</div>
          <div style={{ padding: '2px 7px', background: 'rgba(220,120,80,0.1)', border: '1px solid rgba(220,120,80,0.2)', borderRadius: '14px', fontSize: '9px', color: 'rgba(240,160,100,0.9)' }}>민감 {aiScores.sensitivity >= 70 ? 'HIGH' : 'LOW'}</div>
          <div style={{ padding: '2px 7px', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: '14px', fontSize: '9px', color: GOLD }}>탄력 {aiScores.elasticity}%</div>
          <div style={{ padding: '2px 7px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', fontSize: '9px', color: TEXT_DIM }}>만 {userAge}세</div>
        </div>
      </div>

      {step === 1 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '14px', fontWeight: 400, marginBottom: '14px' }}>오늘 피부 컨디션은?</div>
          <LevelRow label="" val={answers.condition} onSelect={(v: string) => setAnswers(a => ({ ...a, condition: v }))}
            options={[
              { val: 'worst', label: '최악' },
              { val: 'poor', label: '별로' },
              { val: 'normal', label: '보통' },
              { val: 'good', label: '좋음' },
              { val: 'best', label: '최고' },
            ]} />
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '10px' }}>신경쓰이는 부위</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {['이마', '볼', '코', '턱', '눈가', '전체'].map(area => (
              <PillChip key={area} label={area}
                selected={answers.concernArea.includes(area)}
                onToggle={() => setAnswers(a => ({ ...a, concernArea: toggleArr(a.concernArea, area) }))} />
            ))}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '8px' }}>오늘 피부에 대해 자유롭게 적어주세요</div>
          <textarea
            value={answers.freeText}
            onChange={e => setAnswers(a => ({ ...a, freeText: e.target.value }))}
            placeholder="오늘 피부에 대해 자유롭게 적어주세요"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: '16px',
              borderRadius: '10px', border: CARD_BORDER, background: CARD_BG,
              color: '#fff', fontSize: '12px', padding: '12px', resize: 'vertical',
              fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300,
            }}
          />
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '10px' }}>최근 피부 이벤트가 있나요?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '16px' }}>
            <SelCard val="none" icon="✨" label="없음" desc="평소와 동일" selected={answers.event === 'none'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="laser" icon="💉" label="레이저·시술" desc="최근 2주 이내" selected={answers.event === 'laser'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="travel" icon="✈️" label="여행" desc="환경 변화" selected={answers.event === 'travel'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="season" icon="🌸" label="환절기" desc="계절 변화" selected={answers.event === 'season'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="stress" icon="😤" label="스트레스" desc="피로·긴장" selected={answers.event === 'stress'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '14px' }}>오늘 하루 상태를 알려주세요</div>
          <SliderRow icon="💧" label="수분 섭취" val={answers.water} min={0} max={10} unit="잔" onSet={(v: number) => setAnswers(a => ({ ...a, water: v }))} />
          <SliderRow icon="😴" label="수면시간" val={answers.sleep} min={3} max={10} unit="시간" onSet={(v: number) => setAnswers(a => ({ ...a, sleep: v }))} />
          <SliderRow icon="☀️" label="자외선 노출" val={answers.uv} min={0} max={4} unit={['없음', '약함', '보통', '강함', '매우강함'][answers.uv] ? '' : ''} onSet={(v: number) => setAnswers(a => ({ ...a, uv: v }))} />
          <SliderRow icon="😤" label="스트레스" val={answers.stress} min={1} max={5} unit={answers.stress === 1 ? ' 없음' : answers.stress === 5 ? ' 매우높음' : '단계'} onSet={(v: number) => setAnswers(a => ({ ...a, stress: v }))} />

          {isPregnant && (answers.sleepQuality === 'frequent_waking' || answers.sleepQuality === 'insomnia') && (
            <div style={{ padding: '10px 12px', background: 'rgba(100,160,240,0.06)', border: '1px solid rgba(100,160,240,0.18)', borderRadius: '10px', marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', color: 'rgba(140,190,255,0.8)', fontFamily: 'monospace', marginBottom: '4px' }}>😴 수면 불편 감지 → 임신 안전 아로마 추천</div>
              <div style={{ fontSize: '9px', color: TEXT_MUTED, lineHeight: 1.7 }}>
                ✓ 안전: <span style={{ color: 'rgba(140,220,160,0.8)' }}>라벤더 · 캐모마일 · 일랑일랑</span><br />
                ✕ 주의: <span style={{ color: 'rgba(255,120,120,0.7)' }}>페퍼민트 · 로즈마리 · 유칼립투스</span>
              </div>
            </div>
          )}

          <div style={{ marginTop: '6px', padding: '13px', background: 'linear-gradient(135deg,#C9A96E,#E8C88A)', borderRadius: '14px', textAlign: 'center', fontSize: '14px', fontWeight: 400, color: BG, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 18px rgba(201,169,110,0.4)', opacity: saving ? 0.6 : 1 }} onClick={saving ? undefined : handleNext}>
            {saving ? '분석 중...' : '🔬 AI 최종 분석 시작'}
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', color: TEXT_DIM, marginTop: '6px' }}>3가지 질문 완료 · 약 30초 소요</div>
        </div>
      )}

      {step < 3 && (
        <div style={{ padding: '16px 16px 0' }}>
          <button onClick={handleNext} style={{ width: '100%', padding: '13px', background: GOLD, borderRadius: '12px', fontSize: '13px', fontWeight: 400, color: BG, cursor: 'pointer', border: 'none', fontFamily: "'Noto Sans KR', sans-serif" }}>
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: BG }} />}>
      <SkinAnalysisQPageContent />
    </Suspense>
  )
}
