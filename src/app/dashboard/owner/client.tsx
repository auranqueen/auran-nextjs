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
import DashboardBottomNav from '@/components/DashboardBottomNav'

const PLAN_COLORS: Record<string, string> = { basic: '#4a8dc0', pro: '#bf5f90', premium: '#c9a84c' }
const GRADE_COLORS: Record<string, string> = { none: 'var(--text3)', basic: '#4a8dc0', silver: '#aab8c8', gold: '#c9a84c' }

export default function OwnerDashClient({ profile, salon, todayBookings }: { profile: any; salon: any; todayBookings: any[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [csRows, setCsRows] = useState<any[]>([])
  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const plan = profile.plan || 'basic'
  const grade = profile.store_grade || 'none'

  const [activeSub, setActiveSub] = useState<any | null>(null)
  const [ownerMode, setOwnerMode] = useState<string | null>(null)
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

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('owner_mode').eq('auth_id', user.id).maybeSingle()
          setOwnerMode((prof as any)?.owner_mode ?? null)
        } else {
          setOwnerMode(null)
        }
      } catch {
        setActiveSub(null)
        setOwnerMode(null)
      } finally {
        setSubReady(true)
      }
    }
    void run()
  }, [profile.id])

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
  const showIndependentStoreBtn =
    !!activeSub && (ownerMode === 'independent' || ownerMode === 'both')
  const showAnnualPromoBanner = !!activeSub && !looksLikeAnnualSub && !showExpiryToday && !showExpirySoon

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
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
          {[{ l: '오늘 예약', v: `${todayBookings.length}건`, c: '#bf5f90' }, { l: '스토어 등급', v: grade.toUpperCase(), c: GRADE_COLORS[grade] }, { l: '판매 수수료', v: `${profile.store_commission || 0}%`, c: 'var(--gold)' }].map(s => (
            <div key={s.l} style={{ background: 'rgba(191,95,144,0.08)', border: '1px solid rgba(191,95,144,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

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
          {activeSub && showIndependentStoreBtn ? (
            <button
              type="button"
              onClick={() => router.push('/dashboard/owner/store')}
              style={{
                marginTop: 10,
                width: '100%',
                borderRadius: 12,
                border: '1px solid rgba(149,104,212,0.45)',
                background: 'rgba(149,104,212,0.12)',
                color: '#c4a7e7',
                fontSize: 12,
                fontWeight: 700,
                padding: '11px 12px',
                cursor: 'pointer',
              }}
            >
              내 스토어 관리 →
            </button>
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

      <div style={{ padding: '18px 18px 0' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {[
            { icon: '📅', label: '예약 관리', color: 'rgba(191,95,144,0.1)', border: 'rgba(191,95,144,0.3)', tc: '#bf5f90', href: '/dashboard/owner/bookings' },
            { icon: '👥', label: '고객 관리', color: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)', tc: '#4a8dc0', href: '/dashboard/owner/customers' },
            { icon: '🏪', label: '스토어', color: 'rgba(149,104,212,0.1)', border: 'rgba(149,104,212,0.3)', tc: '#9568d4', href: '/dashboard/owner/store' },
            { icon: '🖊️', label: '샵 편집', color: 'rgba(76,173,126,0.08)', border: 'rgba(76,173,126,0.25)', tc: '#4cad7e', href: '/dashboard/owner/edit' },
            { icon: '📊', label: '매출 리포트', color: 'rgba(240,160,80,0.08)', border: 'rgba(240,160,80,0.25)', tc: '#f0a050', href: '/dashboard/owner/revenue' },
            { icon: '💳', label: '구독 관리', color: 'rgba(191,95,144,0.08)', border: 'rgba(191,95,144,0.2)', tc: '#bf5f90', href: '/dashboard/owner/subscription' },
          ].map(m => (
            <button
              key={m.label}
              type="button"
              onClick={() => router.push(m.href)}
              style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '13px 12px', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.tc }}>{m.label}</div>
            </button>
          ))}
        </div>

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
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>PRO 구독 시 스토어 SILVER 등급 + 판매 수수료 20% 혜택</div>
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
      <DashboardBottomNav role="salon" />
    </div>
  )
}
