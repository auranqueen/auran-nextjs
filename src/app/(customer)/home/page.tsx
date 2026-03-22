'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

// 폴백 데이터 (Supabase 연동 전)
const FALLBACK_CONCERNS = [
  { id: 1, name: '수분부족', icon: '💧' },
  { id: 2, name: '미백·톤업', icon: '✨' },
  { id: 3, name: '모공·각질', icon: '🔍' },
  { id: 4, name: '민감·진정', icon: '🌿' },
  { id: 5, name: '안티에이징', icon: '⏰' },
  { id: 6, name: '자외선차단', icon: '☀️' },
  { id: 7, name: '탄력·리프팅', icon: '💆' },
]

const FALLBACK_PRODUCTS = [
  { id: 1, name: 'MESS CREAM 50ml', brand: 'CIVASAN', price: 58000, badge: 'AI추천', icon: '🧴' },
  { id: 2, name: '바이오 에센스 세럼', brand: 'GERNETIC', price: 94000, badge: '인기', icon: '🌿' },
  { id: 3, name: '딥클렌징 폼', brand: 'SHOPBELLE', price: 32000, badge: '', icon: '🫧' },
  { id: 4, name: '크리스토 바스솔트', brand: 'THALAC', price: 45000, badge: '', icon: '🌊' },
]

const FALLBACK_SALES = [
  { id: 1, name: 'MESS CREAM 50ml', brand: 'CIVASAN', orig: 58000, sale: 40600, disc: 30, icon: '🧴' },
  { id: 2, name: '바이오 에센스 세럼', brand: 'GERNETIC', orig: 94000, sale: 70500, disc: 25, icon: '🌿' },
  { id: 3, name: '크리스토 마린 바스솔트', brand: 'THALAC', orig: 45000, sale: 36000, disc: 20, icon: '🌊' },
]

const FALLBACK_SALONS = [
  { id: 1, name: '더하노이 풋앤바디', rating: 4.9, reviews: 127, area: '대구 달서구', dist: '0.3km', open: true, tags: ['페이셜', '바디', '아로마'] },
  { id: 2, name: '뷰티클리닉 대구점', rating: 4.7, reviews: 89, area: '대구 수성구', dist: '1.2km', open: true, tags: ['리프팅', '클리닉'] },
  { id: 3, name: '스킨에스테틱', rating: 4.5, reviews: 54, area: '대구 중구', dist: '2.1km', open: false, tags: ['피부관리', '민감성'] },
]

const FALLBACK_NEW = [
  { id: 1, name: '퍼펙트 나이트 크림', brand: 'CIVASAN', price: 68000, icon: '💜' },
  { id: 2, name: '칼밍 에센스 미스트', brand: 'GERNETIC', price: 52000, icon: '🩵' },
  { id: 3, name: '로즈 토닝 패드', brand: 'SHOPBELLE', price: 38000, icon: '🌸' },
  { id: 4, name: '마린 리페어 앰플', brand: 'THALAC', price: 84000, icon: '🌊' },
]

const FALLBACK_BRANDS = [
  { id: 1, name: 'CIVASAN', label: '시바산', color: '#C9A96E', bg: 'rgba(201,169,110,0.1)', border: 'rgba(201,169,110,0.3)' },
  { id: 2, name: 'GERNETIC', label: '제르네틱', color: 'rgba(120,180,240,0.9)', bg: 'rgba(100,160,220,0.1)', border: 'rgba(100,160,220,0.25)' },
  { id: 3, name: 'SHOPBELLE', label: '샵벨르', color: 'rgba(200,150,220,0.9)', bg: 'rgba(180,120,200,0.1)', border: 'rgba(180,120,200,0.25)' },
  { id: 4, name: 'THALAC', label: '탈락', color: 'rgba(80,190,210,0.9)', bg: 'rgba(60,160,180,0.1)', border: 'rgba(60,160,180,0.25)' },
  { id: 5, name: 'SOTHYS', label: '소티스', color: 'rgba(240,180,100,0.9)', bg: 'rgba(220,160,80,0.1)', border: 'rgba(220,160,80,0.25)' },
  { id: 6, name: 'PHYTO', label: '피토머', color: 'rgba(180,220,140,0.9)', bg: 'rgba(160,200,120,0.1)', border: 'rgba(160,200,120,0.25)' },
  { id: 7, name: 'ESTER', label: '에스터', color: 'rgba(240,120,140,0.9)', bg: 'rgba(220,100,120,0.1)', border: 'rgba(220,100,120,0.25)' },
]

