'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { broadcastCartCountRefresh } from '@/lib/cartEvents'
import { useAdminSettings } from '@/hooks/useAdminSettings'

const GOLD = '#c9a84c'

type Step = 'start' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'loading' | 'result'

type Scores = {
  dry: number
  oily: number
  combo: number
  acne: number
  sensitive: number
  pigment: number
  aging: number
}

type Q1Key = 'dry3' | 'dry1_combo1' | 'combo2' | 'combo2_from_normal' | 'oily3'
type Q3Key = 'q3_dry2' | 'q3_normal2' | 'q3_combo2' | 'q3_oily3'
type Q4Key = 'q4_normal1' | 'q4_pigment2' | 'q4_acne3' | 'q4_acne2_pigment2'

type Q2Key = 'dry2' | 'acne2' | 'oily1_acne1' | 'pigment2' | 'sensitive2' | 'aging2'

type Q5SleepKey = 'sleep_lt5' | 'sleep_5_7' | 'sleep_gt7'
type Q5DietKey = 'diet_unbalanced_acne1' | 'diet_mid' | 'diet_balanced_normal1'
type Q5SunscreenKey = 'sunscreen_none_pigment1_aging1' | 'sunscreen_some_mid' | 'sunscreen_daily_normal1'

type Lifestyle = {
  sleep: Q5SleepKey | null
  diet: Q5DietKey | null
  sunscreen: Q5SunscreenKey | null
}

type Answers = {
  q1: Q1Key | null
  q2: Q2Key[]
  q3: Q3Key | null
  q4: Q4Key | null
  q5: Lifestyle
}

type ProductRow = {
  id: string
  name: string
  thumb_img?: string | null
  retail_price?: number | null
  description?: string | null
  category?: string | null
  brands?: { name?: string | null } | null
  skin_types?: string[] | null
  age_groups?: string[] | null
  quiz_match?: string[] | null
  sales_count?: number | null
}

function initialScores(): Scores {
  return { dry: 0, oily: 0, combo: 0, acne: 0, sensitive: 0, pigment: 0, aging: 0 }
}

function applyDelta(scores: Scores, delta: Partial<Scores>) {
  for (const k of Object.keys(delta) as (keyof Scores)[]) {
    const v = delta[k]
    if (typeof v === 'number') scores[k] += v
  }
}

function computeFinalSkinType(scores: Scores): string {
  const antiTotal = scores.pigment + scores.aging
  const maxOther = Math.max(scores.dry, scores.oily, scores.combo, scores.acne, scores.sensitive)

  // pigment+aging가 단독 최대면 안티에이징형
  if (antiTotal > maxOther) return '안티에이징형'
  // 동점이면 복합성
  if (antiTotal === maxOther) return '복합성'

  const max = maxOther
  const cats = [
    ['dry', scores.dry],
    ['oily', scores.oily],
    ['combo', scores.combo],
    ['acne', scores.acne],
    ['sensitive', scores.sensitive],
  ].filter(([, v]) => v === max)

  if (cats.length >= 2) return '복합성'

  const cat = cats[0]?.[0]
  switch (cat) {
    case 'dry':
      return '건성'
    case 'oily':
      return '지성'
    case 'combo':
      return '복합성'
    case 'acne':
      return '트러블성'
    case 'sensitive':
      return '민감성'
    default:
      return '복합성'
  }
}

function progressForStep(step: Step) {
  if (step === 'start') return 0
  if (step === 'loading') return 100
  if (step === 'result') return 100
  if (step === 'q1') return 20
  if (step === 'q2') return 40
  if (step === 'q3') return 60
  if (step === 'q4') return 80
  if (step === 'q5') return 100
  return 0
}

function productText(p: ProductRow) {
  return `${p.name || ''} ${p.description || ''} ${p.category || ''}`.toLowerCase()
}

function normalizeTypeLabel(v: string) {
  if (v === '안티에이징형') return '안티에이징'
  return v
}

