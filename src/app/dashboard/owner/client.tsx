'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import NoticeBell from '@/components/NoticeBell'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const PLAN_COLORS: Record<string, string> = { basic: '#4a8dc0', pro: '#bf5f90', premium: '#c9a84c' }
const GRADE_COLORS: Record<string, string> = { none: 'var(--text3)', basic: '#4a8dc0', silver: '#aab8c8', gold: '#c9a84c' }

export default function OwnerDashClient({ profile, salon, todayBookings }: { profile: any; salon: any; todayBookings: any[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [csRows, setCsRows] = useState<any[]>([])
  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const plan = profile.plan || 'basic'
  const grade = profile.store_grade || 'none'

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
  }, [profile.id, supabase])

  const elapsedText = (createdAt: string) => {
    const ms = Date.now() - new Date(createdAt || '').getTime()
    if (!Number.isFinite(ms) || ms < 0) return '-'
    const h = Math.floor(ms / 3600000)
    if (h < 1) return '방금 전'
    if (h < 24) return `${h}시간 경과`
    return `${Math.floor(h / 24)}일 경과`
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
            { icon: '📅', label: '예약 관리', color: 'rgba(191,95,144,0.1)', border: 'rgba(191,95,144,0.3)', tc: '#bf5f90' },
            { icon: '👥', label: '고객 관리', color: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)', tc: '#4a8dc0' },
            { icon: '🏪', label: '스토어', color: 'rgba(149,104,212,0.1)', border: 'rgba(149,104,212,0.3)', tc: '#9568d4' },
            { icon: '🖊️', label: '샵 편집', color: 'rgba(76,173,126,0.08)', border: 'rgba(76,173,126,0.25)', tc: '#4cad7e' },
            { icon: '📊', label: '매출 리포트', color: 'rgba(240,160,80,0.08)', border: 'rgba(240,160,80,0.25)', tc: '#f0a050' },
            { icon: '💳', label: '구독 관리', color: 'rgba(191,95,144,0.08)', border: 'rgba(191,95,144,0.2)', tc: '#bf5f90' },
          ].map(m => (
            <button key={m.label} style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '13px 12px', textAlign: 'left' }}>
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
            <button style={{ marginTop: 10, width: '100%', padding: '10px', background: 'rgba(191,95,144,0.15)', border: '1px solid rgba(191,95,144,0.35)', borderRadius: 9, color: '#bf5f90', fontSize: 12, fontWeight: 700 }}>₩29,000/월 PRO 시작하기</button>
          </div>
        )}
      </div>
      <DashboardBottomNav role="salon" />
    </div>
  )
}