const FALLBACK_HISTORY = [
  { icon: '🧴', date: '03.01', brand: 'CIVASAN', name: 'MESS CREAM' },
  { icon: '🌿', date: '02.15', brand: 'GERNETIC', name: '바이오 세럼' },
  { icon: '🫧', date: '02.01', brand: 'SHOPBELLE', name: '딥클렌징 폼' },
  { icon: '🌊', date: '01.20', brand: 'THALAC', name: '바스솔트' },
]

export default function CustomerHomePage() {
  const router = useRouter()
  const supabase = createClient()

  const [userName, setUserName] = useState('유미')
  const [selectedConcern, setSelectedConcern] = useState(0)
  const [saleTab, setSaleTab] = useState<'sale' | 'group'>('sale')
  const [timers, setTimers] = useState([
    { h: 2, m: 34, s: 21 },
    { h: 0, m: 47, s: 55 },
    { h: 5, m: 12, s: 8 },
  ])

  // Supabase 데이터
  const [concerns, setConcerns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [timeSales, setTimeSales] = useState<any[]>([])
  const [salons, setSalons] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [brands, setBrands] = useState<any[]>([])

  useEffect(() => {
    // TODO: user_daily_tracker 테이블에서 오늘 데이터 조회
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name
      if (name) setUserName(name)
    })
    // TODO: skin_concerns 테이블
    supabase.from('skin_concerns').select('*').order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setConcerns(data)
    })
    // TODO: products 테이블 (AI 추천 기준)
    supabase.from('products').select('*').eq('is_active', true).limit(8).then(({ data }) => {
      if (data && data.length > 0) setProducts(data)
    })
    // TODO: time_sales 테이블
    supabase.from('time_sales').select('*, product:products(*)').eq('is_active', true).then(({ data }) => {
      if (data && data.length > 0) setTimeSales(data)
    })
    // TODO: salons 테이블 (위치 기반 정렬)
    supabase.from('salons').select('*').eq('is_active', true).limit(3).then(({ data }) => {
      if (data && data.length > 0) setSalons(data)
    })
    // TODO: products is_new 컬럼
    supabase.from('products').select('*').eq('is_new', true).limit(6).then(({ data }) => {
      if (data && data.length > 0) setNewProducts(data)
    })
    // TODO: brands 테이블
    supabase.from('brands').select('*').eq('is_active', true).limit(7).then(({ data }) => {
      if (data && data.length > 0) setBrands(data)
    })
  }, [])

  // 실시간 타이머
  useEffect(() => {
    const id = setInterval(() => {
      setTimers(prev =>
        prev.map(t => {
          if (t.s > 0) return { ...t, s: t.s - 1 }
          if (t.m > 0) return { ...t, m: t.m - 1, s: 59 }
          if (t.h > 0) return { ...t, h: t.h - 1, m: 59, s: 59 }
          return t
        })
      )
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  // 폴백 적용
  const concernList = concerns.length > 0 ? concerns : FALLBACK_CONCERNS
  const productList = products.length > 0 ? products : FALLBACK_PRODUCTS
  const saleList = timeSales.length > 0 ? timeSales : FALLBACK_SALES
  const salonList = salons.length > 0 ? salons : FALLBACK_SALONS
  const newList = newProducts.length > 0 ? newProducts : FALLBACK_NEW
  const brandList = brands.length > 0 ? brands : FALLBACK_BRANDS

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div style={{
      background: BG,
      minHeight: '100vh',
      maxWidth: '390px',
      margin: '0 auto',
      fontFamily: "'Noto Sans KR', -apple-system, sans-serif",
      fontWeight: 300,
      color: '#fff',
      paddingBottom: '96px',
    }}>

      {/* ── 탑바 ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(13,11,9,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
      }}>
        <span style={{
          fontFamily: 'Georgia, serif',
          fontSize: '22px', fontWeight: 400,
          color: GOLD, letterSpacing: '6px',
        }}>AURAN</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['🔍', '🔔'].map((icon, i) => (
            <button key={i} style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', cursor: 'pointer',
            }}>{icon}</button>
          ))}
        </div>
      </header>

      {/* ── 인사말 ── */}
      <div style={{
        padding: '14px 20px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_MUTED, marginBottom: '4px' }}>
            {today}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 400, marginBottom: '3px' }}>
            안녕하세요, <span style={{ color: GOLD }}>{userName}님</span> 👋
          </div>
          <div style={{ fontSize: '11px', color: TEXT_MUTED }}>
            오늘 루틴 완료 75% · 수분 6/8잔 💧
          </div>
        </div>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px',
        }}>👩</div>
      </div>

      {/* ── BEAUTY TRACKER ── */}
      <div style={{
        margin: '12px 16px 0',
        background: CARD_BG, border: CARD_BORDER,
        borderRadius: '18px', padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_MUTED }}>
            BEAUTY TRACKER
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: TEXT_DIM }}>
            {new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { icon: '💧', val: '6', unit: '/8', label: '수분 섭취', pct: 75, color: '#6ab0e0' },
            { icon: '🌞', val: 'UV', unit: '3', label: '자외선', pct: 40, color: '#f0c040' },
            { icon: '😴', val: '7.5', unit: 'h', label: '수면', pct: 80, color: '#a080e0' },
            { icon: '🧴', val: '75', unit: '%', label: '루틴', pct: 75, color: GOLD },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px', padding: '10px 6px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 400 }}>
                {item.val}<span style={{ fontSize: '9px', fontWeight: 300 }}>{item.unit}</span>
              </span>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>{item.label}</span>
              <div style={{ width: '100%', height: '2px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 히어로 배너 ── */}
      <div style={{
        margin: '12px 16px 0', height: '148px',
        borderRadius: '20px', overflow: 'hidden',
        background: 'linear-gradient(135deg,#1a0a2a,#2d1545)',
        position: 'relative', display: 'flex',
      }}>
        <div style={{
          position: 'relative', zIndex: 2, padding: '18px 20px',
          height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', flex: 1,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.1)', borderRadius: '20px',
              padding: '3px 10px', fontSize: '10px', fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.7)', marginBottom: '7px',
            }}>✦ 3월 · SPRING SKIN</div>
            <div style={{ fontSize: '17px', fontWeight: 300, lineHeight: 1.5 }}>
              봄 피부 변화,<br />
              <em style={{ color: GOLD, fontStyle: 'normal' }}>AI가 먼저</em> 알아챕니다
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '14px', height: '4px', borderRadius: '2px', background: GOLD }} />
            <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
          </div>
        </div>
        <div style={{
          position: 'absolute', right: '16px', top: '50%',
          transform: 'translateY(-50%)', fontSize: '56px', opacity: 0.85,
        }}>🌸</div>
      </div>

      {/* ── TODAY'S SKIN ── */}
      <div
        onClick={() => router.push('/skin-analysis')}
        style={{
          margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER,
          borderRadius: '16px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '30px' }}>💧</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1px', color: TEXT_MUTED, marginBottom: '3px' }}>
            TODAY&apos;S SKIN
          </div>
          <div style={{ fontSize: '14px', fontWeight: 400, marginBottom: '4px' }}>건성 · 민감 복합</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ label: '수분', pct: 62, color: '#6ab0e0' }, { label: '유분', pct: 38, color: GOLD }].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{b.label}</span>
                <div style={{ width: '44px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${b.pct}%`, background: b.color, borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>
        <span style={{ fontSize: '13px', color: TEXT_MUTED }}>›</span>
      </div>

      {/* ── 4대 기능 그리드 ── */}
      <div style={{ margin: '14px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {[
          { icon: '🔬', title: '피부분석', desc: 'AI 정밀 분석', badge: 'AI', path: '/skin-analysis', bg: 'linear-gradient(135deg,rgba(160,80,220,0.15),rgba(120,60,180,0.1))' },
          { icon: '🌍', title: 'MY WORLD', desc: '나만의 미니홈피', badge: 'MY', path: '/my-world', bg: 'linear-gradient(135deg,rgba(60,120,220,0.15),rgba(40,80,180,0.1))' },
          { icon: '💬', title: '커뮤니티', desc: '피부 타입별 소통', badge: 'NEW', path: '/community', bg: 'linear-gradient(135deg,rgba(220,60,60,0.1),rgba(180,40,40,0.08))', badgeColor: '#E04030' },
          { icon: '💆', title: '살롱예약', desc: '전문 관리샵 예약', badge: '근처', path: '/salon', bg: 'linear-gradient(135deg,rgba(60,180,120,0.12),rgba(40,140,90,0.08))' },
        ].map((f, i) => (
          <div
            key={i}
            onClick={() => router.push(f.path)}
            style={{
              background: f.bg, border: CARD_BORDER,
              borderRadius: '20px', padding: '16px 14px',
              cursor: 'pointer', position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: '10px', right: '10px',
              background: f.badgeColor || 'rgba(201,169,110,0.2)',
              color: f.badgeColor ? '#fff' : GOLD,
              fontSize: '9px', padding: '2px 7px', borderRadius: '6px',
            }}>{f.badge}</div>
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>{f.icon}</span>
            <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '3px' }}>{f.title}</div>
            <div style={{ fontSize: '10px', color: TEXT_MUTED }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* ── AURAN POINT ── */}
      <div style={{
        margin: '14px 16px 0',
        background: CARD_BG, border: '1px solid rgba(201,169,110,0.2)',
        borderRadius: '14px', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>✨</span>
          <div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_MUTED, marginBottom: '2px' }}>AURAN POINT</div>
            {/* TODO: user_wallets 테이블에서 포인트 조회 */}
            <div style={{ fontSize: '14px', fontWeight: 400 }}>
              <em style={{ color: GOLD, fontStyle: 'normal' }}>8,888P</em>{' '}
              <span style={{ color: TEXT_MUTED, fontSize: '11px' }}>보유중</span>
            </div>
          </div>
        </div>
        <span style={{ fontSize: '16px', color: 'rgba(201,169,110,0.35)' }}>›</span>
      </div>

      {/* ── 내 피부 맞춤 추천 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>내 피부 맞춤 추천</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>더보기 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {productList.slice(0, 4).map((p: any, i: number) => (
          <div
            key={i}
            onClick={() => router.push(`/products/${p.id}`)}
            style={{
              minWidth: '130px', background: CARD_BG, border: CARD_BORDER,
              borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              height: '90px',
              background: 'linear-gradient(135deg,#1a1510,#2a2015)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '34px', position: 'relative',
            }}>
              {p.icon || '🧴'}
              {p.badge && (
                <div style={{
                  position: 'absolute', top: '5px', left: '5px',
                  background: 'rgba(201,169,110,0.85)', color: BG,
                  fontSize: '8px', padding: '2px 5px', borderRadius: '4px',
                }}>{p.badge}</div>
              )}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{p.brand}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '4px' }}>{p.name}</div>
              <div style={{ fontSize: '12px', fontWeight: 400 }}>{p.price?.toLocaleString()}원</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── DUCHESS.KR 구분선 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 16px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '2px', color: TEXT_DIM }}>DUCHESS.KR STORE</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* ── 피부 고민별 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>피부 고민별 솔루션</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {concernList.map((c: any, i: number) => (
          <div
            key={i}
            onClick={() => setSelectedConcern(i)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', minWidth: '58px', cursor: 'pointer' }}
          >
            <div style={{
              width: '52px', height: '52px', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
              background: i === selectedConcern ? 'rgba(201,169,110,0.12)' : CARD_BG,
              border: i === selectedConcern ? '1px solid rgba(201,169,110,0.3)' : CARD_BORDER,
            }}>{c.icon || '💧'}</div>
            <span style={{
              fontSize: '9px', fontWeight: 300, textAlign: 'center', whiteSpace: 'nowrap',
              color: i === selectedConcern ? GOLD : TEXT_MUTED,
            }}>{c.name}</span>
          </div>
        ))}
      </div>

      {/* ── BEST 랭킹 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>
            🏆 {concernList[selectedConcern]?.name} BEST
          </span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>더보기 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {productList.slice(0, 4).map((p: any, i: number) => {
          const rankColors = ['#C9A96E', 'rgba(180,180,180,0.8)', 'rgba(180,120,60,0.8)']
          return (
            <div key={i} style={{
              minWidth: '150px', background: CARD_BG, border: CARD_BORDER,
              borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
            }}>
              <div style={{
                height: '110px',
                background: 'linear-gradient(135deg,#1a1510,#2a2015)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '38px', position: 'relative',
              }}>
                {p.icon || '🧴'}
                <div style={{
                  position: 'absolute', top: '7px', left: '7px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: rankColors[i] || 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 400,
                  color: i === 0 ? BG : '#fff',
                }}>{i + 1}</div>
                {i === 0 && (
                  <div style={{
                    position: 'absolute', top: '7px', right: '7px',
                    background: 'rgba(201,169,110,0.85)', color: BG,
                    fontSize: '8px', padding: '2px 5px', borderRadius: '4px',
                  }}>AI추천</div>
                )}
              </div>
              <div style={{ padding: '9px 11px' }}>
                <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{p.brand}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginBottom: '5px' }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 400 }}>{p.price?.toLocaleString()}원</span>
                  <span style={{ fontSize: '14px', cursor: 'pointer' }}>🤍</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ flex: 1, padding: '7px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '9px', color: 'rgba(255,255,255,0.55)', textAlign: 'center', cursor: 'pointer' }}>🛒 담기</div>
                  <div style={{ flex: 1, padding: '7px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '9px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>🎁 선물</div>
                  <div style={{ flex: 1.3, padding: '7px 0', background: GOLD, borderRadius: '8px', fontSize: '9px', fontWeight: 400, color: BG, textAlign: 'center', cursor: 'pointer' }}>바로구매</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 롤링 리뷰 ── */}
      <div style={{ margin: '16px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_DIM }}>⭐ 실시간 리뷰</span>
          <span onClick={() => router.push('/reviews')} style={{ fontSize: '10px', color: GOLD, cursor: 'pointer' }}>전체보기 →</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🧴</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', marginBottom: '3px' }}>⭐⭐⭐⭐⭐</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
              &quot;환절기에 이 크림 덕분에 피부 안 땅겼어요. 민감한 피부에도 자극 없이 쓸 수 있어요 💧&quot;
            </div>
            <div style={{ fontSize: '9px', color: TEXT_DIM, marginTop: '3px' }}>건성피부 · 유미님 · CIVASAN MESS CREAM</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', gap: '6px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '3px 8px', background: 'rgba(255,255,255,0.04)',
                border: CARD_BORDER, borderRadius: '6px',
                fontSize: '10px', color: TEXT_MUTED, cursor: 'pointer',
              }}>👍 도움돼요 24</div>
              <span style={{ fontSize: '9px', color: 'rgba(201,169,110,0.6)' }}>+5P 적립</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 타임세일·공구 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>⚡ 타임세일 · 공구</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
        {/* 탭 */}
        <div style={{ display: 'flex', border: CARD_BORDER, borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
          {(['sale', 'group'] as const).map((tab) => (
            <div
              key={tab}
              onClick={() => setSaleTab(tab)}
              style={{
                flex: 1, padding: '9px 0', textAlign: 'center', fontSize: '12px',
                fontWeight: saleTab === tab ? 400 : 300,
                background: saleTab === tab
                  ? (tab === 'sale' ? 'rgba(200,60,40,0.15)' : 'rgba(60,80,200,0.15)')
                  : 'transparent',
                color: saleTab === tab
                  ? (tab === 'sale' ? '#E07060' : 'rgba(120,160,255,0.9)')
                  : TEXT_MUTED,
                cursor: 'pointer',
              }}
            >
              {tab === 'sale' ? '🔥 타임세일' : '👥 공동구매'}
            </div>
          ))}
        </div>

        {/* 타임세일 */}
        {saleTab === 'sale' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {saleList.map((item: any, i: number) => (
              <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '12px',
                    background: 'linear-gradient(135deg,#1a1510,#2a2015)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '28px', flexShrink: 0, position: 'relative',
                  }}>
                    {item.icon || '🧴'}
                    <div style={{
                      position: 'absolute', top: '-4px', right: '-4px',
                      background: '#E04030', borderRadius: '20px', padding: '2px 6px',
                      fontSize: '9px', color: '#fff', border: `1.5px solid ${BG}`,
                    }}>-{item.disc}%</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>
                      {item.brand || item.product?.brand}
                    </div>
                    <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                      {item.name || item.product?.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', color: TEXT_DIM, textDecoration: 'line-through' }}>
                        {(item.orig || item.original_price)?.toLocaleString()}원
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 400, color: '#E07060' }}>
                        {(item.sale || item.sale_price)?.toLocaleString()}원
                      </span>
                    </div>
                    {/* 개별 타이머 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '9px', color: TEXT_DIM }}>⏱ 마감</span>
                      {[timers[i]?.h, timers[i]?.m, timers[i]?.s].map((v, ti) => (
                        <span key={ti} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {ti > 0 && <span style={{ color: 'rgba(220,60,40,0.4)', fontSize: '11px' }}>:</span>}
                          <span style={{
                            background: 'rgba(220,60,40,0.15)',
                            border: '1px solid rgba(220,60,40,0.28)',
                            borderRadius: '5px', padding: '2px 6px',
                            fontSize: '11px', color: '#E07060', fontFamily: 'monospace',
                          }}>{pad(v || 0)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
                  <div style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', cursor: 'pointer' }}>🛒 담기</div>
                  <div style={{ flex: 1, padding: '8px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(200,140,220,0.9)', textAlign: 'center', cursor: 'pointer' }}>🎁 선물</div>
                  <div style={{ flex: 1.3, padding: '8px 0', background: '#C04030', borderRadius: '8px', fontSize: '11px', fontWeight: 400, color: '#fff', textAlign: 'center', cursor: 'pointer' }}>지금 구매</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 공동구매 */}
        {saleTab === 'group' && (
          <div style={{ background: CARD_BG, border: '1px solid rgba(80,120,220,0.2)', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg,rgba(60,80,200,0.15),rgba(80,120,240,0.1))', padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'rgba(120,160,255,0.9)', fontFamily: 'monospace' }}>👥 공동구매 · 목표 달성시 발송</span>
              <span style={{ fontSize: '10px', color: TEXT_MUTED }}>127/200명</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', width: '63%', background: 'linear-gradient(90deg,#4060C0,#8090E0)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>🧴</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>CIVASAN</div>
                <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>MESS CREAM 더블세트</div>
                <div style={{ fontSize: '10px', color: 'rgba(120,160,255,0.8)', marginBottom: '4px' }}>🎯 200명 달성 시 발송 · 73명 더 필요</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: TEXT_DIM, textDecoration: 'line-through' }}>116,000원</span>
                  <span style={{ fontSize: '15px', color: 'rgba(120,160,255,0.9)' }}>69,600원 (-40%)</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', padding: '0 12px 10px' }}>
              <div style={{ flex: 2, padding: '9px 0', background: 'linear-gradient(135deg,#4060C0,#6080E0)', borderRadius: '8px', fontSize: '11px', color: '#fff', textAlign: 'center', cursor: 'pointer' }}>👥 공구 참여하기</div>
              <div style={{ flex: 1, padding: '9px 0', background: 'rgba(80,120,220,0.1)', border: '1px solid rgba(80,120,220,0.25)', borderRadius: '8px', fontSize: '11px', color: 'rgba(120,160,255,0.8)', textAlign: 'center', cursor: 'pointer' }}>📤 친구 초대</div>
            </div>
          </div>
        )}
      </div>

      {/* ── 살롱 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>📍 내 주변 관리샵</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>지도보기 ›</span>
        </div>
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
          {['📍 거리순', '🔥 인기순', '⭐ 리뷰순', '💆 페이셜', '🌿 바디', '✨ 클리닉'].map((f, i) => (
            <div key={i} style={{
              padding: '5px 12px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '10px',
              background: i === 0 ? 'rgba(201,169,110,0.15)' : CARD_BG,
              border: i === 0 ? '1px solid rgba(201,169,110,0.4)' : CARD_BORDER,
              borderRadius: '20px',
              color: i === 0 ? GOLD : TEXT_MUTED,
            }}>{f}</div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {salonList.map((salon: any, i: number) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', padding: '13px 14px', display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a1520,#2a1a30)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>💆</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 400, marginBottom: '2px' }}>{salon.name}</div>
                <div style={{ fontSize: '10px', color: TEXT_MUTED, marginBottom: '4px' }}>
                  {salon.open && (
                    <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#3ab870', marginRight: '4px' }} />
                  )}
                  ⭐ {salon.rating} · 리뷰 {salon.reviews} · {salon.area}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(salon.tags || []).map((tag: string, ti: number) => (
                    <span key={ti} style={{ fontSize: '8px', background: 'rgba(255,255,255,0.05)', color: TEXT_MUTED, borderRadius: '5px', padding: '2px 6px' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                <div style={{
                  fontSize: '9px', padding: '3px 8px', borderRadius: '10px',
                  background: salon.open ? 'rgba(74,200,120,0.15)' : 'rgba(200,80,80,0.1)',
                  color: salon.open ? '#3ab870' : '#c05050',
                }}>{salon.open ? '영업중' : '영업종료'}</div>
                <div style={{ fontSize: '9px', color: TEXT_DIM }}>{salon.dist}</div>
                <div style={{ padding: '6px 10px', background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: '8px', fontSize: '10px', color: GOLD, cursor: 'pointer' }}>예약하기</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 소진 알림 ── */}
      <div style={{ margin: '16px 16px 0', background: 'rgba(220,100,40,0.08)', border: '1px solid rgba(220,120,60,0.2)', borderRadius: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(220,150,80,0.9)' }}>🔔 이 제품들 곧 떨어져요!</span>
          <span style={{ fontSize: '10px', color: 'rgba(201,169,110,0.7)', cursor: 'pointer' }}>자동알림 설정 ›</span>
        </div>
        {/* TODO: refill_alerts 테이블에서 user_id 기준 조회 */}
        {[{ icon: '🧴', name: 'CIVASAN MESS CREAM', pct: 20 }, { icon: '🌿', name: 'GERNETIC 바이오 세럼', pct: 35 }].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i === 0 ? '8px' : 0 }}>
            <span style={{ fontSize: '22px' }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 400, marginBottom: '3px' }}>{item.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${item.pct}%`, background: i === 0 ? 'linear-gradient(90deg,#E07030,#C05020)' : 'linear-gradient(90deg,#E0A030,#C08020)', borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '9px', color: TEXT_MUTED }}>{item.pct}% 남음</span>
              </div>
            </div>
            <div style={{ padding: '5px 10px', background: 'rgba(220,150,60,0.15)', border: '1px solid rgba(220,150,60,0.3)', borderRadius: '8px', fontSize: '10px', color: '#E09040', cursor: 'pointer' }}>재구매</div>
          </div>
        ))}
      </div>

      {/* ── 구매 히스토리 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>📋 내 구매 히스토리</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체보기 ›</span>
        </div>
      </div>
      {/* TODO: user_products 테이블에서 최근 4개 조회 */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {FALLBACK_HISTORY.map((item, i) => (
          <div key={i} style={{ minWidth: '110px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '70px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', position: 'relative' }}>
              {item.icon}
              <span style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '8px', fontFamily: 'monospace', color: TEXT_DIM }}>{item.date}</span>
            </div>
            <div style={{ padding: '7px 8px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '1px' }}>{item.brand}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>{item.name}</div>
              <div style={{ width: '100%', padding: '4px 0', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '6px', fontSize: '9px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>🔄 재구매</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 일촌 피드 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>👥 일촌들의 추천</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>더보기 ›</span>
        </div>
        {/* TODO: friend_activities 테이블 연동 */}
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🌺</div>
            <div style={{ flex: 1, fontSize: '11px', fontWeight: 400 }}>소미님</div>
            <span style={{ fontSize: '9px', color: TEXT_DIM }}>방금</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🧴</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, flex: 1 }}>
              &quot;MESS CREAM 3번째 재구매! 건성 피부에 진짜 최고 💧&quot;
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1, padding: '6px 0', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', borderRadius: '8px', fontSize: '10px', color: 'rgba(255,120,120,0.8)', textAlign: 'center', cursor: 'pointer' }}>❤️ 공감 12</div>
            <div style={{ flex: 1, padding: '6px 0', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px', fontSize: '10px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>나도 구매</div>
            <div style={{ flex: 1, padding: '6px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '8px', fontSize: '10px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>공유</div>
          </div>
        </div>
      </div>

      {/* ── 신제품 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>🆕 새로 나왔어요</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 ›</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
        {newList.map((item: any, i: number) => (
          <div key={i} onClick={() => router.push(`/products/${item.id}`)} style={{ minWidth: '130px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ height: '90px', background: 'linear-gradient(135deg,#1a0a2a,#2a1540)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', position: 'relative' }}>
              {item.icon || '💜'}
              <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'linear-gradient(90deg,#6040E0,#A040E0)', borderRadius: '5px', padding: '2px 6px', fontSize: '8px', color: '#fff' }}>NEW</div>
            </div>
            <div style={{ padding: '9px 10px' }}>
              <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '2px' }}>{item.brand}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, marginBottom: '4px' }}>{item.name}</div>
              <div style={{ fontSize: '12px', fontWeight: 400 }}>{item.price?.toLocaleString()}원</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 브랜드 원형 그리드 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>🏷 브랜드별 보기</span>
          <span style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체 브랜드 ›</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
          {['전체', '🇪🇺 유럽', '🇰🇷 국내', '🇯🇵 일본', '클리닉', '바디'].map((tab, i) => (
            <div key={i} style={{
              padding: '4px 12px', whiteSpace: 'nowrap', cursor: 'pointer', fontSize: '10px',
              background: i === 0 ? GOLD : CARD_BG,
              border: i === 0 ? 'none' : CARD_BORDER,
              borderRadius: '20px',
              color: i === 0 ? BG : TEXT_MUTED,
              fontWeight: i === 0 ? 400 : 300,
            }}>{tab}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          {brandList.map((brand: any, i: number) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <div style={{
                width: '58px', height: '58px', borderRadius: '50%',
                background: brand.bg || 'rgba(201,169,110,0.1)',
                border: `1.5px solid ${brand.border || 'rgba(201,169,110,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 400,
                color: brand.color || GOLD,
                fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.3,
              }}>
                {brand.name?.slice(0, 4)}<br />{brand.name?.slice(4, 8)}
              </div>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>
                {brand.label || brand.name}
              </span>
            </div>
          ))}
          {/* 더보기 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <div style={{
              width: '58px', height: '58px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px dashed rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '2px',
            }}>
              <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>+</span>
              <span style={{ fontSize: '8px', color: TEXT_DIM }}>23개</span>
            </div>
            <span style={{ fontSize: '9px', color: TEXT_DIM }}>전체보기</span>
          </div>
        </div>
      </div>

      {/* ── 푸터 ── */}
      <div style={{ margin: '20px 16px 0', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 400, color: '#C9A96E', letterSpacing: '4px' }}>AURAN</span>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginLeft: '8px' }}>· DUCHESS.KR</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {['공지사항', 'FAQ', '1:1문의', '개인정보처리방침', '이용약관'].map((item, i) => (
            <span key={i} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}>{item}</span>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.2)', lineHeight: 2 }}>
          <div>대표 : 박유미 · 사업자등록번호 : 197-87-01357</div>
          <div>대구광역시 · support@auran.kr</div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>© 2026 AURAN. All rights reserved.</div>
        </div>
      </div>
      {/* ── 하단 네비게이션 ── */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '390px', height: '80px',
        background: 'rgba(13,11,9,0.96)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 10px 16px', zIndex: 50,
      }}>
        <div onClick={() => router.push('/home')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>🏠</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: GOLD }}>HOME</span>
        </div>
        <div onClick={() => router.push('/products')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>🛍️</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM }}>SHOP</span>
        </div>
        <div
          onClick={() => router.push('/skin-analysis')}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#C9A96E,#E8C88A)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '2px', boxShadow: '0 4px 20px rgba(201,169,110,0.4)',
            marginTop: '-20px', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '20px' }}>🔬</span>
          <span style={{ fontSize: '8px', fontWeight: 400, color: BG, fontFamily: 'monospace' }}>AI분석</span>
        </div>
        <div onClick={() => router.push('/salon')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>📅</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM }}>예약</span>
        </div>
        <div onClick={() => router.push('/my')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM }}>MY</span>
        </div>
      </nav>

    </div>
  )
}
