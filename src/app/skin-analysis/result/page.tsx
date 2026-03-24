'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProductClient from '@/app/(customer)/products/[id]/client'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

interface Scores { moisture: number; oil: number; sensitivity: number; elasticity: number; pigmentation: number; pore: number }

const SKIN_TYPE_LABELS: Record<string, string> = {
  dry: '건성', oily: '지성', combination: '복합성', sensitive: '민감성', unknown: '복합'
}
const EVENT_LABELS: Record<string, string> = { laser: '레이저·시술 후', travel: '여행 중', season: '환절기', none: '', '': '' }
const HORMONE_LABELS: Record<string, string> = {
  pregnant: '임신 중', menstrual: '생리 중', pre_menstrual: '생리 전',
  post_menstrual: '생리 후', ovulation: '배란기', irregular: '호르몬 불규칙',
  menopause_transition: '갱년기', post_menopause: '폐경 후', hrt: 'HRT 중',
}

function Btn3({ id, retail_price, name, router }: any) {
  return (
    <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
      <div onClick={() => router.push(`/products/${id}`)} style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,0.05)', border: CARD_BORDER, borderRadius: '8px', fontSize: '11px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>🛒 담기</div>
      <div onClick={() => router.push(`/gift?product_id=${id}`)} style={{ flex: 1, padding: '8px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>🎁 선물</div>
      <div onClick={() => router.push(`/checkout?product_id=${id}&qty=1`)} style={{ flex: 1.3, padding: '8px 0', background: GOLD, borderRadius: '8px', fontSize: '11px', fontWeight: 400, color: BG, textAlign: 'center', cursor: 'pointer' }}>지금 구매</div>
    </div>
  )
}

function SkinAnalysisResultPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const scores: Scores = {
    moisture: Number(searchParams.get('moisture') || 62),
    oil: Number(searchParams.get('oil') || 38),
    sensitivity: Number(searchParams.get('sensitivity') || 85),
    elasticity: Number(searchParams.get('elasticity') || 72),
    pigmentation: Number(searchParams.get('pigmentation') || 20),
    pore: Number(searchParams.get('pore') || 45),
  }
  const event = searchParams.get('event') || 'none'
  const skinType = searchParams.get('skinType') || 'unknown'
  const age = Number(searchParams.get('age') || 42)
  const gender = searchParams.get('gender') || 'none'
  const hormone = searchParams.get('hormone') || ''
  const isPregnant = searchParams.get('pregnant') === '1'

  const [products, setProducts] = useState<any[]>([])
  const [prevScores, setPrevScores] = useState<any>(null)
  const [userName, setUserName] = useState('유미')
  const [historyData, setHistoryData] = useState<number[]>([])

  // Simple skin_type exact-match strategy (easy to swap to score-based later).
  const fetchRecommendedProducts = async () => {
    let query = supabase
      .from('products')
      .select('*')
      .eq('skin_type', skinType)
      .limit(3)

    if (isPregnant) {
      query = query.eq('is_pregnancy_safe', true)
    }

    const { data, error } = await query.eq('status', 'active')
    if (error) {
      const fallback = await query
      return fallback.data || []
    }
    return data || []
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name
      if (name) setUserName(name)
    })
    fetchRecommendedProducts().then((data) => setProducts(data))

    // TODO: 이전 분석 조회
    supabase.from('skin_analyses').select('moisture_score, created_at').order('created_at', { ascending: false }).limit(4).then(({ data }) => {
      if (data && data.length > 0) {
        setPrevScores(data[1] || null)
        setHistoryData(data.map((d: any) => d.moisture_score).reverse())
      }
    })
  }, [skinType, isPregnant])

  const getSkinLabel = () => {
    const types = []
    if (scores.moisture < 50) types.push('건성')
    else if (scores.moisture > 72) types.push('지성')
    else types.push('복합성')
    if (scores.sensitivity >= 70) types.push('민감')
    return types.join(' · ')
  }

  const eventLabel = EVENT_LABELS[event] || ''
  const hormoneLabel = HORMONE_LABELS[hormone] || ''

  const scoreItems = [
    { name: '수분', val: scores.moisture, color: '#6ab0e0', unit: '%' },
    { name: '탄력', val: scores.elasticity, color: GOLD, unit: '%' },
    { name: '민감', val: scores.sensitivity, color: '#e07060', unit: '%' },
    { name: '장벽', val: Math.round((scores.moisture + scores.elasticity) / 2 * 0.9), color: '#80c080', unit: '%' },
    { name: '모공', val: scores.pore, color: '#a080e0', unit: '%' },
    { name: '색소', val: scores.pigmentation, color: '#e0c060', unit: '%' },
  ]

  // 폴백 추천 제품 (임신/일반 분기)
  const fallbackProducts = isPregnant ? [
    { id: '667aaeb7-b29a-4ea6-bd52-6e4cafbcfef7', name: '순한 보습 크림 (무향)', brands: { name: 'SHOPBELLE' }, retail_price: 32000, icon: '🌿', match: 97, reason: '임신 안전 성분 확인 · 무향' },
    { id: '667aaeb7-b29a-4ea6-bd52-6e4cafbcfef7', name: '마린 바디 오일 (튼살)', brands: { name: 'THALAC' }, retail_price: 58000, icon: '🌺', match: 95, reason: '배·가슴 튼살 예방 특화' },
    { id: '667aaeb7-b29a-4ea6-bd52-6e4cafbcfef7', name: '라벤더 수면 바디오일', brands: { name: 'CIVASAN' }, retail_price: 52000, icon: '🌸', match: 92, reason: '라벤더·캐모마일 · 수면 개선' },
  ] : [
    { id: '667aaeb7-b29a-4ea6-bd52-6e4cafbcfef7', name: 'MESS CREAM 50ml', brands: { name: 'CIVASAN' }, retail_price: 40600, icon: '🧴', match: 98, reason: `수분 ${scores.moisture}% → 75% 개선 예상` },
    { id: '667aaeb7-b29a-4ea6-bd52-6e4cafbcfef7', name: '바이오 에센스 세럼', brands: { name: 'GERNETIC' }, retail_price: 94000, icon: '🌿', match: 91, reason: '세라마이드 복합체로 장벽 강화' },
    { id: '667aaeb7-b29a-4ea6-bd52-6e4cafbcfef7', name: '칼라민 진정 크림', brands: { name: 'SHOPBELLE' }, retail_price: 44000, icon: '🌱', match: 87, reason: event === 'laser' ? '시술 후 진정 특화' : '민감 피부 저자극 처방' },
  ]

  const displayProducts = products.length > 0 ? products.slice(0, 3) : fallbackProducts
  const historyArr = historyData.length > 0 ? historyData : [scores.moisture * 0.75, scores.moisture * 0.85, scores.moisture * 0.92, scores.moisture]
  const maxH = Math.max(...historyArr)

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '100px' }}>

      {/* 탑바 */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.push('/home')} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#fff' }}>‹</button>
        <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>분석 결과</span>
        <button onClick={() => router.push('/myworld')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer', background: 'none', border: 'none' }}>저장 ›</button>
      </header>

      {/* 임신 모드 배너 */}
      {isPregnant && (
        <div style={{ padding: '10px 16px', background: 'rgba(255,180,200,0.08)', borderBottom: '1px solid rgba(255,180,200,0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🤰</span>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,200,220,0.9)', fontWeight: 400 }}>임신 중 · 안전 성분 필터 ON</div>
            <div style={{ fontSize: '9px', color: TEXT_MUTED }}>레티놀·살리실산·강한 향 성분 제외됨</div>
          </div>
        </div>
      )}

      {/* 이벤트/호르몬 배너 */}
      {(eventLabel || hormoneLabel) && !isPregnant && (
        <div style={{ padding: '8px 16px', background: event === 'laser' ? 'rgba(220,80,180,0.07)' : 'rgba(220,160,40,0.07)', borderBottom: `1px solid ${event === 'laser' ? 'rgba(220,80,180,0.18)' : 'rgba(220,160,40,0.18)'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{event === 'laser' ? '💉' : event === 'travel' ? '✈️' : hormoneLabel ? '🌸' : '🌸'}</span>
          <span style={{ fontSize: '10px', color: event === 'laser' ? 'rgba(220,80,180,0.9)' : 'rgba(220,160,80,0.9)' }}>
            {eventLabel || hormoneLabel} 맞춤 분석 · 추천 제품 자동 변경됨
          </span>
        </div>
      )}

      {/* 헤드라인 */}
      <div style={{ padding: '16px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px', marginBottom: '4px' }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 분석
        </div>
        <div style={{ fontSize: '22px', fontWeight: 400, marginBottom: '4px' }}>
          {isPregnant ? '임신 중 · 순한 케어 모드' : getSkinLabel()}
        </div>
        <div style={{ fontSize: '11px', color: TEXT_MUTED }}>
          만 {age}세 기준 · {scores.moisture < 50 ? '수분 부족' : '수분 양호'} / {scores.sensitivity >= 70 ? '장벽 강화 필요' : '장벽 안정'}
        </div>
      </div>

      {/* 스코어 맵 - 레이더 차트 + 바 */}
      <div style={{ margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', padding: '14px' }}>
        <div style={{ fontSize: '8px', color: TEXT_DIM, fontFamily: 'monospace', letterSpacing: '1.5px', textAlign: 'center', marginBottom: '10px' }}>SKIN SCORE MAP</div>
        {/* 레이더 차트 SVG */}
        <svg width="100%" height="140" viewBox="0 0 220 140" style={{ display: 'block', margin: '0 auto' }}>
          {/* 배경 육각형 */}
          <polygon points="110,12 148,34 148,78 110,100 72,78 72,34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <polygon points="110,26 136,42 136,70 110,86 84,70 84,42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <polygon points="110,40 124,50 124,62 110,72 96,62 96,50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          {/* 축 선 */}
          <line x1="110" y1="12" x2="110" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          <line x1="72" y1="34" x2="148" y2="78" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          <line x1="148" y1="34" x2="72" y2="78" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          {/* 데이터 폴리곤 */}
          <polygon
            points={`110,${12 + (1 - scores.moisture / 100) * 44} ${148 - (1 - scores.elasticity / 100) * 38},${34 + (1 - scores.elasticity / 100) * 22} ${148 - (1 - Math.round((scores.moisture + scores.elasticity) / 2 * 0.9) / 100) * 38},${78 - (1 - Math.round((scores.moisture + scores.elasticity) / 2 * 0.9) / 100) * 22} 110,${100 - (1 - scores.pore / 100) * 44} ${72 + (1 - scores.sensitivity / 100) * 38},${78 - (1 - scores.sensitivity / 100) * 22} ${72 + (1 - scores.pigmentation / 100) * 38},${34 + (1 - scores.pigmentation / 100) * 22}`}
            fill="rgba(201,169,110,0.12)" stroke="#C9A96E" strokeWidth="1.5"
          />
          {/* 레이블 */}
          <text x="110" y="8" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle" fontFamily="DM Mono">수분</text>
          <text x="160" y="38" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="DM Mono">탄력</text>
          <text x="160" y="82" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="DM Mono">장벽</text>
          <text x="110" y="114" fill="rgba(255,255,255,0.4)" fontSize="9" textAnchor="middle" fontFamily="DM Mono">모공</text>
          <text x="14" y="82" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="DM Mono">민감</text>
          <text x="14" y="38" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="DM Mono">색소</text>
        </svg>
        {/* 스코어 바 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
          {scoreItems.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '9px', color: TEXT_DIM, width: '28px', flexShrink: 0 }}>{s.name}</span>
              <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
                <div style={{ height: '100%', width: `${s.val}%`, background: s.color, borderRadius: '2px' }} />
              </div>
              <span style={{ fontSize: '9px', color: s.color, fontFamily: 'monospace', width: '24px', textAlign: 'right' }}>{s.val}</span>
            </div>
          ))}
        </div>
        {/* 이전 분석 비교 */}
        {prevScores && (
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '9px', color: TEXT_DIM }}>지난 분석 대비</span>
            <span style={{ fontSize: '11px', color: scores.moisture > prevScores.moisture_score ? '#4CAF50' : '#e07060' }}>
              수분 {scores.moisture > prevScores.moisture_score ? '+' : ''}{scores.moisture - prevScores.moisture_score}%
            </span>
          </div>
        )}
      </div>

      {/* 3개월 변화 바 차트 */}
      <div style={{ margin: '10px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace' }}>💧 수분도 변화</span>
          <span style={{ fontSize: '10px', color: '#4CAF50' }}>+{Math.round(((historyArr[3] - historyArr[0]) / historyArr[0]) * 100)}% ↑</span>
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end', height: '50px' }}>
          {historyArr.slice(-4).map((v, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${(v / maxH) * 100}%`, background: i === 3 ? '#6ab0e0' : `rgba(106,176,224,${0.25 + i * 0.15})`, borderRadius: '3px 3px 0 0', border: i === 3 ? `1px solid rgba(201,169,110,0.4)` : 'none' }} />
              <span style={{ fontSize: '8px', color: i === 3 ? 'rgba(106,176,224,0.8)' : TEXT_DIM }}>{i === 3 ? '오늘' : `${3 - i}달전`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 이벤트별 안내 카드 */}
      {event === 'laser' && (
        <div style={{ margin: '10px 16px 0', padding: '12px', background: 'rgba(220,80,180,0.07)', border: '1px solid rgba(220,80,180,0.22)', borderRadius: '14px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(220,80,180,0.9)', marginBottom: '4px', fontWeight: 400 }}>💉 레이저 시술 후 관리 모드</div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.6 }}>시술 후 민감도 상승 감지. 진정·저자극 라인으로 자동 변경됐어요. 2~4주 후 일반 루틴으로 자동 복귀.</div>
        </div>
      )}
      {event === 'travel' && (
        <div style={{ margin: '10px 16px 0', padding: '12px', background: 'rgba(220,160,40,0.07)', border: '1px solid rgba(220,160,40,0.18)', borderRadius: '14px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(220,160,80,0.9)', marginBottom: '4px', fontWeight: 400 }}>✈️ 여행 중 자외선 노출</div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.6 }}>자외선 차단·항산화 제품이 우선 추천돼요.</div>
        </div>
      )}
      {(hormone === 'menopause_transition' || hormone === 'post_menopause') && (
        <div style={{ margin: '10px 16px 0', padding: '12px', background: 'rgba(200,150,240,0.06)', border: '1px solid rgba(200,150,240,0.18)', borderRadius: '14px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(210,170,255,0.9)', marginBottom: '4px', fontWeight: 400 }}>{hormone === 'post_menopause' ? '🍂 폐경 후 딥리페어 모드' : '🌸 갱년기 특화 케어 모드'}</div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.6 }}>{hormone === 'post_menopause' ? 'EGF·펩타이드·콜라겐 부스터 우선 추천됩니다.' : '에스트로겐 감소로 인한 탄력·건조 케어 제품이 추천됩니다.'}</div>
        </div>
      )}
      {isPregnant && (
        <div style={{ margin: '10px 16px 0', padding: '12px', background: 'rgba(100,160,240,0.06)', border: '1px solid rgba(100,160,240,0.18)', borderRadius: '14px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(140,190,255,0.9)', marginBottom: '4px', fontWeight: 400 }}>😴 임신 중 수면 개선 아로마</div>
          <div style={{ fontSize: '9px', color: TEXT_MUTED, lineHeight: 1.7 }}>
            ✓ 안전: <span style={{ color: 'rgba(140,220,160,0.8)' }}>라벤더 · 캐모마일 · 일랑일랑</span><br />
            ✕ 주의: <span style={{ color: 'rgba(255,120,120,0.7)' }}>페퍼민트 · 로즈마리 · 유칼립투스 · 클라리세이지</span>
          </div>
        </div>
      )}

      {/* AI 추천 제품 */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
            {isPregnant ? '🤰 임신 안전 추천' : 'AI 맞춤 추천 · 매칭 정확도순'}
          </span>
          <span onClick={() => router.push('/products')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
        {displayProducts.map((p: any, i: number) => (
          <div key={i} style={{ background: i === 0 ? 'rgba(201,169,110,0.05)' : CARD_BG, border: i === 0 ? '1px solid rgba(201,169,110,0.3)' : CARD_BORDER, borderRadius: '16px', overflow: 'hidden', marginBottom: '10px' }}>
            {i === 0 && (
              <div style={{ padding: '5px 12px 0', fontSize: '9px', color: GOLD }}>
                🥇 {p.match || 98}% 매칭 · {isPregnant ? '임신 안전 성분' : getSkinLabel() + ' 최적'}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', padding: '10px 12px', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0, overflow: 'hidden' }}>
                {(p.storage_thumb_url || p.thumb_img)
                  ? <img src={p.storage_thumb_url || p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (p.icon || '🧴')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${p.match || (98 - i * 7)}%`, background: `linear-gradient(90deg,${GOLD},#E8C88A)`, borderRadius: '2px' }} />
                  </div>
                  <span style={{ fontSize: '9px', color: GOLD, fontFamily: 'monospace' }}>{p.match || (98 - i * 7)}%</span>
                </div>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{p.brands?.name || p.brand}</div>
                <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: '10px', color: TEXT_MUTED }}>{p.reason || (isPregnant ? '임신 안전 성분 확인됨' : `${getSkinLabel()} 피부 맞춤`)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 400 }}>{(p.retail_price || 0).toLocaleString()}원</div>
              </div>
            </div>
            <Btn3 id={p.id} retail_price={p.retail_price} name={p.name} router={router} />
          </div>
        ))}
      </div>

      {/* 다시 분석 + MY WORLD */}
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: '8px' }}>
        <div onClick={() => router.push('/skin-analysis')} style={{ flex: 1, padding: '12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', fontSize: '12px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>🔄 다시 분석</div>
        <div onClick={() => router.push('/myworld')} style={{ flex: 1.5, padding: '12px', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '12px', fontSize: '12px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>📊 MY WORLD에서 보기</div>
      </div>

      {/* 하단 네비 */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '390px', height: '80px', background: 'rgba(13,11,9,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px 16px', zIndex: 50 }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🏠</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>HOME</span>
        </div>
        <div onClick={() => router.push('/products')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🛍</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>SHOP</span>
        </div>
        <div style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'linear-gradient(135deg,#C9A96E,#E8C88A)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: '0 4px 24px rgba(201,169,110,0.5)', marginTop: '-22px', flexShrink: 0 }}>
          <span style={{ fontSize: '22px' }}>🔬</span>
          <span style={{ fontSize: '8px', fontWeight: 400, color: BG, fontFamily: 'monospace' }}>AI</span>
        </div>
        <div onClick={() => router.push('/salon')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>📅</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>BOOK</span>
        </div>
        <div onClick={() => router.push('/my')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>👤</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>MY</span>
        </div>
      </nav>
    </div>
  )
}

export default function SkinAnalysisResultPage() {
  return (
    <Suspense fallback={null}>
      <SkinAnalysisResultPageContent />
    </Suspense>
  )
}
