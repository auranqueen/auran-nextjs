'use client'

/*
-- 아래 SQL을 Supabase SQL Editor에서 실행하세요:
-- Supabase cron job 또는
-- 매일 자정 실행 권장
--
-- 이 프로젝트 notifications 테이블은 message 대신 body, icon, is_read 등을 사용하고
-- user_id는 public.users.id 입니다. 실행 전 컬럼명·수신자 id를 스키마에 맞게 조정하세요.

CREATE OR REPLACE FUNCTION check_subscription_expiry()
RETURNS void AS $$
DECLARE
  rec RECORD;
  days_left integer;
BEGIN
  FOR rec IN
    SELECT os.*, p.auth_id
    FROM owner_subscriptions os
    JOIN profiles p ON p.id::text = os.owner_id::text
    WHERE os.status = 'active'
    AND os.expires_at BETWEEN now() AND now() + interval '10 days'
  LOOP
    days_left := CEIL(EXTRACT(EPOCH FROM (rec.expires_at - now())) / 86400);

    IF days_left IN (10, 7, 3, 1) THEN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        rec.auth_id,
        '구독 만료 ' || days_left || '일 전이에요 ⏰',
        CASE days_left
          WHEN 10 THEN '지금 갱신하면 끊김 없이 사용할 수 있어요 💜'
          WHEN 7  THEN '차트/처방전이 중단될 수 있어요. 지금 갱신하세요!'
          WHEN 3  THEN '⚠️ 3일 후 구독이 만료돼요. 지금 바로 갱신하세요!'
          WHEN 1  THEN '내일 구독이 만료돼요 😢 갱신하면 바로 복구돼요 💜'
        END,
        'subscription_expiry'
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
*/

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import NoticeBell from '@/components/NoticeBell'
import OwnerQuickMenu from '@/components/OwnerQuickMenu'
import { useIsTrackA } from '@/hooks/useIsTrackA'

const PLAN_COLORS: Record<string, string> = { basic: '#4a8dc0', pro: '#bf5f90', premium: '#c9a84c' }
const GRADE_COLORS: Record<string, string> = { debut: 'var(--text3)', essor: '#4a8dc0', prestige: '#aab8c8', couronne: '#c9a84c', empire: '#bf5f90' }
const GRADE_LABELS: Record<string, string> = { debut: 'DÉBUT', essor: 'ESSOR', prestige: 'PRESTIGE', couronne: 'COURONNE', empire: 'EMPIRE' }
const GRADE_ORDER = ['debut', 'essor', 'prestige', 'couronne', 'empire']
const GRADE_THRESHOLDS = [0, 21, 41, 61, 81, 100] // 각 등급 시작 점수 (debut 0~20, essor 21~40, prestige 41~60, couronne 61~80, empire 81~100)

type ChannelRow = {
  id: string
  title?: string | null
  preview_text?: string | null
  last_message_at?: string | null
  unread_count?: number | null
}

