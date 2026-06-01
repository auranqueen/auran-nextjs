'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeComposite, computeSkinAge } from '@/lib/skinAge'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export default function SkinAnalysisPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [userName, setUserName] = useState('')
  const [userAge, setUserAge] = useState(42)
  const [analyzing, setAnalyzing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [lockMsg, setLockMsg] = useState('')
  const [isFirstAnalysis, setIsFirstAnalysis] = useState(true)
  const [userId, setUserId] = useState('')
  const [userGrade, setUserGrade] = useState('PETAL')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('auth_id', data.user.id)
        .maybeSingle()
      const name =
        prof?.full_name ||
        prof?.username ||
        data.user.user_metadata?.full_name ||
        data.user.user_metadata?.name
      if (name) setUserName(String(name))
      const birth = data.user.user_metadata?.birth_date
      if (birth) {
        const age = new Date().getFullYear() - new Date(birth).getFullYear()
        setUserAge(age)
      }

      const [{ data: gradeData }, { data: ordersData }, { data: analysesData }] = await Promise.all([
        supabase.from('profiles').select('grade').eq('auth_id', data.user.id).maybeSingle(),
        supabase.from('orders').select('id').eq('user_id', data.user.id).limit(1),
        supabase.from('skin_analyses').select('id').eq('user_id', data.user.id).limit(1),
      ])
      if ((ordersData && ordersData.length > 0) || (analysesData && analysesData.length > 0)) {
        setIsFirstAnalysis(false)
      }

      const now = new Date()
      const grade = gradeData?.grade || 'PETAL'
      setUserId(data.user.id)
      setUserGrade(grade)
      if (grade !== 'CÉLESTE') {
        const limit: Record<string, number> = { PETAL: 1, BLOOM: 1, VELVET: 1, 'LUMIÈRE': 2, REINE: 1, NOIR: 2 }
        const period = ['REINE', 'NOIR'].includes(grade) ? 'week' : 'month'
        const periodStart = period === 'week'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString()
          : new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const { count } = await supabase
          .from('skin_analysis_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.user.id)
          .gte('analyzed_at', periodStart)
        const maxCount = limit[grade] ?? 1
        if ((count ?? 0) >= maxCount) {
          const daysLeft = period === 'week'
            ? 6 - now.getDay()
            : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
          setIsLocked(true)
          setLockMsg(`${period}|다음 분석까지 ${daysLeft}일 남았어요`)
        }
      }
    })
  }, [])

  // 이미지 선택 처리
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setCapturedImage(base64)
      analyzeImage(base64)
    }
    reader.readAsDataURL(file)
  }

  // AI 1차 분석 (TODO: 실제 AI 모델 연동)
  const analyzeImage = async (imageBase64: string) => {
    setAnalyzing(true)
    try {
      if (!userId) return
      const res = await fetch('/api/analyze-skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          userAge,
          skinType: '',
          gender: '',
        }),
      })
      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error || '분석 실패')
      const scores = {
        moisture: result.moisture ?? 55,
        oil: result.oil ?? 40,
        sensitivity: result.sensitivity ?? 70,
        elasticity: result.elasticity ?? 65,
        pigmentation: result.pigmentation ?? 25,
        pore: result.pore ?? 40,
      }
      const params = new URLSearchParams({
        moisture: String(scores.moisture),
        oil: String(scores.oil),
        sensitivity: String(scores.sensitivity),
        elasticity: String(scores.elasticity),
        pigmentation: String(scores.pigmentation),
        pore: String(scores.pore),
        age: String(userAge),
      })
      await supabase.from('skin_analysis_logs').insert({
        user_id: userId,
        grade: userGrade,
        analyzed_at: new Date().toISOString(),
      })
      if (!isFirstAnalysis) {
        let _age: number | null = null
        try {
          const { data: _p } = await supabase.from('profiles').select('birth_date').eq('auth_id', userId).maybeSingle()
          if (_p?.birth_date) _age = new Date().getFullYear() - new Date(_p.birth_date).getFullYear()
        } catch {}
        const _composite = computeComposite(scores as any)
        const _skinAge = computeSkinAge(_composite, _age)
        await supabase.from('skin_analyses').insert({
          user_id: userId,
          moisture_score: scores.moisture,
          oil_score: scores.oil,
          sensitivity_score: scores.sensitivity,
          elasticity_score: scores.elasticity,
          pigmentation_score: scores.pigmentation,
          pore_score: scores.pore,
          condition: null,
          concern_area: null,
          free_text: null,
          age_at_analysis: _age,
          skin_score: _composite,
          skin_age: _skinAge,
        })
        router.push(`/skin-analysis/result?${params.toString()}`)
      } else {
        router.push(`/skin-analysis/q?${params.toString()}`)
      }
    } finally {
      setAnalyzing(false)
    }
  }

  // 건너뛰기 (기본값으로 질문 페이지로)
  const handleSkip = () => {
    const params = new URLSearchParams({
      moisture: '55', oil: '40', sensitivity: '70',
      elasticity: '65', pigmentation: '25', pore: '40',
      age: String(userAge),
    })
    router.push(`/skin-analysis/q?${params.toString()}`)
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '24px', position: 'relative' }}>

      {isLocked && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(13,11,9,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '16px', fontWeight: 400, marginBottom: '8px', color: '#fff' }}>
            {lockMsg.startsWith('week|') ? '이번 주 분석을 완료했어요' : '이번 달 분석을 완료했어요'}
          </div>
          <div style={{ fontSize: '13px', color: GOLD, marginBottom: '24px' }}>
            {lockMsg.includes('|') ? lockMsg.split('|')[1] : lockMsg}
          </div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 2, marginBottom: '28px', padding: '14px 16px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', width: '100%' }}>
            LUMIÈRE → 월 2회<br />
            REINE → 주 1회<br />
            CÉLESTE → 무제한
          </div>
          <button onClick={() => router.back()} style={{ width: '100%', padding: '13px', background: GOLD, borderRadius: '12px', fontSize: '13px', fontWeight: 400, color: BG, cursor: 'pointer', border: 'none', fontFamily: "'Noto Sans KR', sans-serif" }}>
            돌아가기
          </button>
        </div>
      )}

      {/* 탑바 */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#fff' }}>‹</button>
        <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>AI 피부분석</span>
        <button onClick={handleSkip} style={{ fontSize: '11px', color: TEXT_DIM, background: 'none', border: 'none', cursor: 'pointer' }}>건너뛰기</button>
      </header>

      {/* 스텝바 */}
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px 0' }}>
        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: GOLD }} />
        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* 카메라 뷰 */}
      <div style={{ margin: '14px 16px 0', height: '240px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', borderRadius: '18px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {capturedImage ? (
          <img src={capturedImage} alt="촬영된 사진" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px' }} />
        ) : analyzing ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔬</div>
            <div style={{ fontSize: '13px', color: GOLD }}>AI 분석 중...</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '64px', opacity: 0.2 }}>👤</div>
            {/* 타원 가이드 */}
            <div style={{ position: 'absolute', width: '120px', height: '160px', border: '2px solid rgba(201,169,110,0.6)', borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
            {/* 코너 마커 */}
            <div style={{ position: 'absolute', top: '16px', left: '16px', width: '14px', height: '14px', borderTop: '2.5px solid #C9A96E', borderLeft: '2.5px solid #C9A96E', borderRadius: '3px 0 0 0' }} />
            <div style={{ position: 'absolute', top: '16px', right: '16px', width: '14px', height: '14px', borderTop: '2.5px solid #C9A96E', borderRight: '2.5px solid #C9A96E', borderRadius: '0 3px 0 0' }} />
            <div style={{ position: 'absolute', bottom: '24px', left: '16px', width: '14px', height: '14px', borderBottom: '2.5px solid #C9A96E', borderLeft: '2.5px solid #C9A96E', borderRadius: '0 0 0 3px' }} />
            <div style={{ position: 'absolute', bottom: '24px', right: '16px', width: '14px', height: '14px', borderBottom: '2.5px solid #C9A96E', borderRight: '2.5px solid #C9A96E', borderRadius: '0 0 3px 0' }} />
            <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, textAlign: 'center', fontSize: '11px', color: TEXT_DIM }}>얼굴을 타원 안에 맞춰주세요</div>
          </>
        )}
      </div>

      {/* 연령 자동인식 */}
      <div style={{ margin: '10px 16px 0', padding: '9px 12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🎂</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>연령대 자동 인식됨</div>
          <div style={{ fontSize: '9px', color: TEXT_DIM }}>만 {userAge}세 기준 · 매년 생일에 자동 갱신</div>
        </div>
        <button onClick={() => router.push('/my/profile')} style={{ fontSize: '10px', color: 'rgba(201,169,110,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}>변경 ›</button>
      </div>

      {/* 이벤트 감지 안내 */}
      <div style={{ margin: '8px 16px 0', padding: '9px 12px', background: 'rgba(220,80,180,0.05)', border: '1px solid rgba(220,80,180,0.18)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>⚡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>최근 피부 이벤트가 있나요?</div>
          <div style={{ fontSize: '9px', color: 'rgba(220,80,180,0.7)' }}>레이저·시술·여행 등 → 맞춤 추천 변경</div>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(220,80,180,0.8)' }}>다음에 선택</span>
      </div>

      {/* 안내 텍스트 */}
      <div style={{ margin: '12px 16px 0', padding: '10px 12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px' }}>
        <div style={{ fontSize: '10px', color: TEXT_DIM, lineHeight: 1.8 }}>
          📸 자연광에서 촬영하면 정확도가 높아요<br />
          💡 화장기 없는 세안 후 촬영을 추천해요<br />
          🔒 사진은 분석 후 즉시 삭제돼요
        </div>
      </div>

      {/* 촬영 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '20px 16px 0' }}>
        <button onClick={() => { if (isLocked) { alert(lockMsg.includes('|') ? lockMsg.split('|')[1] : lockMsg); return }; fileInputRef.current!.accept = 'image/*'; fileInputRef.current!.click() }} style={{ width: '44px', height: '44px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer' }}>🖼</button>
        <button onClick={() => { if (isLocked) { alert(lockMsg.includes('|') ? lockMsg.split('|')[1] : lockMsg); return }; fileInputRef.current!.accept = 'image/*'; fileInputRef.current!.capture = 'user'; fileInputRef.current!.click() }} disabled={analyzing} style={{ width: '64px', height: '64px', borderRadius: '50%', background: analyzing ? 'rgba(201,169,110,0.4)' : 'linear-gradient(135deg,#C9A96E,#E8C88A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', boxShadow: '0 4px 20px rgba(201,169,110,0.4)', cursor: analyzing ? 'not-allowed' : 'pointer', border: 'none' }}>📷</button>
        <button style={{ width: '44px', height: '44px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', cursor: 'pointer' }}>🔄</button>
      </div>
      <div style={{ textAlign: 'center', fontSize: '9px', color: TEXT_DIM, marginTop: '6px', fontFamily: 'monospace' }}>갤러리 · 촬영 · 전면전환</div>

      {/* 건너뛰고 질문만 */}
      <div style={{ padding: '14px 16px 0' }}>
        <button onClick={handleSkip} style={{ width: '100%', padding: '12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', fontSize: '12px', color: TEXT_MUTED, cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif" }}>
          사진 없이 질문만으로 분석하기 →
        </button>
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
    </div>
  )
}
