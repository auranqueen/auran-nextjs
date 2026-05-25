'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PRIMARY = '#7B5EA7'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

const selBtn = (on: boolean): CSSProperties => ({
  border: on ? `1px solid ${PRIMARY}` : '1px solid rgba(255,255,255,0.12)',
  color: on ? '#c4a7e7' : 'rgba(255,255,255,0.65)',
  background: on ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.04)',
  fontSize: 12,
  padding: '8px 11px',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 400,
  fontFamily: "'Noto Sans KR', sans-serif",
})

function toggleArr(arr: string[], val: string, max = 99) {
  if (arr.includes(val)) return arr.filter((x) => x !== val)
  if (arr.length >= max) return arr
  return [...arr, val]
}

function parseBodyStatus(raw: unknown): string {
  if (Array.isArray(raw)) return String(raw[0] || '')
  if (typeof raw === 'string' && raw.trim()) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    return parts[0] || ''
  }
  return ''
}

export default function MyTrackPage() {
  const router = useRouter()
  const supabase = createClient()

  const [authId, setAuthId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')

  const [skinType, setSkinType] = useState('')
  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [allergyIngredients, setAllergyIngredients] = useState<string[]>([])
  const [careStyle, setCareStyle] = useState('')
  const [procedureHistory, setProcedureHistory] = useState<string[]>([])
  const [menstrualCycle, setMenstrualCycle] = useState('')
  const [periodPain, setPeriodPain] = useState('')

  const [expandExtra, setExpandExtra] = useState(false)
  const [birthControl, setBirthControl] = useState('')
  const [pmsLevel, setPmsLevel] = useState('')
  const [drinkFrequency, setDrinkFrequency] = useState('')
  const [exerciseFrequency, setExerciseFrequency] = useState('')
  const [smoke, setSmoke] = useState(false)
  const [stressLevel, setStressLevel] = useState('')
  const [waterIntake, setWaterIntake] = useState('')
  const [environment, setEnvironment] = useState('')
  const [washCount, setWashCount] = useState('')

  const [skinTypeMemo, setSkinTypeMemo] = useState('')
  const [skinConcernMemo, setSkinConcernMemo] = useState('')
  const [allergyMemo, setAllergyMemo] = useState('')
  const [careMemo, setCareMemo] = useState('')
  const [procedureMemo, setProcedureMemo] = useState('')
  const [cycleMemo, setCycleMemo] = useState('')
  const [menstrualMemo, setMenstrualMemo] = useState('')
  const [lifestyleMemo, setLifestyleMemo] = useState('')

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.push('/login')
        return
      }
      setAuthId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'skin_type, skin_concerns, allergy_ingredients, body_status, procedure_history, menstrual_cycle, stress_level, drink_frequency, exercise_frequency, smoke'
        )
        .eq('auth_id', user.id)
        .maybeSingle()

      if (profile) {
        setSkinType(String(profile.skin_type ?? ''))
        setSkinConcerns(Array.isArray(profile.skin_concerns) ? (profile.skin_concerns as string[]) : [])
        setAllergyIngredients(
          Array.isArray(profile.allergy_ingredients) ? (profile.allergy_ingredients as string[]) : []
        )
        setCareStyle(parseBodyStatus(profile.body_status))
        setProcedureHistory(
          Array.isArray(profile.procedure_history) ? (profile.procedure_history as string[]) : []
        )
        setMenstrualCycle(String(profile.menstrual_cycle ?? ''))
        setDrinkFrequency(String(profile.drink_frequency ?? ''))
        setExerciseFrequency(String(profile.exercise_frequency ?? ''))
        setSmoke(!!profile.smoke)
        setStressLevel(String(profile.stress_level ?? ''))
      }
      setLoading(false)
    }
    void run()
  }, [router])

  const validateStep1 = () => {
    if (!skinType) return '피부타입을 선택해주세요'
    if (skinConcerns.length === 0) return '피부고민을 1개 이상 선택해주세요'
    if (allergyIngredients.length === 0) return '알레르기 성분을 선택해주세요'
    if (!careStyle) return '케어스타일을 선택해주세요'
    if (procedureHistory.length === 0) return '시술 경험을 선택해주세요'
    if (!menstrualCycle) return '피부 변화 주기를 선택해주세요'
    if (!periodPain) return '마법 같은 그날 컨디션은요? 🔮를 선택해주세요'
    return ''
  }

  const goNext = () => {
    const msg = validateStep1()
    if (msg) {
      setError(msg)
      return
    }
    setError('')
    setStep(2)
    window.scrollTo(0, 0)
  }

  const persist = async () => {
    if (!authId) return
    const msg = validateStep1()
    if (msg) {
      setError(msg)
      setStep(1)
      return
    }
    setSaving(true)
    setError('')
    const { error: upErr } = await supabase
      .from('profiles')
      .update({
        skin_type: skinType || null,
        skin_concerns: skinConcerns,
        allergy_ingredients: allergyIngredients,
        body_status: careStyle || null,
        procedure_history: procedureHistory,
        menstrual_cycle: menstrualCycle || null,
        stress_level: stressLevel || null,
        drink_frequency: drinkFrequency || null,
        exercise_frequency: exerciseFrequency || null,
        smoke,
        skin_type_memo: skinTypeMemo,
        skin_concern_memo: skinConcernMemo,
        allergy_memo: allergyMemo,
        care_memo: careMemo,
        procedure_memo: procedureMemo,
        cycle_memo: cycleMemo,
        menstrual_memo: menstrualMemo,
        lifestyle_memo: lifestyleMemo,
      } as any)
      .eq('auth_id', authId)
    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    router.push('/my')
  }

  const chipRow = (options: string[], selected: string | string[], onPick: (v: string) => void, multi = false) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const on = multi ? (selected as string[]).includes(opt) : selected === opt
        return (
          <button
            key={opt}
            type="button"
            className="btn"
            style={selBtn(on)}
            onClick={() => onPick(opt)}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )

  const section = (title: string, hint: string | null, children: ReactNode) => (
    <section style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: '#fff', marginBottom: hint ? 4 : 10 }}>{title}</div>
      {hint ? <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 10, lineHeight: 1.5 }}>{hint}</div> : null}
      {children}
    </section>
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 400, color: '#fff', paddingBottom: 160 }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'rgba(13,11,9,0.96)',
          borderBottom: CARD_BORDER,
        }}
      >
        <button
          type="button"
          onClick={() => (step > 1 ? setStep(1) : router.back())}
          style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 22, cursor: 'pointer', padding: 0 }}
        >
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, color: '#fff' }}>내 피부 트랙</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>{step} / 2</div>
        </div>
      </header>

      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? PRIMARY : 'rgba(255,255,255,0.08)' }}
            />
          ))}
        </div>

        {error ? (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <>
            {section('1. 피부타입', '하나만 선택해주세요', <>
              {chipRow(['건성', '지성', '복합성', '민감성', '정상'], skinType, setSkinType)}
              <textarea
                value={skinTypeMemo}
                onChange={(e) => setSkinTypeMemo(e.target.value)}
                placeholder="더 자세히 알려주세요 (선택)"
                style={{
                  width: '100%',
                  minHeight: 72,
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </>)}
            {section('2. 피부고민', '복수 선택 가능', <>
              {chipRow(['피부 변화', '모공', '색소침착', '주름', '건조', '유분', '민감'], skinConcerns, (v) => setSkinConcerns((p) => toggleArr(p, v)), true)}
              <textarea
                value={skinConcernMemo}
                onChange={(e) => setSkinConcernMemo(e.target.value)}
                placeholder="더 자세히 알려주세요 (선택)"
                style={{
                  width: '100%',
                  minHeight: 72,
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </>)}
            {section('3. 알레르기 성분', '복수 선택 가능', <>
              {chipRow(['파라벤', '알코올', '향료', '실리콘', '없음'], allergyIngredients, (v) => setAllergyIngredients((p) => toggleArr(p, v)), true)}
              <textarea
                value={allergyMemo}
                onChange={(e) => setAllergyMemo(e.target.value)}
                placeholder="더 자세히 알려주세요 (선택)"
                style={{
                  width: '100%',
                  minHeight: 72,
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </>)}
            {section(
              '4. 케어스타일',
              null,
              <>
                {chipRow(['임신·수유 중이에요', '갱년기 케어 중이에요', '일반 케어로 할게요', '해당없어요'], careStyle, setCareStyle)}
                <textarea
                  value={careMemo}
                  onChange={(e) => setCareMemo(e.target.value)}
                  placeholder="더 자세히 알려주세요 (선택)"
                  style={{
                    width: '100%',
                    minHeight: 72,
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.3)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </>
            )}
            {section(
              '5. 시술 경험',
              '복수 선택 가능',
              <>
                {chipRow(['보톡스·필러 경험', '레이저 시술 경험', '리프팅 시술 경험', '없음'], procedureHistory, (v) => setProcedureHistory((p) => toggleArr(p, v)), true)}
                <textarea
                  value={procedureMemo}
                  onChange={(e) => setProcedureMemo(e.target.value)}
                  placeholder="더 자세히 알려주세요 (선택)"
                  style={{
                    width: '100%',
                    minHeight: 72,
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.3)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </>
            )}
            {section(
              '6. 피부 변화 주기',
              null,
              <>
                {chipRow(['생리 전에 많이 변해요', '불규칙해요', '항상 변화가 있어요', '없어요'], menstrualCycle, setMenstrualCycle)}
                <textarea
                  value={cycleMemo}
                  onChange={(e) => setCycleMemo(e.target.value)}
                  placeholder="더 자세히 알려주세요 (선택)"
                  style={{
                    width: '100%',
                    minHeight: 72,
                    marginTop: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.3)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontSize: 13,
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </>
            )}
            {section('7. 마법 같은 그날 컨디션은요? 🔮', null, <>
              {chipRow(['편안해요', '약간 불편해요', '많이 불편해요'], periodPain, setPeriodPain)}
              <textarea
                value={menstrualMemo}
                onChange={(e) => setMenstrualMemo(e.target.value)}
                placeholder="더 자세히 알려주세요 (선택)"
                style={{
                  width: '100%',
                  minHeight: 72,
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </>)}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12, lineHeight: 1.55 }}>
              라이프스타일을 알려주시면 추천이 더 정교해져요. 선택 항목은 저장 시 프로필에 반영됩니다.
            </div>

            <button
              type="button"
              onClick={() => setExpandExtra((v) => !v)}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: '11px 12px',
                borderRadius: 10,
                border: `1px solid rgba(123,94,167,0.35)`,
                background: 'rgba(123,94,167,0.08)',
                color: '#c4a7e7',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {expandExtra ? '▾ 추가 질문 접기' : '▸ 추가 질문 펼치기 (호르몬 약 · 생리 전 피부 변화 · 수분 · 환경 · 세안)'}
            </button>

            {expandExtra ? (
              <>
                {section('8. 호르몬 약 복용 여부', null, chipRow(['복용 중이에요', '복용 안 해요'], birthControl, setBirthControl))}
                {section('9. 생리 전 피부 변화', null, chipRow(['변화 없어요', '약간 변해요', '많이 변해요'], pmsLevel, setPmsLevel))}
                {section('14. 물 섭취량', null, chipRow(['적음(1L미만)', '보통(1~2L)', '많음(2L이상)'], waterIntake, setWaterIntake))}
                {section(
                  '15. 주로 있는 환경',
                  null,
                  chipRow(['실내만', '실외 30분이하', '1~2시간', '2시간+'], environment, setEnvironment)
                )}
                {section('16. 하루 세안 횟수', null, chipRow(['1회', '2회', '3회이상'], washCount, setWashCount))}
              </>
            ) : null}

            {section('10. 음주 빈도', null, chipRow(['거의안함', '월1~2회', '주1~2회', '거의매일'], drinkFrequency, setDrinkFrequency))}
            {section('11. 운동 빈도', null, chipRow(['거의안함', '주1~2회', '주3~4회', '매일'], exerciseFrequency, setExerciseFrequency))}
            {section(
              '12. 흡연',
              null,
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{smoke ? '흡연함' : '비흡연'}</span>
                <button
                  type="button"
                  onClick={() => setSmoke((v) => !v)}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 999,
                    border: 'none',
                    background: smoke ? PRIMARY : 'rgba(255,255,255,0.15)',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: smoke ? 22 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.15s',
                    }}
                  />
                </button>
              </div>
            )}
            {section('13. 스트레스', null, <>
              {chipRow(['낮음', '보통', '높음', '매우높음'], stressLevel, setStressLevel)}
              <textarea
                value={lifestyleMemo}
                onChange={(e) => setLifestyleMemo(e.target.value)}
                placeholder="더 자세히 알려주세요 (선택)"
                style={{
                  width: '100%',
                  minHeight: 72,
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text)',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </>)}
          </>
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 60,
          maxWidth: 390,
          margin: '0 auto',
          padding: '12px 14px 16px',
          background: 'linear-gradient(180deg, transparent, rgba(13,11,9,0.97) 24%)',
          zIndex: 30,
        }}
      >
        {step === 1 ? (
          <button
            type="button"
            onClick={goNext}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: PRIMARY,
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            다음 →
          </button>
        ) : (
          <button
            type="button"
            disabled={saving || !authId}
            onClick={() => void persist()}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              background: PRIMARY,
              color: '#fff',
              fontSize: 14,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        )}
      </div>
    </div>
  )
}
