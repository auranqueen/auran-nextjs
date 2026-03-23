'use client'

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

export default function SkinAnalysisQPage() {
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

  const [step, setStep] = useState(1) // 1~5
  const [answers, setAnswers] = useState<Answers>({
    skinType: '', concerns: [], tightness: '', trouble: '',
    pore: '', pigmentation: '', elasticity: '', afterWash: '',
    event: '', gender: 'none', hormoneStatus: '',
    pregnancyWeek: '', sleepQuality: '', pregnancyConcerns: [],
    menstrualChanges: [], menopauseSymptoms: [],
    environment: '', currentSteps: [], careFrequency: '',
    diet: '', usingSalon: false,
    water: 6, sleep: 7, uv: 2, stress: 3,
  })
  const [saving, setSaving] = useState(false)

  const pad = (n: number) => String(n).padStart(2, '0')

  const toggleArr = (arr: string[], val: string, max = 99) => {
    if (arr.includes(val)) return arr.filter(x => x !== val)
    if (arr.length >= max) return arr
    return [...arr, val]
  }

  const isOlderWoman = answers.gender === 'female' && userAge >= 45
  const isPregnant = answers.hormoneStatus === 'pregnant'

  const handleNext = async () => {
    if (step < 5) { setStep(s => s + 1); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 나이 보정
      const ageFactor = userAge >= 55 ? 0.8 : userAge >= 50 ? 0.85 : userAge >= 45 ? 0.9 : userAge >= 40 ? 0.95 : 1.0

      // 호르몬 보정
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

      // 이벤트 보정
      const eventMod = answers.event === 'laser' ? { sensitivity: +25 }
        : answers.event === 'travel' ? { pigmentation: +5 }
        : answers.event === 'season' ? { moisture: -5 }
        : {}

      // 생활습관 보정
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

      // TODO: skin_analyses 테이블에 저장
      const { data: analysis } = await supabase.from('skin_analyses').insert({
        user_id: user.id,
        moisture_score: finalScores.moisture,
        oil_score: finalScores.oil,
        sensitivity_score: finalScores.sensitivity,
        elasticity_score: finalScores.elasticity,
        pigmentation_score: finalScores.pigmentation,
        pore_score: finalScores.pore,
        skin_type: answers.skinType,
        skin_concerns: answers.concerns,
        skin_event: answers.event,
        gender: answers.gender,
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
        skinType: answers.skinType || 'unknown',
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
        skinType: answers.skinType || 'unknown',
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

      {/* 탑바 */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER }}>
        <button onClick={() => step === 1 ? router.back() : setStep(s => s - 1)} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#fff' }}>‹</button>
        <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>피부 상태 질문</span>
        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_DIM }}>{step} / 5</span>
      </header>

      {/* 스텝바 */}
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px 0' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} style={{ flex: 1, height: '3px', borderRadius: '2px', background: s < step ? GOLD : s === step ? 'rgba(201,169,110,0.5)' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      {/* AI 1차 결과 배지 */}
      <div style={{ margin: '10px 16px 0', padding: '8px 12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '10px' }}>
        <div style={{ fontSize: '8px', color: 'rgba(201,169,110,0.6)', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '5px' }}>🔬 AI 1차 분석 완료 · 질문으로 정확도 보완</div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          <div style={{ padding: '2px 7px', background: 'rgba(106,176,224,0.1)', border: '1px solid rgba(106,176,224,0.2)', borderRadius: '14px', fontSize: '9px', color: 'rgba(140,190,255,0.9)' }}>수분 {aiScores.moisture}%</div>
          <div style={{ padding: '2px 7px', background: 'rgba(220,120,80,0.1)', border: '1px solid rgba(220,120,80,0.2)', borderRadius: '14px', fontSize: '9px', color: 'rgba(240,160,100,0.9)' }}>민감 {aiScores.sensitivity >= 70 ? 'HIGH' : 'LOW'}</div>
          <div style={{ padding: '2px 7px', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: '14px', fontSize: '9px', color: GOLD }}>탄력 {aiScores.elasticity}%</div>
          <div style={{ padding: '2px 7px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', fontSize: '9px', color: TEXT_DIM }}>만 {userAge}세</div>
        </div>
      </div>

      {/* ─── Q1: 피부 타입 ─── */}
      {step === 1 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '14px', fontWeight: 400, marginBottom: '5px' }}>내 피부 타입은 어떤가요?</div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, marginBottom: '14px' }}>AI 분석 결과를 더 정확하게 보완해줘요</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <SelCard val="dry" icon="💧" label="건성" desc="자주 당기고 건조함" selected={answers.skinType === 'dry'} onSelect={(v: string) => setAnswers(a => ({ ...a, skinType: v }))} />
            <SelCard val="oily" icon="✨" label="지성" desc="번들거리고 모공 넓음" selected={answers.skinType === 'oily'} onSelect={(v: string) => setAnswers(a => ({ ...a, skinType: v }))} />
            <SelCard val="combination" icon="🌊" label="복합성" desc="T존 지성, 볼 건성" selected={answers.skinType === 'combination'} onSelect={(v: string) => setAnswers(a => ({ ...a, skinType: v }))} />
            <SelCard val="sensitive" icon="🌸" label="민감성" desc="자극에 쉽게 반응" selected={answers.skinType === 'sensitive'} onSelect={(v: string) => setAnswers(a => ({ ...a, skinType: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '16px' }}>
            <SelCard val="unknown" icon="🔮" label="잘 모르겠어요" desc="AI 판단에 맡길게요" selected={answers.skinType === 'unknown'} onSelect={(v: string) => setAnswers(a => ({ ...a, skinType: v }))} />
          </div>

          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '10px' }}>가장 신경쓰이는 피부 고민은? <span style={{ fontSize: '10px', color: TEXT_DIM }}>최대 3개</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {[
              { val: 'moisture', label: '💧 수분 부족' }, { val: 'brightening', label: '✨ 미백·톤업' },
              { val: 'pore', label: '🔍 모공·각질' }, { val: 'sensitivity', label: '🌿 민감·붉음증' },
              { val: 'aging', label: '⏰ 주름·탄력' }, { val: 'pigmentation', label: '☀️ 색소침착' },
              { val: 'lifting', label: '💆 리프팅' }, { val: 'acne', label: '🔥 트러블·여드름' },
              { val: 'darkcircle', label: '🌙 다크서클' },
            ].map(item => (
              <PillChip key={item.val} label={item.label}
                selected={answers.concerns.includes(item.val)}
                onToggle={() => setAnswers(a => ({ ...a, concerns: toggleArr(a.concerns, item.val, 3) }))} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Q2: 피부 상태 상세 ─── */}
      {step === 2 && (
        <div style={{ padding: '14px 16px 0' }}>
          <LevelRow label="피부가 당기는 느낌은?" val={answers.tightness} onSelect={(v: string) => setAnswers(a => ({ ...a, tightness: v }))}
            options={[{ val: 'none', label: '없음' }, { val: 'little', label: '약간' }, { val: 'often', label: '자주' }, { val: 'always', label: '항상' }]} />
          <LevelRow label="트러블·여드름 빈도는?" val={answers.trouble} onSelect={(v: string) => setAnswers(a => ({ ...a, trouble: v }))}
            options={[{ val: 'rare', label: '거의없음' }, { val: 'sometimes', label: '가끔' }, { val: 'often', label: '자주' }, { val: 'always', label: '항상' }]} />
          <LevelRow label="모공이 얼마나 신경쓰이나요?" val={answers.pore} onSelect={(v: string) => setAnswers(a => ({ ...a, pore: v }))}
            options={[{ val: 'none', label: '없음' }, { val: 'little', label: '약간' }, { val: 'moderate', label: '보통' }, { val: 'severe', label: '심함' }]} />
          <LevelRow label="기미·색소침착 정도는?" val={answers.pigmentation} onSelect={(v: string) => setAnswers(a => ({ ...a, pigmentation: v }))}
            options={[{ val: 'none', label: '없음' }, { val: 'little', label: '약간' }, { val: 'moderate', label: '보통' }, { val: 'severe', label: '심함' }]} />
          <LevelRow label="탄력·주름 상태는?" val={answers.elasticity} onSelect={(v: string) => setAnswers(a => ({ ...a, elasticity: v }))}
            options={[{ val: 'good', label: '좋음' }, { val: 'okay', label: '보통' }, { val: 'sagging', label: '처짐' }, { val: 'wrinkled', label: '주름많음' }]} />

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>세안 후 피부 상태는?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '16px' }}>
            <SelCard val="tight" icon="😣" label="많이 당김" selected={answers.afterWash === 'tight'} onSelect={(v: string) => setAnswers(a => ({ ...a, afterWash: v }))} />
            <SelCard val="moist" icon="😊" label="촉촉함" selected={answers.afterWash === 'moist'} onSelect={(v: string) => setAnswers(a => ({ ...a, afterWash: v }))} />
            <SelCard val="oily" icon="😅" label="번들거림" selected={answers.afterWash === 'oily'} onSelect={(v: string) => setAnswers(a => ({ ...a, afterWash: v }))} />
          </div>
        </div>
      )}

      {/* ─── Q3: 이벤트 + 성별 + 생리/갱년기/임신 ─── */}
      {step === 3 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '10px' }}>최근 피부 이벤트가 있나요?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '16px' }}>
            <SelCard val="none" icon="✨" label="없음" desc="평소와 동일" selected={answers.event === 'none'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="laser" icon="💉" label="레이저·시술" desc="최근 2주 이내" selected={answers.event === 'laser'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="travel" icon="✈️" label="여행" desc="환경 변화" selected={answers.event === 'travel'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
            <SelCard val="season" icon="🌸" label="환절기" desc="계절 변화" selected={answers.event === 'season'} onSelect={(v: string) => setAnswers(a => ({ ...a, event: v }))} />
          </div>

          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '10px' }}>성별을 알려주세요</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: answers.gender !== 'none' ? '14px' : '16px' }}>
            <div onClick={() => setAnswers(a => ({ ...a, gender: 'female', hormoneStatus: '' }))} style={{ flex: 1, padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', background: answers.gender === 'female' ? 'rgba(255,150,180,0.1)' : CARD_BG, border: answers.gender === 'female' ? '1.5px solid rgba(255,150,180,0.35)' : CARD_BORDER }}>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>👩</div>
              <div style={{ fontSize: '12px', fontWeight: answers.gender === 'female' ? 400 : 300, color: answers.gender === 'female' ? 'rgba(255,200,220,0.95)' : '#fff' }}>여성</div>
            </div>
            <div onClick={() => setAnswers(a => ({ ...a, gender: 'male', hormoneStatus: '' }))} style={{ flex: 1, padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', background: answers.gender === 'male' ? 'rgba(100,160,240,0.1)' : CARD_BG, border: answers.gender === 'male' ? '1.5px solid rgba(100,160,240,0.3)' : CARD_BORDER }}>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>👨</div>
              <div style={{ fontSize: '12px', fontWeight: answers.gender === 'male' ? 400 : 300, color: answers.gender === 'male' ? 'rgba(140,190,255,0.9)' : '#fff' }}>남성</div>
            </div>
            <div onClick={() => setAnswers(a => ({ ...a, gender: 'none', hormoneStatus: '' }))} style={{ flex: 1, padding: '12px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', background: answers.gender === 'none' ? CARD_BG : CARD_BG, border: CARD_BORDER }}>
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>🙂</div>
              <div style={{ fontSize: '12px', color: TEXT_MUTED }}>선택안함</div>
            </div>
          </div>

          {/* 여성 → 호르몬 질문 */}
          {answers.gender === 'female' && (
            <div style={{ background: 'rgba(255,150,180,0.05)', border: '1px solid rgba(255,150,180,0.2)', borderRadius: '14px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', color: 'rgba(255,170,190,0.8)', fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '8px' }}>🌸 여성 호르몬 피부 영향</div>
              <div style={{ fontSize: '12px', fontWeight: 400, marginBottom: '10px' }}>
                {isOlderWoman ? '현재 호르몬 상태는?' : '현재 생리 주기 상태는?'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {/* 임신 */}
                <div onClick={() => setAnswers(a => ({ ...a, hormoneStatus: 'pregnant' }))} style={{ padding: '9px 11px', background: answers.hormoneStatus === 'pregnant' ? 'rgba(255,180,200,0.12)' : 'rgba(255,255,255,0.02)', border: answers.hormoneStatus === 'pregnant' ? '1.5px solid rgba(255,180,200,0.4)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>🤰</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: '11px', color: answers.hormoneStatus === 'pregnant' ? 'rgba(255,200,220,0.95)' : '#fff' }}>임신 중</div><div style={{ fontSize: '8px', color: TEXT_DIM }}>안전 성분 · 바디케어 모드로 전환</div></div>
                </div>
                {/* 임신 중이면 추가 질문 */}
                {answers.hormoneStatus === 'pregnant' && (
                  <div style={{ margin: '4px 0', padding: '10px', background: 'rgba(255,180,200,0.05)', border: '1px solid rgba(255,180,200,0.15)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,200,220,0.8)', marginBottom: '6px' }}>임신 몇 주차예요?</div>
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                      {[{ val: 'early', label: '초기\n1~12주' }, { val: 'mid', label: '중기\n13~27주' }, { val: 'late', label: '후기\n28주~' }, { val: 'unknown', label: '모름' }].map(w => (
                        <div key={w.val} onClick={() => setAnswers(a => ({ ...a, pregnancyWeek: w.val as PregnancyWeek }))} style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRadius: '8px', fontSize: '9px', cursor: 'pointer', background: answers.pregnancyWeek === w.val ? 'rgba(255,180,200,0.1)' : CARD_BG, border: answers.pregnancyWeek === w.val ? '1.5px solid rgba(255,180,200,0.35)' : CARD_BORDER, color: answers.pregnancyWeek === w.val ? 'rgba(255,200,220,0.9)' : TEXT_MUTED, lineHeight: 1.4, whiteSpace: 'pre' }}>{w.label}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,200,220,0.8)', marginBottom: '6px' }}>수면 상태는?</div>
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                      {[{ val: 'good', label: '잘 잠' }, { val: 'okay', label: '약간\n불편' }, { val: 'frequent_waking', label: '자주\n깸' }, { val: 'insomnia', label: '불면' }].map(s => (
                        <div key={s.val} onClick={() => setAnswers(a => ({ ...a, sleepQuality: s.val as SleepQuality }))} style={{ flex: 1, padding: '6px 4px', textAlign: 'center', borderRadius: '8px', fontSize: '9px', cursor: 'pointer', background: answers.sleepQuality === s.val ? 'rgba(100,160,240,0.1)' : CARD_BG, border: answers.sleepQuality === s.val ? '1.5px solid rgba(100,160,240,0.3)' : CARD_BORDER, color: answers.sleepQuality === s.val ? 'rgba(140,190,255,0.9)' : TEXT_MUTED, lineHeight: 1.4, whiteSpace: 'pre' }}>{s.label}</div>
                      ))}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,200,220,0.8)', marginBottom: '6px' }}>바디 고민은?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {[{ val: 'belly_stretch', label: '배 튼살' }, { val: 'chest_stretch', label: '가슴 튼살' }, { val: 'thigh_stretch', label: '허벅지 튼살' }, { val: 'dry_body', label: '온몸 건조' }, { val: 'face_acne', label: '얼굴 트러블' }, { val: 'pigmentation', label: '색소침착' }].map(c => (
                        <PillChip key={c.val} label={c.label} selected={answers.pregnancyConcerns.includes(c.val)}
                          onToggle={() => setAnswers(a => ({ ...a, pregnancyConcerns: toggleArr(a.pregnancyConcerns, c.val) }))}
                          color="rgba(255,200,220,0.9)" bg="rgba(255,180,200,0.1)" border="rgba(255,180,200,0.35)" />
                      ))}
                    </div>
                  </div>
                )}
                {/* 일반 생리 주기 */}
                {[
                  { val: 'menstrual', icon: '🩸', label: '생리 중', desc: '민감도↑ 진정 케어 추천' },
                  { val: 'pre_menstrual', icon: '📅', label: '생리 전 (1주일)', desc: '유분↑ 트러블 주의' },
                  { val: 'post_menstrual', icon: '🌿', label: '생리 후 (회복기)', desc: '영양 흡수 최적기' },
                  { val: 'ovulation', icon: '💫', label: '배란기', desc: '피부 컨디션 최상' },
                  ...(userAge >= 40 ? [{ val: 'irregular', icon: '🔄', label: '불규칙 (40대)', desc: '호르몬 변화기 케어' }] : []),
                  ...(isOlderWoman ? [
                    { val: 'menopause_transition', icon: '🌸', label: '갱년기 진행 중', desc: '불규칙·안면홍조·건조증' },
                    { val: 'post_menopause', icon: '🍂', label: '폐경 후 (완전 종료)', desc: '에스트로겐 감소 · 딥리페어' },
                    { val: 'hrt', icon: '💊', label: '호르몬 치료 중 (HRT)', desc: '의약품 병행 주의 성분 안내' },
                    { val: 'still_menstruating', icon: '🌿', label: '아직 생리 중', desc: '일반 주기로 케어' },
                  ] : []),
                  { val: 'unknown', icon: '🤷', label: '잘 모르겠어요', desc: '' },
                ].map((opt: any) => (
                  <div key={opt.val} onClick={() => setAnswers(a => ({ ...a, hormoneStatus: opt.val }))} style={{ padding: '9px 11px', background: answers.hormoneStatus === opt.val ? 'rgba(255,150,180,0.1)' : 'rgba(255,255,255,0.02)', border: answers.hormoneStatus === opt.val ? '1.5px solid rgba(255,150,180,0.35)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '11px', color: answers.hormoneStatus === opt.val ? 'rgba(255,200,220,0.95)' : '#fff' }}>{opt.label}</div>{opt.desc && <div style={{ fontSize: '8px', color: TEXT_DIM }}>{opt.desc}</div>}</div>
                  </div>
                ))}
                {/* 갱년기 증상 선택 */}
                {(answers.hormoneStatus === 'menopause_transition' || answers.hormoneStatus === 'post_menopause') && (
                  <div style={{ padding: '9px', background: 'rgba(200,150,240,0.05)', border: '1px solid rgba(200,150,240,0.15)', borderRadius: '9px' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(210,170,255,0.7)', marginBottom: '6px' }}>관련 피부 증상은?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {[{ val: 'hotflash', label: '🔥 안면홍조' }, { val: 'extreme_dry', label: '💧 극심한 건조' }, { val: 'elasticity_loss', label: '탄력 저하' }, { val: 'pigmentation', label: '색소침착' }, { val: 'itching', label: '가려움증' }, { val: 'sensitivity', label: '민감해짐' }].map(s => (
                        <PillChip key={s.val} label={s.label} selected={answers.menopauseSymptoms.includes(s.val)}
                          onToggle={() => setAnswers(a => ({ ...a, menopauseSymptoms: toggleArr(a.menopauseSymptoms, s.val) }))}
                          color="rgba(210,170,255,0.9)" bg="rgba(200,150,240,0.1)" border="rgba(200,150,240,0.35)" />
                      ))}
                    </div>
                  </div>
                )}
                {/* 생리 중 변화 */}
                {answers.hormoneStatus === 'menstrual' && (
                  <div style={{ padding: '9px', background: 'rgba(255,150,180,0.04)', border: '1px solid rgba(255,150,180,0.15)', borderRadius: '9px' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(255,170,190,0.7)', marginBottom: '6px' }}>생리 중 피부 변화는?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {[{ val: 'acne', label: '트러블 증가' }, { val: 'oily', label: '유분 증가' }, { val: 'sensitive', label: '민감해짐' }, { val: 'none', label: '변화없음' }].map(s => (
                        <PillChip key={s.val} label={s.label} selected={answers.menstrualChanges.includes(s.val)}
                          onToggle={() => setAnswers(a => ({ ...a, menstrualChanges: toggleArr(a.menstrualChanges, s.val) }))}
                          color="rgba(255,200,220,0.9)" bg="rgba(255,150,180,0.1)" border="rgba(255,150,180,0.35)" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 남성 → 면도 질문 */}
          {answers.gender === 'male' && (
            <div style={{ background: 'rgba(100,160,240,0.05)', border: '1px solid rgba(100,160,240,0.15)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', color: 'rgba(120,170,255,0.7)', fontFamily: 'monospace', marginBottom: '8px' }}>👨 남성 피부 특이사항</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>면도로 인한 피부 자극이 있나요?</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[{ val: 'often', label: '자주 있음' }, { val: 'sometimes', label: '가끔' }, { val: 'none', label: '없음' }, { val: 'no_shave', label: '면도안함' }].map(o => (
                  <div key={o.val} onClick={() => setAnswers(a => ({ ...a, hormoneStatus: o.val === 'often' || o.val === 'sometimes' ? 'shaving' : 'no_shaving' }))}
                    style={{ flex: 1, padding: '7px 4px', textAlign: 'center', borderRadius: '8px', fontSize: '9px', cursor: 'pointer', background: answers.hormoneStatus === 'shaving' && (o.val === 'often' || o.val === 'sometimes') ? 'rgba(100,160,240,0.1)' : CARD_BG, border: answers.hormoneStatus === 'shaving' && (o.val === 'often' || o.val === 'sometimes') ? '1.5px solid rgba(100,160,240,0.3)' : CARD_BORDER, color: TEXT_MUTED }}>
                    {o.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Q4: 루틴 + 생활환경 ─── */}
      {step === 4 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '10px' }}>현재 사용 중인 스킨케어 단계는?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
            {[
              { val: 'cleansing', label: '클렌징' }, { val: 'toner', label: '토너' },
              { val: 'serum', label: '세럼·앰플' }, { val: 'eyecream', label: '아이크림' },
              { val: 'moisturizer', label: '수분크림' }, { val: 'sunscreen', label: '선크림' },
              { val: 'mask', label: '마스크팩' }, { val: 'oil', label: '오일' },
            ].map(item => (
              <PillChip key={item.val} label={item.label}
                selected={answers.currentSteps.includes(item.val)}
                onToggle={() => setAnswers(a => ({ ...a, currentSteps: toggleArr(a.currentSteps, item.val) }))} />
            ))}
          </div>

          <LevelRow label="피부 관리 주기는?" val={answers.careFrequency} onSelect={(v: string) => setAnswers(a => ({ ...a, careFrequency: v }))}
            options={[{ val: 'never', label: '안함' }, { val: 'sometimes', label: '가끔' }, { val: 'daily', label: '매일' }, { val: 'professional', label: '전문관리' }]} />

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>🥗 식습관은?</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[{ val: 'balanced', label: '균형잡힘' }, { val: 'instant', label: '인스턴트' }, { val: 'irregular', label: '불규칙' }].map(d => (
              <div key={d.val} onClick={() => setAnswers(a => ({ ...a, diet: d.val }))} style={{ flex: 1, padding: '8px 0', textAlign: 'center', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', background: answers.diet === d.val ? 'rgba(201,169,110,0.12)' : CARD_BG, border: answers.diet === d.val ? '1.5px solid rgba(201,169,110,0.4)' : CARD_BORDER, color: answers.diet === d.val ? GOLD : TEXT_MUTED }}>
                {d.label}
              </div>
            ))}
          </div>

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>🏙 거주 환경은?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '14px' }}>
            <SelCard val="city" icon="🏙️" label="도시" desc="미세먼지 많음" selected={answers.environment === 'city'} onSelect={(v: string) => setAnswers(a => ({ ...a, environment: v }))} />
            <SelCard val="nature" icon="🌿" label="자연환경" desc="공기 맑음" selected={answers.environment === 'nature'} onSelect={(v: string) => setAnswers(a => ({ ...a, environment: v }))} />
            <SelCard val="dry_ac" icon="❄️" label="냉방·건조" desc="실내 건조" selected={answers.environment === 'dry_ac'} onSelect={(v: string) => setAnswers(a => ({ ...a, environment: v }))} />
            <SelCard val="humid" icon="🌊" label="해안·습함" desc="습도 높음" selected={answers.environment === 'humid'} onSelect={(v: string) => setAnswers(a => ({ ...a, environment: v }))} />
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>💆 살롱 피부관리 받고 계신가요?</div>
              <div style={{ fontSize: '9px', color: TEXT_DIM }}>살롱 데이터와 연동해 정확도 향상</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div onClick={() => setAnswers(a => ({ ...a, usingSalon: true }))} style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', background: answers.usingSalon ? 'rgba(201,169,110,0.12)' : CARD_BG, border: answers.usingSalon ? '1.5px solid rgba(201,169,110,0.4)' : CARD_BORDER, color: answers.usingSalon ? GOLD : TEXT_MUTED }}>예</div>
              <div onClick={() => setAnswers(a => ({ ...a, usingSalon: false }))} style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '10px', cursor: 'pointer', background: !answers.usingSalon ? 'rgba(201,169,110,0.12)' : CARD_BG, border: !answers.usingSalon ? '1.5px solid rgba(201,169,110,0.4)' : CARD_BORDER, color: !answers.usingSalon ? GOLD : TEXT_MUTED }}>아니요</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Q5: 생활습관 슬라이더 ─── */}
      {step === 5 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '14px' }}>오늘 하루 상태를 알려주세요</div>
          <SliderRow icon="💧" label="수분 섭취" val={answers.water} min={0} max={10} unit="잔" onSet={(v: number) => setAnswers(a => ({ ...a, water: v }))} />
          <SliderRow icon="😴" label="수면시간" val={answers.sleep} min={3} max={10} unit="시간" onSet={(v: number) => setAnswers(a => ({ ...a, sleep: v }))} />
          <SliderRow icon="☀️" label="자외선 노출" val={answers.uv} min={0} max={4} unit={['없음', '약함', '보통', '강함', '매우강함'][answers.uv] ? '' : ''} onSet={(v: number) => setAnswers(a => ({ ...a, uv: v }))} />
          <SliderRow icon="😤" label="스트레스" val={answers.stress} min={1} max={5} unit={answers.stress === 1 ? ' 없음' : answers.stress === 5 ? ' 매우높음' : '단계'} onSet={(v: number) => setAnswers(a => ({ ...a, stress: v }))} />

          {/* 임신 중이면 아로마 수면 안내 */}
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
          <div style={{ textAlign: 'center', fontSize: '9px', color: TEXT_DIM, marginTop: '6px' }}>5가지 질문 완료 · 약 30초 소요</div>
        </div>
      )}

      {/* 다음 버튼 (Q1~Q4) */}
      {step < 5 && (
        <div style={{ padding: '16px 16px 0' }}>
          <button onClick={handleNext} style={{ width: '100%', padding: '13px', background: GOLD, borderRadius: '12px', fontSize: '13px', fontWeight: 400, color: BG, cursor: 'pointer', border: 'none', fontFamily: "'Noto Sans KR', sans-serif" }}>
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