function careStepsForSkinType(skinType: string): Array<{ title: string; keywords: string[] }> {
  const t = normalizeTypeLabel(skinType)
  if (t === '건성') return [
    { title: '클렌징', keywords: ['클렌징'] },
    { title: '토너', keywords: ['토너'] },
    { title: '세럼', keywords: ['세럼', '앰플', '에센스'] },
    { title: '크림', keywords: ['크림', '보습'] },
    { title: '오일', keywords: ['오일'] },
    { title: '마스크', keywords: ['마스크', '팩'] },
  ]
  if (t === '지성') return [
    { title: '클렌징', keywords: ['클렌징'] },
    { title: '토너', keywords: ['토너'] },
    { title: '세럼', keywords: ['세럼', '앰플'] },
    { title: '수분크림', keywords: ['수분크림', '젤크림', '크림'] },
    { title: '선크림', keywords: ['선크림', '선케어'] },
  ]
  if (t === '복합성') return [
    { title: '클렌징', keywords: ['클렌징'] },
    { title: '토너', keywords: ['토너'] },
    { title: '앰플', keywords: ['앰플'] },
    { title: '세럼', keywords: ['세럼', '에센스'] },
    { title: '크림', keywords: ['크림'] },
    { title: '마스크', keywords: ['마스크', '팩'] },
  ]
  if (t === '민감성') return [
    { title: '클렌징', keywords: ['클렌징'] },
    { title: '진정토너', keywords: ['진정토너', '토너', '시카'] },
    { title: '세럼', keywords: ['세럼', '앰플'] },
    { title: '크림', keywords: ['크림'] },
    { title: '선크림', keywords: ['선크림', '선케어'] },
  ]
  if (t === '트러블성') return [
    { title: '클렌징', keywords: ['클렌징'] },
    { title: '토너', keywords: ['토너'] },
    { title: '트러블세럼', keywords: ['트러블세럼', '세럼', '앰플'] },
    { title: '수분크림', keywords: ['수분크림', '젤크림', '크림'] },
    { title: '마스크', keywords: ['마스크', '팩'] },
  ]
  return [
    { title: '클렌징', keywords: ['클렌징'] },
    { title: '에센스', keywords: ['에센스'] },
    { title: '앰플', keywords: ['앰플'] },
    { title: '크림', keywords: ['크림'] },
    { title: '아이크림', keywords: ['아이크림'] },
    { title: '선크림', keywords: ['선크림', '선케어'] },
  ]
}

function calcMatchRate(p: ProductRow, skinType: string, ageGroup: string, quizTags: string[]) {
  let score = 0
  if (Array.isArray(p.skin_types) && p.skin_types.includes(skinType)) score += 40
  if (ageGroup && Array.isArray(p.age_groups) && p.age_groups.includes(ageGroup)) score += 20
  const productTags = Array.isArray(p.quiz_match) ? p.quiz_match : []
  if (quizTags.some(t => productTags.includes(t))) score += 40
  return Math.min(100, score)
}

const Q1_OPTIONS: Array<{ key: Q1Key; label: string }> = [
  { key: 'dry3', label: '😌 당기고 건조해요' },
  { key: 'dry1_combo1', label: '😊 약간 당기지만 금방 괜찮아져요' },
  { key: 'combo2', label: '🌊 T존만 번들거려요' },
  { key: 'combo2_from_normal', label: '💦 전체적으로 촉촉해요' },
  { key: 'oily3', label: '🫧 금방 번들거리고 끈적여요' },
]

const Q2_OPTIONS: Array<{ key: Q2Key; label: string }> = [
  { key: 'dry2', label: '💧 건조함·당김' },
  { key: 'acne2', label: '🔴 트러블·여드름' },
  { key: 'oily1_acne1', label: '🕳 모공·블랙헤드' },
  { key: 'pigment2', label: '🟤 잡티·색소침착' },
  { key: 'sensitive2', label: '😣 홍조·민감' },
  { key: 'aging2', label: '📉 탄력저하·주름' },
]

const Q3_OPTIONS: Array<{ key: Q3Key; label: string }> = [
  { key: 'q3_dry2', label: '✨ 모공이 거의 안 보이고 깨끗해요' },
  { key: 'q3_normal2', label: '😊 약간 보이지만 신경 안 써요' },
  { key: 'q3_combo2', label: '🌊 T존이 번들거리고 모공이 보여요' },
  { key: 'q3_oily3', label: '🫧 전체 번들거리고 모공이 커요' },
]

