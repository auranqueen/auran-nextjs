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

// KST 기준 오늘 날짜 문자열 (yyyy-mm-dd)
function todayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

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

  // 1일1회 제한 상태
  const [todayDone, setTodayDone] = useState(false)
  const [todayDoneLoading, setTodayDoneLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRowId, setUserRowId] = useState<string | null>(null)

  const steps: Step[] = ['start', 'skin_type', 'concerns', 'products', 'irritation', 'lifestyle', 'loading', 'result']
  const stepIndex = steps.indexOf(step)
  const progress = step === 'start' ? 0 : step === 'loading' || step === 'result' ? 100 : (stepIndex / 5) * 100

  // 로그인 확인 + 오늘 분석 여부 체크
  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?role=customer'); return }
      setUserId(user.id)

      // users 테이블에서 row id 가져오기
      const { data: u } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (u?.id) setUserRowId(u.id)

      // 오늘(KST) 이미 분석했는지 확인
      const today = todayKST()
      const { data: existing } = await supabase
        .from('skin_analysis')
        .select('id, created_at')
        .eq('user_id', user.id)
        .gte('created_at', `${today}T00:00:00+09:00`)
        .lte('created_at', `${today}T23:59:59+09:00`)
        .limit(1)
        .maybeSingle()

      if (existing) setTodayDone(true)
      setTodayDoneLoading(false)
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startAnalysis = () => {
    if (todayDone) return
    setStep('skin_type')
  }

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
      if (!userId) {
        setStep('lifestyle')
        setError('로그인이 필요합니다.')
        return
      }

      // -- 서버사이드 2중 체크: 오늘 이미 했으면 차단 --
      const today = todayKST()
      const { data: dupCheck } = await supabase
        .from('skin_analysis')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00+09:00`)
        .lte('created_at', `${today}T23:59:59+09:00`)
        .limit(1)
        .maybeSingle()

      if (dupCheck) {
        setTodayDone(true)
        setStep('start')
        setError('오늘 이미 분석을 완료했습니다. 내일 다시 시도해주세요.')
        return
      }

      // 제품/살롱 추천
      const { data: products } = await supabase
        .from('products')
        .select('id, name, thumb_img, retail_price, brands(name)')
        .eq('status', 'active')
        .limit(6)
      const { data: salons } = await supabase
        .from('salons')
        .select('id, name, area')
        .limit(4)

      const analysisResult = {
        skinType: answers.skinType,
        products: products || [],
        salons: salons || [],
      }

      // skin_analysis 저장
      await supabase.from('skin_analysis').insert({
        user_id: userId,
        skin_type: answers.skinType,
        skin_concerns: answers.concerns,
        lifestyle_data: answers.lifestyle,
        result: analysisResult,
      })

      // users 테이블 업데이트
      if (userRowId) {
        await supabase
          .from('users')
          .update({ skin_type: answers.skinType, skin_concerns: answers.concerns })
          .eq('id', userRowId)

        // -- 500P 포인트 지급 --
        const { data: pointRow } = await supabase
          .from('point_history')
          .insert({
            user_id: userRowId,
            type: 'earn',
            amount: 500,
            description: 'AI 피부 분석 완료',
          })
          .select()
          .single()

        if (pointRow) {
          // 알림장 기록
          await supabase.from('notifications').insert({
            user_id: userRowId,
            type: 'point',
            title: '500P 적립!',
            body: 'AI 피부 분석 완료로 500포인트가 적립되었습니다.',
            is_read: false,
          })
        }
      }

      setResult(analysisResult)
      setTodayDone(true)
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

  // -- 로딩 화면 --
  if (step === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
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

        {/* 프로그레스 바 */}
        {step !== 'start' && step !== 'result' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: GOLD, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{Math.round(progress)}%</div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div style={{
            background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            color: '#e57373', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* -- START -- */}
        {step === 'start' && (
          <>
            <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
              <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: '#fff', marginBottom: 8 }}>
                AI 피부 분석
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
                간단한 설문으로 피부 타입과 맞춤 추천을 확인해보세요.<br />
                <span style={{ color: GOLD, fontWeight: 700 }}>완료 시 500P 적립!</span>
              </p>
            </div>

            {/* 1일1회 제한 안내 */}
            {!todayDoneLoading && todayDone ? (
              <div style={{
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: 16, padding: 20, textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
                  오늘 분석 완료!
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 16 }}>
                  내일 다시 도전하시면<br />500P를 추가로 적립할 수 있어요.
                </div>
                <button
                  onClick={() => router.push('/products')}
                  style={{
                    width: '100%', padding: 14, background: GOLD, border: 'none',
                    borderRadius: 12, color: '#0a0a0a', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  추천 제품 보러 가기 →
                </button>
              </div>
            ) : (
              <button
                onClick={startAnalysis}
                disabled={todayDoneLoading}
                style={{
                  width: '100%', padding: 16,
                  background: todayDoneLoading ? 'var(--bg3)' : GOLD,
                  border: 'none', borderRadius: 14,
                  color: todayDoneLoading ? 'var(--text3)' : '#0a0a0a',
                  fontSize: 16, fontWeight: 700, cursor: todayDoneLoading ? 'wait' : 'pointer',
                }}
              >
                {todayDoneLoading ? '확인 중...' : '피부 분석 시작하기'}
              </button>
            )}
          </>
        )}

        {/* -- SKIN TYPE -- */}
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
                    borderRadius: 12, color: answers.skinType === t ? GOLD : 'var(--text)', fontSize: 14, cursor: 'pointer',
                  }}
                >{t}</button>
              ))}
            </div>
            <button
              onClick={nextStep}
              disabled={!canNext()}
              style={{ width: '100%', padding: 14, background: canNext() ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canNext() ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed' }}
            >다음</button>
          </>
        )}

        {/* -- CONCERNS -- */}
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
                    borderRadius: 12, color: answers.concerns.includes(c) ? GOLD : 'var(--text)', fontSize: 14, cursor: 'pointer',
                  }}
                >{c}</button>
              ))}
            </div>
            <button
              onClick={nextStep}
              disabled={!canNext()}
              style={{ width: '100%', padding: 14, background: canNext() ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canNext() ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed' }}
            >다음</button>
          </>
        )}

        {/* -- PRODUCTS -- */}
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
                    borderRadius: 12, color: answers.productTypes.includes(p) ? GOLD : 'var(--text)', fontSize: 14, cursor: 'pointer',
                  }}
                >{p}</button>
              ))}
            </div>
            <button
              onClick={nextStep}
              style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer' }}
            >다음</button>
          </>
        )}

        {/* -- IRRITATION -- */}
        {step === 'irritation' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>피부가 자극에 민감한 편인가요?</h2>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {[{ label: '예', value: true }, { label: '아니오', value: false }].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setAnswers((a) => ({ ...a, irritation: value }))}
                  style={{
                    flex: 1, padding: 14,
                    background: answers.irritation === value ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.irritation === value ? GOLD : 'var(--border)'}`,
                    borderRadius: 12, color: answers.irritation === value ? GOLD : 'var(--text)', fontSize: 14, cursor: 'pointer',
                  }}
                >{label}</button>
              ))}
            </div>
            <button
              onClick={nextStep}
              disabled={!canNext()}
              style={{ width: '100%', padding: 14, background: canNext() ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canNext() ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, cursor: canNext() ? 'pointer' : 'not-allowed' }}
            >다음</button>
          </>
        )}

        {/* -- LIFESTYLE -- */}
        {step === 'lifestyle' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 16 }}>생활 습관을 알려주세요</h2>
            {(['sleep', 'diet', 'sunscreen'] as const).map((key) => {
              const labels: Record<string, string> = { sleep: '수면 시간', diet: '식습관', sunscreen: '선크림 사용' }
              return (
                <div key={key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>{labels[key]}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {LIFESTYLE[key].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAnswers((a) => ({ ...a, lifestyle: { ...a.lifestyle, [key]: opt } }))}
                        style={{
                          padding: '10px 14px',
                          background: answers.lifestyle[key] === opt ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                          border: `1px solid ${answers.lifestyle[key] === opt ? GOLD : 'var(--border)'}`,
                          borderRadius: 10, color: answers.lifestyle[key] === opt ? GOLD : 'var(--text)', fontSize: 13, cursor: 'pointer',
                        }}
                      >{opt}</button>
                    ))}
                  </div>
                </div>
              )
            })}
            <button
              onClick={nextStep}
              style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
            >
              분석 완료 → 500P 적립
            </button>
          </>
        )}

        {/* -- RESULT -- */}
        {step === 'result' && result && (
          <div>
            {/* 완료 배너 */}
            <div style={{
              background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 16, padding: 20, textAlign: 'center', marginBottom: 24,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>분석 완료!</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
                피부 타입: <span style={{ color: GOLD, fontWeight: 700 }}>{result.skinType}</span>
              </div>
              <div style={{
                display: 'inline-block', background: GOLD, borderRadius: 999,
                padding: '4px 14px', fontSize: 13, fontWeight: 900, color: '#0a0a0a',
              }}>
                +500P 적립 완료 🎉
              </div>
            </div>

            {/* 추천 제품 */}
            {result.products.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 12 }}>맞춤 추천 제품</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.products.slice(0, 4).map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/products/${p.id}`)}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12, padding: 12, display: 'flex', gap: 12, cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(0,0,0,0.3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.thumb_img
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                          : <span style={{ fontSize: 20, opacity: 0.4 }}>🧴</span>
                        }
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: GOLD, fontFamily: "'JetBrains Mono', monospace" }}>
                          ₩{(p.retail_price || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/products')}
              style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              전제품 보러 가기 →
            </button>
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
