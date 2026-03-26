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

export default function MyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState('유미')
  const [point, setPoint] = useState(0)
  const [orders, setOrders] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [refills, setRefills] = useState<any[]>([])
  const [tracker, setTracker] = useState({ water: 6, uv: 3, sleep: 7.5, routine: 75 })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user)
        const name = data.user.user_metadata?.full_name || data.user.user_metadata?.name
        if (name) setUserName(name)
      }
    })
    // TODO: user_wallets 테이블에서 포인트 조회
    supabase.from('user_wallets').select('balance').single().then(({ data }) => {
      if (data) setPoint(data.balance)
    })
    // TODO: orders 테이블에서 최근 주문 조회
    supabase.from('orders').select('*, order_items(*, products(*))').order('created_at', { ascending: false }).limit(5).then(({ data }) => {
      if (data) setOrders(data)
    })
    // TODO: coupons 테이블에서 사용 가능한 쿠폰 조회
    supabase.from('user_coupons').select('*, coupons(*)').eq('is_used', false).then(({ data }) => {
      if (data) setCoupons(data)
    })
    // TODO: refill_alerts 테이블
    supabase.from('refill_alerts').select('*, products(*)').then(({ data }) => {
      if (data) setRefills(data)
    })
    // TODO: user_daily_tracker 테이블
  }, [])

  const menuItems = [
    { icon: '📦', label: '주문내역', path: '/my/orders', badge: orders.length > 0 ? orders.filter((o: any) => o.status === '배송중').length : 0 },
    { icon: '🎫', label: '쿠폰함', path: '/my/coupons', badge: coupons.length },
    { icon: '❤️', label: '찜 목록', path: '/my/wishlist', badge: 0 },
    { icon: '⭐', label: '리뷰 관리', path: '/my/reviews', badge: 0 },
    { icon: '🔔', label: '알림 설정', path: '/my/notifications', badge: 0 },
    { icon: '👤', label: '개인정보', path: '/my/profile', badge: 0 },
    { icon: '🔒', label: '보안 설정', path: '/my/security', badge: 0 },
    { icon: '📞', label: '고객센터', path: '/my/support', badge: 0 },
  ]

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '96px' }}>

      {/* 탑바 */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER, backdropFilter: 'blur(12px)' }}>
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 400, color: GOLD, letterSpacing: '6px' }}>AURAN</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/my/notifications')} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', cursor: 'pointer' }}>🔔</button>
          <button onClick={() => router.push('/my/settings')} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', cursor: 'pointer' }}>⚙️</button>
        </div>
      </header>

      {/* 프로필 */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: `2px solid rgba(201,169,110,0.3)`, flexShrink: 0 }}>👩</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: 400, marginBottom: '3px' }}>{userName}님</div>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, fontFamily: 'monospace' }}>{user?.email}</div>
          <div onClick={() => router.push('/myworld')} style={{ display: 'inline-block', marginTop: '6px', padding: '3px 10px', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '20px', fontSize: '10px', color: GOLD, cursor: 'pointer' }}>🌍 MY WORLD 보기 ›</div>
        </div>
        <div onClick={() => router.push('/my/profile')} style={{ fontSize: '11px', color: TEXT_DIM, cursor: 'pointer' }}>편집 ›</div>
      </div>

      {/* AURAN POINT */}
      <div onClick={() => router.push('/my/point')} style={{ margin: '14px 16px 0', background: 'linear-gradient(135deg,rgba(201,169,110,0.12),rgba(201,169,110,0.06))', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>✨</span>
          <div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_MUTED, marginBottom: '2px', letterSpacing: '1px' }}>AURAN POINT</div>
            <div style={{ fontSize: '22px', fontWeight: 400 }}>
              <em style={{ color: GOLD, fontStyle: 'normal' }}>{point > 0 ? point.toLocaleString() : '8,888'}P</em>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: TEXT_MUTED, marginBottom: '4px' }}>충전하기</div>
          <div style={{ fontSize: '20px', color: 'rgba(201,169,110,0.35)' }}>›</div>
        </div>
      </div>

      {/* BEAUTY TRACKER */}
      <div style={{ margin: '12px 16px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '18px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_MUTED }}>BEAUTY TRACKER</span>
          <span style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace' }}>
            {new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { icon: '💧', val: `${tracker.water}`, unit: '/8', label: '수분 섭취', pct: (tracker.water / 8) * 100, color: '#6ab0e0' },
            { icon: '🌞', val: `UV`, unit: `${tracker.uv}`, label: '자외선', pct: tracker.uv * 20, color: '#f0c040' },
            { icon: '😴', val: `${tracker.sleep}`, unit: 'h', label: '수면', pct: (tracker.sleep / 10) * 100, color: '#a080e0' },
            { icon: '🧴', val: `${tracker.routine}`, unit: '%', label: '루틴', pct: tracker.routine, color: GOLD },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 400 }}>{item.val}<span style={{ fontSize: '9px', fontWeight: 300 }}>{item.unit}</span></span>
              <span style={{ fontSize: '9px', color: TEXT_MUTED, textAlign: 'center' }}>{item.label}</span>
              <div style={{ width: '100%', height: '2px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                <div style={{ height: '100%', width: `${item.pct}%`, background: item.color, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', fontSize: '9px', color: TEXT_DIM, textAlign: 'center' }}>
          {/* TODO: user_daily_tracker 테이블 연동 */}
          탭하여 오늘 기록 업데이트
        </div>
      </div>

      {/* 소진 알림 */}
      {(refills.length > 0 || true) && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(220,100,40,0.08)', border: '1px solid rgba(220,120,60,0.2)', borderRadius: '16px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(220,150,80,0.9)' }}>🔔 이 제품들 곧 떨어져요!</span>
            <span style={{ fontSize: '10px', color: 'rgba(201,169,110,0.7)', cursor: 'pointer' }}>자동알림 설정 ›</span>
          </div>
          {/* TODO: refill_alerts 테이블에서 user_id 기준 조회 */}
          {[
            { icon: '🧴', name: 'CIVASAN MESS CREAM', pct: 20 },
            { icon: '🌿', name: 'GERNETIC 바이오 세럼', pct: 35 },
          ].map((item, i) => (
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
              <div onClick={() => router.push('/products')} style={{ padding: '5px 10px', background: 'rgba(220,150,60,0.15)', border: '1px solid rgba(220,150,60,0.3)', borderRadius: '8px', fontSize: '10px', color: '#E09040', cursor: 'pointer' }}>재구매</div>
            </div>
          ))}
        </div>
      )}

      {/* 구매 히스토리 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>📋 구매 히스토리</span>
          <span onClick={() => router.push('/my/orders')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>전체보기 ›</span>
        </div>
        {/* TODO: orders 테이블에서 최근 4개 */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
          {[
            { icon: '🧴', date: '03.01', brand: 'CIVASAN', name: 'MESS CREAM', status: '배송완료' },
            { icon: '🌿', date: '02.15', brand: 'GERNETIC', name: '바이오 세럼', status: '배송완료' },
            { icon: '🫧', date: '02.01', brand: 'SHOPBELLE', name: '딥클렌징 폼', status: '배송완료' },
            { icon: '🌊', date: '01.20', brand: 'THALAC', name: '바스솔트', status: '배송완료' },
          ].map((item, i) => (
            <div key={i} style={{ minWidth: '110px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ height: '70px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', position: 'relative' }}>
                {item.icon}
                <span style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '8px', fontFamily: 'monospace', color: TEXT_DIM }}>{item.date}</span>
              </div>
              <div style={{ padding: '7px 8px' }}>
                <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '1px' }}>{item.brand}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '5px' }}>{item.name}</div>
                <div onClick={() => router.push('/products')} style={{ width: '100%', padding: '4px 0', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '6px', fontSize: '9px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>🔄 재구매</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 일촌 피드 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>👥 일촌들의 추천</span>
          <span onClick={() => router.push('/myworld')} style={{ fontSize: '11px', color: GOLD, cursor: 'pointer' }}>MY WORLD ›</span>
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
              &ldquo;MESS CREAM 3번째 재구매! 건성 피부에 진짜 최고 💧&rdquo;
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1, padding: '6px 0', background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', borderRadius: '8px', fontSize: '10px', color: 'rgba(255,120,120,0.8)', textAlign: 'center', cursor: 'pointer' }}>❤️ 공감 12</div>
            <div style={{ flex: 1, padding: '6px 0', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: '8px', fontSize: '10px', color: GOLD, textAlign: 'center', cursor: 'pointer' }}>나도 구매</div>
            <div style={{ flex: 1, padding: '6px 0', background: CARD_BG, border: CARD_BORDER, borderRadius: '8px', fontSize: '10px', color: TEXT_MUTED, textAlign: 'center', cursor: 'pointer' }}>공유</div>
          </div>
        </div>
      </div>

      {/* 메뉴 리스트 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '16px', overflow: 'hidden' }}>
          {menuItems.map((item, i) => (
            <div key={i} onClick={() => router.push(item.path)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: i < menuItems.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{item.label}</span>
              {item.badge > 0 && (
                <div style={{ background: GOLD, borderRadius: '10px', padding: '2px 7px', fontSize: '10px', color: BG, fontWeight: 400 }}>{item.badge}</div>
              )}
              <span style={{ fontSize: '14px', color: TEXT_DIM }}>›</span>
            </div>
          ))}
        </div>
      </div>

      {/* 로그아웃 */}
      <div style={{ padding: '12px 16px 0' }}>
        <div onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ padding: '13px', background: 'rgba(220,60,60,0.06)', border: '1px solid rgba(220,60,60,0.15)', borderRadius: '12px', fontSize: '13px', color: 'rgba(220,100,100,0.8)', textAlign: 'center', cursor: 'pointer' }}>
          로그아웃
        </div>
      </div>

      {/* 하단 네비 */}
      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '390px', height: '80px', background: 'rgba(13,11,9,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px 16px', zIndex: 50 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🏠</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>HOME</span>
        </div>
        <div onClick={() => router.push('/products')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>🛍</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>SHOP</span>
        </div>
        <div onClick={() => router.push('/skin-analysis')} style={{ width: '58px', height: '58px', borderRadius: '50%', background: 'linear-gradient(135deg,#C9A96E,#E8C88A)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', boxShadow: '0 4px 24px rgba(201,169,110,0.5)', marginTop: '-22px', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: '22px' }}>🔬</span>
          <span style={{ fontSize: '8px', fontWeight: 400, color: BG, fontFamily: 'monospace' }}>AI</span>
        </div>
        <div onClick={() => router.push('/salon')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>📅</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: TEXT_DIM, letterSpacing: '1px' }}>BOOK</span>
        </div>
        <div onClick={() => router.push('/my')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '50px', cursor: 'pointer' }}>
          <span style={{ fontSize: '22px' }}>👤</span>
          <span style={{ fontSize: '9px', fontFamily: 'monospace', color: GOLD, letterSpacing: '1px' }}>MY</span>
        </div>
      </nav>

    </div>
  )
}