const Q4_OPTIONS: Array<{ key: Q4Key; label: string }> = [
  { key: 'q4_normal1', label: '😌 크게 신경 쓰이지 않아요' },
  { key: 'q4_pigment2', label: '🟤 잡티·기미가 약간 신경 쓰여요' },
  { key: 'q4_acne3', label: '🔴 트러블이 자주 생겨요' },
  { key: 'q4_acne2_pigment2', label: '😣 색소·트러블 둘 다 심해요' },
]

const Q5_SLEEP: Array<{ key: Q5SleepKey; label: string }> = [
  { key: 'sleep_lt5', label: '5시간 미만' },
  { key: 'sleep_5_7', label: '5~7시간' },
  { key: 'sleep_gt7', label: '7시간 이상' },
]

const Q5_DIET: Array<{ key: Q5DietKey; label: string }> = [
  { key: 'diet_unbalanced_acne1', label: '불규칙·인스턴트 많음' },
  { key: 'diet_mid', label: '보통' },
  { key: 'diet_balanced_normal1', label: '균형 잡힌 식단' },
]

const Q5_SUN: Array<{ key: Q5SunscreenKey; label: string }> = [
  { key: 'sunscreen_none_pigment1_aging1', label: '거의 안 함' },
  { key: 'sunscreen_some_mid', label: '가끔' },
  { key: 'sunscreen_daily_normal1', label: '매일' },
]

function todayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default function CustomerSkinAnalysisQuizPage() {
  const supabase = createClient()
  const router = useRouter()

  const { loading: adminLoading, getSetting, getSettingNum } = useAdminSettings()
  const rewardPoints = getSettingNum('points_action', 'ai_analysis_complete', 500)
  const recommendLimit = getSettingNum('skin_quiz', 'recommend_product_limit', 0)
  const productSearchLimit = getSettingNum('skin_quiz', 'product_search_limit', 0)
  const productMinPrice = getSettingNum('skin_quiz', 'product_min_price', 0)

  const deltasJson = getSetting('skin_quiz', 'quiz_deltas_json', '{}')
  const quizDeltas = useMemo(() => {
    try {
      return JSON.parse(deltasJson) as Record<string, Partial<Scores>>
    } catch {
      return {}
    }
  }, [deltasJson])

  const [step, setStep] = useState<Step>('start')
  const [answers, setAnswers] = useState<Answers>({
    q1: null,
    q2: [],
    q3: null,
    q4: null,
    q5: { sleep: null, diet: null, sunscreen: null },
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [todayDone, setTodayDone] = useState(false)
  const [todayDoneLoading, setTodayDoneLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userRowId, setUserRowId] = useState<string | null>(null)
  const [userAgeGroup, setUserAgeGroup] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [cartedIds, setCartedIds] = useState<string[]>([])
  const [searchText, setSearchText] = useState('')

  const progress = progressForStep(step)

  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/login?role=customer')
          return
        }
        setUserId(user.id)

        const { data: u } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
        if (u?.id) {
          setUserRowId(u.id)
          const { data: userProfile } = await supabase.from('users').select('age_group').eq('id', u.id).maybeSingle()
          setUserAgeGroup((userProfile?.age_group || '').toString())
        }

        const today = todayKST()

        // skin_profiles 우선 체크, 없으면 skin_analysis fallback
        const { data: existingProfiles, error: e1 } = await supabase
          .from('skin_profiles')
          .select('id, created_at')
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00+09:00`)
          .lte('created_at', `${today}T23:59:59+09:00`)
          .limit(1)
          .maybeSingle()

        if (!e1 && existingProfiles) {
          setTodayDone(true)
          return
        }

        const { data: existingAnalysis } = await supabase
          .from('skin_analysis')
          .select('id, created_at')
          .eq('user_id', user.id)
          .gte('created_at', `${today}T00:00:00+09:00`)
          .lte('created_at', `${today}T23:59:59+09:00`)
          .limit(1)
          .maybeSingle()

        if (existingAnalysis) setTodayDone(true)
      } finally {
        setTodayDoneLoading(false)
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canGoNext = useMemo(() => {
    if (adminLoading) return false
    if (step === 'q1') return !!answers.q1
    if (step === 'q2') return answers.q2.length > 0
    if (step === 'q3') return !!answers.q3
    if (step === 'q4') return !!answers.q4
    if (step === 'q5') return !!answers.q5.sleep && !!answers.q5.diet && !!answers.q5.sunscreen
    return false
  }, [adminLoading, answers, step])

  const startQuiz = () => {
    if (adminLoading) return
    if (todayDone) return
    setStep('q1')
  }

  const computeScores = (): { scores: Scores; finalType: string } => {
    const scores = initialScores()

    if (answers.q1) applyDelta(scores, quizDeltas[answers.q1] || {})
    for (const k of answers.q2) {
      applyDelta(scores, quizDeltas[k] || {})
    }
    if (answers.q3) applyDelta(scores, quizDeltas[answers.q3] || {})
    if (answers.q4) applyDelta(scores, quizDeltas[answers.q4] || {})
    if (answers.q5.diet) applyDelta(scores, quizDeltas[answers.q5.diet] || {})
    if (answers.q5.sunscreen) applyDelta(scores, quizDeltas[answers.q5.sunscreen] || {})

    const finalType = computeFinalSkinType(scores)
    return { scores, finalType }
  }

  const runAnalysis = async () => {
    setLoading(true)
    setError('')
    try {
      if (!userId) {
        setStep('start')
        setError('로그인이 필요합니다.')
        return
      }

      // 오늘 중복 체크 (마지막 안전장치)
      const today = todayKST()
      const { data: existingProfiles, error: pErr } = await supabase
        .from('skin_profiles')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00+09:00`)
        .lte('created_at', `${today}T23:59:59+09:00`)
        .limit(1)
        .maybeSingle()

      if (!pErr && existingProfiles) {
        setTodayDone(true)
        setStep('start')
        setError('오늘 이미 분석을 완료했습니다. 내일 다시 시도해주세요.')
        return
      }

      const { data: existingAnalysis } = await supabase
        .from('skin_analysis')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00+09:00`)
        .lte('created_at', `${today}T23:59:59+09:00`)
        .limit(1)
        .maybeSingle()

      if (existingAnalysis) {
        setTodayDone(true)
        setStep('start')
        setError('오늘 이미 분석을 완료했습니다. 내일 다시 시도해주세요.')
        return
      }

      const { scores, finalType } = computeScores()

      const { data: matchedProducts } = await supabase
        .from('products')
        .select('id,name,thumb_img,retail_price,description,category,brands(name),skin_types,age_groups,quiz_match,sales_count')
        .eq('status', 'active')
        .gt('retail_price', productMinPrice)
        .contains('skin_types', [finalType])
        .order('sales_count', { ascending: false })
        .limit(productSearchLimit)

      let sourceProducts = (matchedProducts || []) as ProductRow[]
      if (sourceProducts.length === 0) {
        const { data: fallbackByText } = await supabase
          .from('products')
          .select('id,name,thumb_img,retail_price,description,category,brands(name),skin_types,age_groups,quiz_match,sales_count')
          .eq('status', 'active')
          .gt('retail_price', productMinPrice)
          .ilike('description', `%${normalizeTypeLabel(finalType)}%`)
          .order('sales_count', { ascending: false })
          .limit(productSearchLimit)
        sourceProducts = (fallbackByText || []) as ProductRow[]
      }
      if (sourceProducts.length === 0) {
        const { data: fallbackPopular } = await supabase
          .from('products')
          .select('id,name,thumb_img,retail_price,description,category,brands(name),skin_types,age_groups,quiz_match,sales_count')
          .eq('status', 'active')
          .gt('retail_price', productMinPrice)
          .order('sales_count', { ascending: false })
          .limit(productSearchLimit)
        sourceProducts = (fallbackPopular || []) as ProductRow[]
      }

      const quizTags = answers.q2
      const rec = sourceProducts
        .map((p) => ({ ...p, matchRate: calcMatchRate(p, finalType, userAgeGroup, quizTags) }))
        .sort((a: any, b: any) => b.matchRate - a.matchRate)
        .slice(0, recommendLimit || 5)

      // skin_profiles 저장 (없으면 skin_analysis로 fallback)
      const q2Concerns = answers.q2
        .map(k => Q2_OPTIONS.find(o => o.key === k)?.label)
        .filter(Boolean) as string[]

      const lifestyle_data = {
        sleep: answers.q5.sleep,
        diet: answers.q5.diet,
        sunscreen: answers.q5.sunscreen,
      }

      const payload = {
        user_id: userId,
        skin_type: finalType,
        skin_concerns: q2Concerns,
        lifestyle_data,
        result: { skinType: finalType, scores },
      }

      try {
        await supabase.from('skin_profiles').insert(payload as any)
      } catch {
        // 기존 테이블(호환)로 저장
        await supabase.from('skin_analysis').insert({
          user_id: userId,
          skin_type: finalType,
          skin_concerns: q2Concerns,
          lifestyle_data,
          result: payload.result,
        })
      }

      // 사용자 프로필에도 타입/고민 반영(선택)
      if (userRowId) {
        try {
          await supabase.from('users').update({ skin_type: finalType, skin_concerns: q2Concerns }).eq('id', userRowId)
        } catch {
          // ignore
        }
      }

      // 포인트 적립 (admin_settings: points_action.ai_analysis_complete)
      if (userRowId) {
        await supabase.from('point_history').insert({
          user_id: userRowId,
          type: 'earn',
          amount: rewardPoints,
          description: 'AI 피부 분석 완료',
        } as any)

        await supabase.from('notifications').insert({
          user_id: userRowId,
          type: 'point',
          title: `${rewardPoints}P 적립!`,
          body: `AI 피부 분석 완료로 ${rewardPoints}포인트가 적립되었습니다.`,
          icon: '✨',
          is_read: false,
          link: '/wallet',
        } as any)
      }

      setTodayDone(true)
      setSelectedIds([])
      setSearchText('')
      setResult({
        skinType: finalType,
        products: rec as any[],
      })
      setStep('result')
    } catch (e: any) {
      setError(e?.message || '분석 저장에 실패했습니다.')
      setStep('start')
    } finally {
      setLoading(false)
    }
  }

  const [result, setResult] = useState<{ skinType: string; products: any[] } | null>(null)
  const selectedTotal = useMemo(() => {
    if (!result) return 0
    const picked = result.products.filter((p: any) => selectedIds.includes(p.id))
    return picked.reduce((sum: number, p: any) => sum + Number(p.retail_price || 0), 0)
  }, [result, selectedIds])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]))
  }

  const visibleIds = useMemo(() => {
    if (!result) return [] as string[]
    const ids = new Set<string>()
    result.products.forEach((p: any) => ids.add(p.id))
    return Array.from(ids)
  }, [result])

  const searchResults = useMemo(() => {
    if (!result) return [] as any[]
    const q = searchText.trim().toLowerCase()
    if (!q) return []
    return result.products.filter((p: ProductRow) => `${p.name || ''} ${p.description || ''}`.toLowerCase().includes(q))
  }, [result, searchText])

  const stepSections = useMemo(() => {
    if (!result) return [] as Array<{ stepTitle: string; products: any[] }>
    const steps = careStepsForSkinType(result.skinType)
    return steps.map((s) => ({
      stepTitle: s.title,
      products: result.products.filter((p: ProductRow) => s.keywords.some(k => productText(p).includes(k.toLowerCase()))).slice(0, 8),
    }))
  }, [result])

  useEffect(() => {
    if (!result || !userId) return
    const run = async () => {
      const { data: latest } = await supabase
        .from('skin_profiles')
        .select('skin_type')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextType = latest?.skin_type
      if (nextType && nextType !== result.skinType) {
        setSearchText('')
        setSelectedIds([])
        setToast('피부 타입이 변경되어 추천 제품을 업데이트했어요')
        setResult(prev => (prev ? { ...prev, skinType: nextType } : prev))
      }
    }
    run()
  }, [result?.skinType, userId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const addSelectedToCart = async () => {
    if (!selectedIds.length || !userId) return
    const target = result?.products.filter((p: any) => selectedIds.includes(p.id)) || []
    try {
      await supabase.from('cart_items').upsert(
        target.map((p: any) => ({ user_id: userId, product_id: p.id, quantity: 1 })),
        { onConflict: 'user_id,product_id' }
      )
    } catch {
      // ignore table mismatch
    }
    broadcastCartCountRefresh()
    const existing = JSON.parse(localStorage.getItem('auran_cart_items') || '[]') as string[]
    const merged = Array.from(new Set([...existing, ...selectedIds]))
    localStorage.setItem('auran_cart_items', JSON.stringify(merged))
    setCartedIds(merged)
    setToast(`${selectedIds.length}개를 장바구니에 담았어요 🛒`)
  }

  const paySelected = () => {
    if (!selectedIds.length) return
    router.push(`/checkout?products=${selectedIds.join(',')}&from=ai-result`)
  }

  if (loading || step === 'loading') {
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
      <DashboardHeader title="피부분석" right={<CustomerHeaderRight />} />
      <div style={{ padding: '18px 18px 0' }}>
        {step !== 'start' && step !== 'result' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: GOLD, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{progress}%</div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: '#e57373', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Q1 */}
        {step === 'q1' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>{`세안 후 10~15분, 피부가 어떤가요?`}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Q1_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAnswers(a => ({ ...a, q1: opt.key }))}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    background: answers.q1 === opt.key ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.q1 === opt.key ? GOLD : 'var(--border)'}`,
                    borderRadius: 12,
                    color: answers.q1 === opt.key ? GOLD : 'var(--text)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={() => setStep('q2')} disabled={!canGoNext} style={{ width: '100%', padding: 14, background: canGoNext ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canGoNext ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, marginTop: 16 }}>
              다음
            </button>
          </>
        )}

        {/* Q2 */}
        {step === 'q2' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>{`주요 피부 고민을 선택해주세요 (복수 선택)`}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {Q2_OPTIONS.map(opt => {
                const checked = answers.q2.includes(opt.key)
                return (
                  <button
                    key={opt.key}
                    onClick={() =>
                      setAnswers(a => ({
                        ...a,
                        q2: checked ? a.q2.filter(k => k !== opt.key) : [...a.q2, opt.key],
                      }))
                    }
                    style={{
                      padding: '12px 14px',
                      background: checked ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                      border: `1px solid ${checked ? GOLD : 'var(--border)'}`,
                      borderRadius: 12,
                      color: checked ? GOLD : 'var(--text)',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setStep('q3')} disabled={!canGoNext} style={{ width: '100%', padding: 14, background: canGoNext ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canGoNext ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, marginTop: 16 }}>
              다음
            </button>
          </>
        )}

        {/* Q3 */}
        {step === 'q3' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>{`오후 2~3시, T존(이마·코) 상태는?`}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Q3_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAnswers(a => ({ ...a, q3: opt.key }))}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    background: answers.q3 === opt.key ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.q3 === opt.key ? GOLD : 'var(--border)'}`,
                    borderRadius: 12,
                    color: answers.q3 === opt.key ? GOLD : 'var(--text)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={() => setStep('q4')} disabled={!canGoNext} style={{ width: '100%', padding: 14, background: canGoNext ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canGoNext ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, marginTop: 16 }}>
              다음
            </button>
          </>
        )}

        {/* Q4 */}
        {step === 'q4' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>{`색소침착이나 트러블, 평소 얼마나 신경 쓰이나요?`}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Q4_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setAnswers(a => ({ ...a, q4: opt.key }))}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    background: answers.q4 === opt.key ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                    border: `1px solid ${answers.q4 === opt.key ? GOLD : 'var(--border)'}`,
                    borderRadius: 12,
                    color: answers.q4 === opt.key ? GOLD : 'var(--text)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={() => setStep('q5')} disabled={!canGoNext} style={{ width: '100%', padding: 14, background: canGoNext ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canGoNext ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, marginTop: 16 }}>
              다음
            </button>
          </>
        )}

        {/* Q5 */}
        {step === 'q5' && (
          <>
            <h2 style={{ fontSize: 16, color: '#fff', marginBottom: 14 }}>{`생활 습관을 알려주세요`}</h2>

            {/* 수면 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>{`[수면 시간]`}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Q5_SLEEP.map(opt => {
                  const checked = answers.q5.sleep === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setAnswers(a => ({ ...a, q5: { ...a.q5, sleep: opt.key } }))}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1px solid ${checked ? GOLD : 'var(--border)'}`,
                        background: checked ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                        color: checked ? GOLD : 'var(--text)',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 식습관 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>{`[식습관]`}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Q5_DIET.map(opt => {
                  const checked = answers.q5.diet === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setAnswers(a => ({ ...a, q5: { ...a.q5, diet: opt.key } }))}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1px solid ${checked ? GOLD : 'var(--border)'}`,
                        background: checked ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                        color: checked ? GOLD : 'var(--text)',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 선크림 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>{`[선크림 사용]`}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Q5_SUN.map(opt => {
                  const checked = answers.q5.sunscreen === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setAnswers(a => ({ ...a, q5: { ...a.q5, sunscreen: opt.key } }))}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: `1px solid ${checked ? GOLD : 'var(--border)'}`,
                        background: checked ? 'rgba(201,168,76,0.25)' : 'var(--bg3)',
                        color: checked ? GOLD : 'var(--text)',
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={() => runAnalysis()} disabled={!canGoNext} style={{ width: '100%', padding: 14, background: canGoNext ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: canGoNext ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, marginTop: 6 }}>
              분석 완료
            </button>
          </>
        )}

        {/* Start */}
        {step === 'start' && (
          <>
            <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
              <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: '#fff', marginBottom: 8 }}>{`AI 피부분석`}</h1>
              <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
                5문항 퀴즈로 피부 타입을 찾아보세요.<br />
                <span style={{ color: GOLD, fontWeight: 700 }}>{`완료 시 ${rewardPoints}P 적립!`}</span>
              </p>
            </div>

            {!todayDoneLoading && todayDone ? (
              <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 8 }}>오늘 분석 완료!</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 16 }}>
                  {`내일 다시 도전하시면`}<br />{`${rewardPoints}P를 추가로 적립할 수 있어요.`}
                </div>
                <button
                  onClick={() => router.push('/products')}
                  style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                >
                  추천 제품 보러 가기 →
                </button>
              </div>
            ) : (
              <button
                onClick={startQuiz}
                disabled={todayDoneLoading}
                style={{
                  width: '100%',
                  padding: 16,
                  background: todayDoneLoading ? 'var(--bg3)' : GOLD,
                  border: 'none',
                  borderRadius: 14,
                  color: todayDoneLoading ? 'var(--text3)' : '#0a0a0a',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: todayDoneLoading ? 'wait' : 'pointer',
                }}
              >
                {todayDoneLoading ? '확인 중...' : '피부 분석 시작하기'}
              </button>
            )}
          </>
        )}

        {toast && (
          <div style={{ position: 'sticky', top: 66, zIndex: 35, marginBottom: 10, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.45)', color: GOLD, fontSize: 12, padding: '10px 12px', borderRadius: 10 }}>
            {toast}
          </div>
        )}

        {/* Result */}
        {step === 'result' && result && (
          <>
            <div style={{ padding: '20px 0' }}>
              <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 8 }}>{`분석 완료!`}</h2>
              <div style={{ padding: 16, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 14, marginBottom: 24 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{`🧬 ${result.skinType}`}</span>
              </div>

              {result.products.length > 0 && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>AI 맞춤 추천 TOP 5</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {result.products.slice(0, 5).map((p: any) => (
                        <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                          <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                          <div onClick={() => router.push(`/products/${p.id}`)} style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                              {p.thumb_img ? <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
                              <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              <div style={{ fontSize: 12, color: GOLD, marginTop: 2 }}>{`맞춤도 ${Number(p.matchRate || 0)}%`}</div>
                            </div>
                          </div>
                          <button onClick={() => toggleSelect(p.id)} style={{ border: '1px solid rgba(201,168,76,0.35)', background: selectedIds.includes(p.id) ? 'rgba(201,168,76,0.2)' : 'transparent', color: GOLD, borderRadius: 8, padding: '6px 9px', fontSize: 12 }}>
                            {cartedIds.includes(p.id) ? '담김' : '담기'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>피부타입별 검색바</h3>
                    <input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder={`🔍 ${result.skinType} 피부 제품 검색...`}
                      style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: '#fff', padding: '0 12px', outline: 'none' }}
                    />
                    {searchText.trim() && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {searchResults.map((p: any) => (
                          <div key={`search-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg3)', padding: 8 }}>
                            <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                            <div onClick={() => router.push(`/products/${p.id}`)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                              <div style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                              <div style={{ color: 'var(--text3)', fontSize: 11 }}>{p.brands?.name || ''}</div>
                            </div>
                            <div style={{ color: GOLD, fontSize: 12, fontWeight: 800 }}>{`₩${toComma(p.retail_price)}`}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, color: '#fff', marginBottom: 8 }}>단계별 케어 라인업</h3>
                    {stepSections.map((sec, idx) => (
                      <div key={sec.stepTitle} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{`STEP ${idx + 1} · ${sec.stepTitle}`}</div>
                          <button style={{ border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 12 }}>전체보기 ›</button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                          {sec.products.map((p: any) => (
                            <div key={`${sec.stepTitle}-${p.id}`} style={{ width: 160, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg3)' }}>
                              <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)' }}>
                                <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }} />
                                {p.thumb_img ? <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                              </div>
                              <div style={{ padding: 8 }}>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
                                <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1.3, minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.name}</div>
                                <div style={{ color: GOLD, fontSize: 12, marginTop: 3 }}>{`₩${toComma(p.retail_price)}`}</div>
                                <button onClick={() => toggleSelect(p.id)} style={{ marginTop: 6, width: '100%', borderRadius: 8, border: '1px solid rgba(201,168,76,0.35)', background: selectedIds.includes(p.id) ? 'rgba(201,168,76,0.2)' : 'transparent', color: GOLD, fontSize: 12, padding: '6px 0' }}>
                                  {cartedIds.includes(p.id) ? '담김' : '담기'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={() => router.push('/products')}
                style={{ width: '100%', padding: 14, background: GOLD, border: 'none', borderRadius: 12, color: '#0a0a0a', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                전제품 보러 가기 →
              </button>
            </div>
          </>
        )}
      </div>

      {step === 'result' && result && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 66, width: '100%', maxWidth: 480, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'rgba(10,12,15,0.96)', zIndex: 45 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 12, marginBottom: 8 }}>
            <button
              onClick={() => setSelectedIds(selectedIds.length === visibleIds.length ? [] : visibleIds)}
              style={{ border: 'none', background: 'transparent', color: selectedIds.length ? GOLD : '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              {selectedIds.length === visibleIds.length ? '☑ 전체해제' : '☑ 전체선택'}
            </button>
            <span>{`선택 ${selectedIds.length}개 · ₩${toComma(selectedTotal)}`}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              disabled={!selectedIds.length}
              onClick={addSelectedToCart}
              style={{ height: 42, borderRadius: 10, border: '1px solid var(--border)', background: selectedIds.length ? 'rgba(201,168,76,0.18)' : 'var(--bg3)', color: selectedIds.length ? GOLD : 'var(--text3)', fontWeight: 700 }}
            >
              🛒 장바구니
            </button>
            <button
              disabled={!selectedIds.length}
              onClick={paySelected}
              style={{ height: 42, borderRadius: 10, border: 'none', background: selectedIds.length ? GOLD : 'var(--bg3)', color: selectedIds.length ? '#0a0a0a' : 'var(--text3)', fontWeight: 900 }}
            >
              ⚡ 선택 결제하기
            </button>
          </div>
        </div>
      )}
      <DashboardBottomNav role="customer" />
    </div>
  )
}

function toComma(v: any) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString()
}

