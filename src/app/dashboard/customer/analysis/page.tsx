'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const GOLD = '#c9a84c'

const SKIN_TYPES = ['건성', '지성', '복합성', '민감성']
const CONCERNS = ['주름', '색소침착', '모공', '트러블', '탄력', '수분']
const PRODUCT_TYPES = ['클렌징', '토너', '세럼', '크림', '선크림', '마스크']
const LIFESTYLE = {
  sleep: ['5시간 미만', '5–7시간', '7시간 이상'],
  diet: ['불규칙', '보통', '균형'],
  sunscreen: ['거의 안 함', '가끔', '매일'],
}

type Step = 'start' | 'skin_type' | 'concerns' | 'products' | 'irritation' | 'lifestyle' | 'loading' | 'result'

export default function CustomerAnalysisPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<Step>('start')
  const [answers, setAnswers] = useState<{
    skinType: string
    concerns: string[]
    productTypes: string[]
    irritation: boolean | null
    lifestyle: { sleep?: string; diet?: string; sunscreen?: string }
  }>({
    skinType: '',
    concerns: [],
    productTypes: [],
    irritation: null,
    lifestyle: {},
  })
  const [result, setResult] = useState<{ skinType: string; products: any[]; salons: any[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const steps: Step[] = ['start', 'skin_type', 'concerns', 'products', 'irritation', 'lifestyle', 'loading', 'result']
  const stepIndex = steps.indexOf(step)
  const progress = step === 'start' ? 0 : step === 'loading' || step === 'result' ? 100 : (stepIndex / 5) * 100

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer')
        return
      }
    }
    run()
  }, [router, supabase])

  const startAnalysis = () => setStep('skin_type')
  const nextStep = () => {
    if (step === 'skin_type') setStep('concerns')
    else if (step === 'concerns') setStep('products')
    else if (step === 'products') setStep('irritation')
    else if (step === 'irritation') setStep('lifestyle')
    else if (step === 'lifestyle') runAnalysis()
  }

  const runAnalysis = async () => {
    setStep('loading')
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStep('lifestyle')
        setError('로그인이 필요합니다.')
        return
      }
      // 간단 시뮬레이션: 제품/살롱 추천
      const { data: products } = await supabase.from('products').select('id, name, image_url, price').limit(6)
      const { data: salons } = await supabase.from('salons').select('id, name, area').limit(4)
      const analysisResult = {
        skinType: answers.skinType,
        products: products || [],
        salons: salons || [],
      }
      setResult(analysisResult)
      await supabase.from('skin_analysis').insert({
        user_id: user.id,
        skin_type: answers.skinType,
        skin_concerns: answers.concerns,
        lifestyle_data: answers.lifestyle,
        result: analysisResult,
      })
      const { data: u } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (u?.id) await supabase.from('users').update({ skin_type: answers.skinType, skin_concerns: answers.concerns }).eq('id', u.id)
      setStep('result')
    } catch (e: any) {
      setError(e?.message || '분석 저장에 실패했습니다.')
      setStep('lifestyle')
    }
  }

  const canNext = () => {
    if (step === 'skin_type') return !!answers.skinType
    if (step === 'concerns') return answers.concerns.length > 0
    if (step === 'products') return true
    if (step === 'irritation') return answers.irritation !== null
    if (step === 'lifestyle') return true
    return false
  }

  const toggle = (key: 'concerns' | 'productTypes', value: string) => {
    setAnswers((a) => ({
      ...a,
      [key]: a[key].includes(value) ? a[key].filter((x) => x !== value) : [...a[key], value],
    }))
  }

  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: GOLD, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ marginTop: 20, fontSize: 14, color: 'var(--text3)' }}>피부 분석 중...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="피부분석" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        {step !== 'start' && step !== 'result' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: GOLD, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{Math.round(progress)}%</div>
          </div>
        )}

        {step === 'start' && (
          <>
            <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
              <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: '#fff', marginBottom: 8 }}>AI 피부 분석</h1>
              <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>간단한 설문으로 피부 타입과 맞춤 추천을 확인해보세요.</p>
            </div>
            <button
              onClick={startAnalysis}
              style={{ width: '100%', padding: 16, background: GOLD, border: 'none', borderRadius: 14, color: '#0a0a0a', fontSize: 16, fontWeight: 700 }}
            >
              피부 분석 시작하기
            </button>
          </>
        )}

        {step === 'skin_type' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>피부 타입을 선택해주세요</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {SKIN_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setAnswers((a) => ({ ...a, skinType: t }))}
                  style={{
                    padding: '12px 18px',
                    background: answers.skinType === t ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.skinType === t ? GOLD : 'var(--border)'}`,
                    borderRadius: 12,
                    color: answers.skinType === t ? GOLD : 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={nextStep} disabled={!canNext()} style={{ width: '100%', padding: 14, background: canNext() ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canNext() ? '#0a0a0a' : 'var(--text3)', fontWeight: 700 }}>
              다음
            </button>
          </>
        )}

        {step === 'concerns' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>피부 고민을 선택해주세요 (복수 선택)</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {CONCERNS.map((c) => (
                <button
                  key={c}
                  onClick={() => toggle('concerns', c)}
                  style={{
                    padding: '12px 18px',
                    background: answers.concerns.includes(c) ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.concerns.includes(c) ? GOLD : 'var(--border)'}`,
                    borderRadius: 12,
                    color: answers.concerns.includes(c) ? GOLD : 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <button onClick={nextStep} disabled={!canNext()} style={{ width: '100%', padding: 14, background: canNext() ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canNext() ? '#0a0a0a' : 'var(--text3)', fontWeight: 700 }}>
              다음
            </button>
          </>
        )}

        {step === 'products' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>현재 사용 중인 제품 유형 (복수 선택)</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {PRODUCT_TYPES.map((p) => (
                <button
                  key={p}
                  onClick={() => toggle('productTypes', p)}
                  style={{
                    padding: '12px 18px',
                    background: answers.productTypes.includes(p) ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.productTypes.includes(p) ? GOLD : 'var(--border)'}`,
                    borderRadius: 12,
                    color: answers.productTypes.includes(p) ? GOLD : 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <button onClick={nextStep} style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontWeight: 700 }}>
              다음
            </button>
          </>
        )}

        {step === 'irritation' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>피부가 자극에 민감한 편인가요?</h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <button
                onClick={() => setAnswers((a) => ({ ...a, irritation: true }))}
                style={{
                  flex: 1,
                  padding: 14,
                  background: answers.irritation === true ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                  border: `1px solid ${answers.irritation === true ? GOLD : 'var(--border)'}`,
                  borderRadius: 12,
                  color: answers.irritation === true ? GOLD : 'var(--text)',
                  fontSize: 14,
                }}
              >
                예
              </button>
              <button
                onClick={() => setAnswers((a) => ({ ...a, irritation: false }))}
                style={{
                  flex: 1,
                  padding: 14,
                  background: answers.irritation === false ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                  border: `1px solid ${answers.irritation === false ? GOLD : 'var(--border)'}`,
                  borderRadius: 12,
                  color: answers.irritation === false ? GOLD : 'var(--text)',
                  fontSize: 14,
                }}
              >
                아니오
              </button>
            </div>
            <button onClick={nextStep} disabled={!canNext()} style={{ width: '100%', padding: 14, background: canNext() ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canNext() ? '#0a0a0a' : 'var(--text3)', fontWeight: 700 }}>
              다음
            </button>
          </>
        )}

        {step === 'lifestyle' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 12 }}>라이프스타일</h2>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>수면</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {LIFESTYLE.sleep.map((s) => (
                  <button
                    key={s}
                    onClick={() => setAnswers((a) => ({ ...a, lifestyle: { ...a.lifestyle, sleep: s } }))}
                    style={{
                      padding: '10px 14px',
                      background: answers.lifestyle.sleep === s ? 'rgba(201,168,76,0.2)' : 'var(--bg3)',
                      border: `1px solid ${answers.lifestyle.sleep === s ? GOLD : 'var(--border)'}`,
                      borderRadius: 10,
                      color: answers.lifestyle.sleep === s ? GOLD : 'var(--text)',
                      fontSize: 13,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>식습관</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {LIFESTYLE.diet.map((d) => (
                  <button
                    key={d}
                    onClick={() => setAnswers((a) => ({ ...a, lifestyle: { ...a.lifestyle, diet: d } }))}
                    style={{
                      padding: '10px 14px',
                      background: answers.lifestyle.diet === d ? 'rgba(201,168,76,0.2)' : 'var(--bg3)',
                      border: `1px solid ${answers.lifestyle.diet === d ? GOLD : 'var(--border)'}`,
                      borderRadius: 10,
                      color: answers.lifestyle.diet === d ? GOLD : 'var(--text)',
                      fontSize: 13,
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>자외선 차단</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {LIFESTYLE.sunscreen.map((s) => (
                  <button
                    key={s}
                    onClick={() => setAnswers((a) => ({ ...a, lifestyle: { ...a.lifestyle, sunscreen: s } }))}
                    style={{
                      padding: '10px 14px',
                      background: answers.lifestyle.sunscreen === s ? 'rgba(201,168,76,0.2)' : 'var(--bg3)',
                      border: `1px solid ${answers.lifestyle.sunscreen === s ? GOLD : 'var(--border)'}`,
                      borderRadius: 10,
                      color: answers.lifestyle.sunscreen === s ? GOLD : 'var(--text)',
                      fontSize: 13,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {error && <p style={{ fontSize: 12, color: '#e08080', marginBottom: 12 }}>{error}</p>}
            <button onClick={nextStep} style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontWeight: 700 }}>
              분석하기
            </button>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ padding: '20px 0' }}>
              <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 8 }}>피부 타입 진단</h2>
              <div style={{ padding: 16, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 14, marginBottom: 24 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>🧬 {result.skinType}</span>
              </div>
              {result.products.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>맞춤 추천 제품</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.products.slice(0, 5).map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        {p.image_url && <img src={p.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{p.name}</div>
                          {p.price != null && <div style={{ fontSize: 11, color: 'var(--text3)' }}>₩{Number(p.price).toLocaleString()}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {result.salons && result.salons.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>추천 살롱 시술</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.salons.slice(0, 4).map((s: any) => (
                      <div key={s.id} style={{ padding: 12, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.name}</div>
                        {s.area && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.area}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('start')} style={{ flex: 1, padding: 14, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14 }}>
                다시 분석
              </button>
              <button onClick={() => router.push('/dashboard/customer')} style={{ flex: 1, padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontWeight: 700, fontSize: 14 }}>
                결과 저장·공유
              </button>
            </div>
          </>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