export default function OwnerDashClient({ profile, salon, todayBookings }: { profile: any; salon: any; todayBookings: any[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { isTrackA, ready } = useIsTrackA()
  const [csRows, setCsRows] = useState<any[]>([])
  const [ownerChannels, setOwnerChannels] = useState<ChannelRow[]>([])
  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/login?role=owner')
  }

  const plan = profile.plan || 'basic'
  const grade = profile.store_grade || 'debut'
  const gradeIdxRaw = GRADE_ORDER.indexOf(grade)
  const gradeIdx = gradeIdxRaw >= 0 ? gradeIdxRaw : 0
  const nextGradeHint = gradeIdx >= GRADE_ORDER.length - 1
    ? '최고 등급 달성'
    : `다음 등급: ${GRADE_LABELS[GRADE_ORDER[gradeIdx + 1]] || GRADE_ORDER[gradeIdx + 1].toUpperCase()}까지 성장 중`

  const [activeSub, setActiveSub] = useState<any | null>(null)
  const [subReady, setSubReady] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        const { data: subs } = await supabase
          .from('owner_subscriptions')
          .select('*')
          .eq('owner_id', profile.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        setActiveSub(((subs as any[]) || [])[0] ?? null)
      } catch {
        setActiveSub(null)
      } finally {
        setSubReady(true)
      }
    }
    void run()
  }, [profile.id])

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase
          .from('chat_channels')
          .select('id,title,preview_text,last_message_at,unread_count')
          .eq('channel_type', 'owner')
          .eq('owner_id', profile.id)
          .order('last_message_at', { ascending: false })
        setOwnerChannels((data as ChannelRow[]) || [])
      } catch {
        setOwnerChannels([])
      }
    }
    void run()
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const { data: orderRows } = await supabase.from('orders').select('id').eq('owner_id', profile.id).order('created_at', { ascending: false }).limit(200)
        const orderIds = ((orderRows as any[]) || []).map((r) => r.id).filter(Boolean)
        if (!orderIds.length) {
          setCsRows([])
          return
        }
        const { data } = await supabase
          .from('cs_requests')
          .select('*, orders(*, profiles(username, grade))')
          .in('order_id', orderIds)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)
        setCsRows((data as any[]) || [])
      } catch {
        setCsRows([])
      }
    }
    void run()
  }, [profile.id])

  const [brandProducts, setBrandProducts] = useState<Array<{ id: string; name: string; thumb_img: string | null; brand_name: string }>>([])
  useEffect(() => {
    const fetchBrandProducts = async () => {
      const tradeBrands: string[] = Array.isArray(profile.trade_brands) && profile.trade_brands.length > 0
        ? profile.trade_brands.map(String)
        : Array.isArray((profile as any).preferred_brands)
          ? (profile as any).preferred_brands.map(String)
          : []
      if (tradeBrands.length === 0) return
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data: brandRows } = await supabase
        .from('brands')
        .select('id, name')
        .in('name', tradeBrands)
      if (!brandRows || brandRows.length === 0) return
      const brandIds = brandRows.map((b: { id: string }) => b.id)
      const { data: prodRows } = await supabase
        .from('products')
        .select('id, name, thumb_img, brands(name)')
        .in('brand_id', brandIds)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
      if (prodRows) {
        setBrandProducts(prodRows.map((p: any) => ({
          id: p.id,
          name: p.name || '',
          thumb_img: p.thumb_img || null,
          brand_name: p.brands?.name || '',
        })))
      }
    }
    void fetchBrandProducts()
  }, [profile.id])

  const elapsedText = (createdAt: string) => {
    const ms = Date.now() - new Date(createdAt || '').getTime()
    if (!Number.isFinite(ms) || ms < 0) return '-'
    const h = Math.floor(ms / 3600000)
    if (h < 1) return '방금 전'
    if (h < 24) return `${h}시간 경과`
    return `${Math.floor(h / 24)}일 경과`
  }

  const seoulDateKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const subPlanSlug = String(activeSub?.plan || '').toLowerCase()
  const looksLikeAnnualSub = /year|annual|연간|12m|yr/.test(subPlanSlug)
  const expiryMs = activeSub?.expires_at ? new Date(activeSub.expires_at).getTime() : NaN
  const daysLeft =
    activeSub?.expires_at && Number.isFinite(expiryMs) ? Math.ceil((expiryMs - Date.now()) / 86400000) : null
  const expiryToday =
    activeSub?.expires_at && Number.isFinite(expiryMs) ? seoulDateKey(new Date(activeSub.expires_at)) === seoulDateKey(new Date()) : false
  const showExpirySoon = daysLeft !== null && daysLeft >= 1 && daysLeft <= 7
  const showExpiryToday = daysLeft !== null && (daysLeft <= 0 || expiryToday)
  const showAnnualPromoBanner = !!activeSub && !looksLikeAnnualSub && !showExpiryToday && !showExpirySoon
  const ownerUnreadTotal = ownerChannels.reduce((acc, ch) => acc + Math.max(0, Number(ch.unread_count || 0)), 0)

  const switchRole = async (role: string) => {
    await fetch('/api/profile/active-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (role === 'customer') window.location.href = '/'
    else if (role === 'owner') window.location.href = '/dashboard/owner'
    else if (role === 'partner') window.location.href = '/dashboard/partner'
    else if (role === 'brand') window.location.href = '/dashboard/brand'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 720, margin: '0 auto', paddingBottom: 24, width: '100%' }}>
      {/* 히어로 */}
      <div style={{ background: 'linear-gradient(160deg,#120a18,#0e0814)', borderBottom: '1px solid rgba(191,95,144,0.2)', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(191,95,144,0.5)', letterSpacing: '0.2em', marginBottom: 4 }}>CLINIC COMMAND CENTER</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, color: '#fff', lineHeight: 1.3 }}>{salon?.name || profile.salon_name || profile.name}<br /><span style={{ color: '#bf5f90', fontSize: 14 }}>오늘의 운영 현황</span></div>
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <span style={{ fontSize: 9, padding: '3px 10px', background: `${PLAN_COLORS[plan]}22`, color: PLAN_COLORS[plan], border: `1px solid ${PLAN_COLORS[plan]}44`, borderRadius: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{plan.toUpperCase()}</span>
            <NoticeBell />
            <button
              onClick={() => switchRole('customer')}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 20, padding: '5px 12px',
                fontSize: 11, color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
              }}
            >
              ✦ 고객으로
            </button>
            <button onClick={logout} style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>로그아웃</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[{ l: '오늘 예약', v: `${todayBookings.length}건`, c: '#bf5f90' }, { l: '스토어 등급', v: GRADE_LABELS[grade] || grade.toUpperCase(), c: GRADE_COLORS[grade] || GRADE_COLORS.debut }, { l: '판매 수수료', v: `${profile.store_commission || 0}%`, c: 'var(--gold)' }].map(s => (
            <div key={s.l} style={{ background: 'rgba(191,95,144,0.08)', border: '1px solid rgba(191,95,144,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>{nextGradeHint}</div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        <button
          onClick={() => router.push('/dashboard/owner/chat/redirect')}
          style={{
            width: '100%',
            padding: '16px 18px',
            marginBottom: 10,
            background: '#2D1B4E',
            border: '1px solid rgba(123,94,167,0.5)',
            borderRadius: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#C084FC',
          }}
        >
          <span style={{ fontSize: 22 }}>💬</span>
          <span style={{ fontSize: 15, fontWeight: 500 }}>상담톡</span>
        </button>
        {/* 오늘 예약 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📅 오늘 예약 일정</div>
          {todayBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text3)' }}>오늘 예약이 없습니다</div>
          ) : todayBookings.map(b => (
            <div key={b.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text3)' }}>{b.booking_time}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.service_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>₩{(b.service_price || 0).toLocaleString()}</div>
              </div>
              <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 18, background: b.status === '예약확정' ? 'rgba(76,173,126,0.12)' : 'rgba(201,168,76,0.1)', color: b.status === '예약확정' ? '#4cad7e' : 'var(--gold)', border: `1px solid ${b.status === '예약확정' ? 'rgba(76,173,126,0.3)' : 'rgba(201,168,76,0.3)'}`, fontWeight: 600 }}>{b.status}</span>
            </div>
          ))}
        </div>

        {/* 빠른 메뉴 */}
        <OwnerQuickMenu />

      {ready && isTrackA && brandProducts.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A2E', marginBottom: 10 }}>거래 브랜드 제품</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {brandProducts.map(prod => (
              <div
                key={prod.id}
                style={{ flexShrink: 0, width: 100, borderRadius: 10, border: '1px solid #ede9f7', overflow: 'hidden', background: '#faf9fc', cursor: 'pointer' }}
                onClick={() => router.push('/dashboard/owner/brand-orders')}
              >
                <div style={{ width: '100%', height: 80, background: '#ede9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {prod.thumb_img ? (
                    <img src={prod.thumb_img} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 24 }}>🧴</span>
                  )}
                </div>
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ fontSize: 10, color: '#7B5EA7', marginBottom: 2 }}>{prod.brand_name}</div>
                  <div style={{ fontSize: 11, color: '#1A1A2E', lineHeight: 1.4, wordBreak: 'keep-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prod.name}</div>
                </div>
              </div>
            ))}
            <div
              style={{ flexShrink: 0, width: 100, borderRadius: 10, border: '1px solid #ede9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9fc', cursor: 'pointer', fontSize: 12, color: '#7B5EA7', minHeight: 120 }}
              onClick={() => router.push('/dashboard/owner/brand-orders')}
            >
              더보기 →
            </div>
          </div>
        </div>
      )}

      {subReady ? (
        <div style={{ margin: '12px 16px 0' }}>
          {!activeSub ? (
            <div
              style={{
                background: 'rgba(201,169,110,0.1)',
                border: '1px solid rgba(201,169,110,0.3)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: '#C9A96E' }}>구독 플랜을 선택하고 시작해보세요 💜</div>
              <button
                type="button"
                onClick={() => router.push('/dashboard/owner/subscription')}
                style={{
                  marginTop: 10,
                  border: 'none',
                  background: 'transparent',
                  color: '#C9A96E',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                플랜 보기 →
              </button>
            </div>
          ) : showExpiryToday ? (
            <div
              style={{
                background: 'rgba(255,100,100,0.08)',
                border: '1px solid rgba(255,100,100,0.2)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: '#ff6b6b', lineHeight: 1.55, fontWeight: 700 }}>
                오늘 구독이 만료돼요 😢
                <br />
                갱신하면 바로 복구돼요 💜
              </div>
              <button
                type="button"
                onClick={() => router.push('/dashboard/owner/subscription')}
                style={{
                  marginTop: 10,
                  width: '100%',
                  border: 'none',
                  borderRadius: 10,
                  background: '#ff6b6b',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '10px 0',
                  cursor: 'pointer',
                }}
              >
                지금 갱신하기
              </button>
            </div>
          ) : showExpirySoon ? (
            <div
              style={{
                background: 'rgba(255,100,100,0.08)',
                border: '1px solid rgba(255,100,100,0.2)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: '#ff6b6b' }}>⚠️ 구독이 {daysLeft}일 후 만료돼요</div>
              <button
                type="button"
                onClick={() => router.push('/dashboard/owner/subscription')}
                style={{
                  marginTop: 10,
                  width: '100%',
                  borderRadius: 10,
                  background: 'rgba(255,107,107,0.25)',
                  color: '#ff6b6b',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '10px 0',
                  cursor: 'pointer',
                  border: '1px solid rgba(255,100,100,0.35)',
                }}
              >
                지금 갱신하기
              </button>
            </div>
          ) : null}
          {showAnnualPromoBanner ? (
            <button
              type="button"
              onClick={() => router.push('/dashboard/owner/subscription')}
              style={{
                marginTop: 10,
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                padding: '4px 0 0',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, color: 'rgba(196,167,231,0.7)' }}>연간 구독하면 2개월 무료! 💜</span>
            </button>
          ) : null}
        </div>
      ) : null}

        <div style={{ marginTop: 16, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📋 고객 CS 현황</div>
          {csRows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>소속 고객 CS 요청이 없어요 ✅</div>
          ) : (
            csRows.map((r) => {
              const o = (r as any).orders
              const p = (o as any)?.profiles
              const customerName = String(p?.username || o?.customer_name || '고객')
              const grade = String(p?.grade || '').trim()
              const csType = String((r as any).type || (r as any).cs_type || 'CS')
              const reason = String((r as any).reason || '-')
              const status = String((r as any).status || 'pending')
              return (
                <div key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#fff' }}>
                      {customerName}
                      {grade ? <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#e8d6ff' }}>{grade}</span> : null}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,169,110,0.15)', color: '#C9A96E' }}>{status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#c4a7e7', marginTop: 4 }}>{csType}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{reason}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                    접수일 {r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '-'} · {elapsedText(String(r.created_at || ''))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 구독 안내 */}
        {plan === 'basic' && (
          <div style={{ marginTop: 16, background: 'rgba(191,95,144,0.06)', border: '1px solid rgba(191,95,144,0.2)', borderRadius: 13, padding: '13px 15px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#bf5f90', marginBottom: 6 }}>⭐ PRO 업그레이드</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>PRO 구독 시 스토어 등급 상승 + 판매 수수료 20% 혜택</div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/owner/subscription')}
              style={{ marginTop: 10, width: '100%', padding: '10px', background: 'rgba(191,95,144,0.15)', border: '1px solid rgba(191,95,144,0.35)', borderRadius: 9, color: '#bf5f90', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              ₩29,000/월 PRO 시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
