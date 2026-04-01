'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import NoticeBell from '@/components/NoticeBell'
import DashboardBottomNav from '@/components/DashboardBottomNav'

export default function PartnerDashClient({ profile }: { profile: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [csRows, setCsRows] = useState<any[]>([])
  const myLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://auran.kr'}/join/customer?ref=${profile.referral_code || 'XXXXXX'}`

  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const gradeColors: Record<string, string> = { rookie: '#9568d4', silver: '#aab8c8', gold: '#c9a84c', platinum: '#e8c870' }
  const grade = profile.partner_grade || 'rookie'

  useEffect(() => {
    const run = async () => {
      try {
        const { data: orderRows } = await supabase
          .from('orders')
          .select('id, customer_id, share_toast_amount')
          .eq('referrer_user_id', profile.auth_id)
          .order('created_at', { ascending: false })
          .limit(200)
        const orderIds = ((orderRows as any[]) || []).map((o) => o.id).filter(Boolean)
        const orderMap = Object.fromEntries(((orderRows as any[]) || []).map((o) => [o.id, o]))
        if (!orderIds.length) {
          setCsRows([])
          return
        }
        const { data: cs } = await supabase
          .from('cs_requests')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          .limit(5)
        const customerAuthIds = Array.from(new Set(((orderRows as any[]) || []).map((o) => o.customer_id).filter(Boolean)))
        let nameMap: Record<string, string> = {}
        if (customerAuthIds.length) {
          const { data: profs } = await supabase.from('profiles').select('auth_id, username, full_name').in('auth_id', customerAuthIds)
          nameMap = Object.fromEntries(((profs as any[]) || []).map((p) => [p.auth_id, p.username || p.full_name || '고객']))
        }
        setCsRows(
          ((cs as any[]) || []).map((r) => ({
            ...r,
            _customerName: nameMap[String(orderMap[r.order_id]?.customer_id || '')] || '고객',
            _shareToRecover: Number(orderMap[r.order_id]?.share_toast_amount || 0),
          }))
        )
      } catch {
        setCsRows([])
      }
    }
    void run()
  }, [profile.auth_id, supabase])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(160deg,#090b12,#0f1320)', borderBottom: '1px solid rgba(74,141,192,0.2)', padding: '20px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(74,141,192,0.5)', letterSpacing: '0.2em', marginBottom: 4 }}>PARTNER DASHBOARD</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: '#fff' }}>{profile.name} <span style={{ color: '#4a8dc0' }}>파트너스</span></div>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <span style={{ fontSize: 9, padding: '3px 10px', background: `${gradeColors[grade]}22`, color: gradeColors[grade], border: `1px solid ${gradeColors[grade]}44`, borderRadius: 18, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{grade.toUpperCase()}</span>
            <NoticeBell />
            <button onClick={logout} style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>로그아웃</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[{ l: '커미션율', v: `${profile.commission_rate || 5}%`, c: '#4a8dc0' }, { l: '이달 수익', v: '₩0', c: 'var(--gold)' }, { l: '보유 포인트', v: `${(profile.points || 0).toLocaleString()}P`, c: '#4cad7e' }].map(s => (
            <div key={s.l} style={{ background: 'rgba(74,141,192,0.08)', border: '1px solid rgba(74,141,192,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        {/* 내 추천 링크 */}
        <div style={{ background: 'rgba(74,141,192,0.06)', border: '1px solid rgba(74,141,192,0.25)', borderRadius: 13, padding: '14px 15px', marginBottom: 16 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#4a8dc0', letterSpacing: '0.1em', marginBottom: 8 }}>MY REFERRAL LINK</div>
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#4a8dc0', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all', marginBottom: 10 }}>{myLink}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => { navigator.clipboard?.writeText(myLink); alert('복사됐습니다!') }} style={{ padding: '11px', background: 'rgba(74,141,192,0.15)', border: '1px solid rgba(74,141,192,0.35)', borderRadius: 9, color: '#4a8dc0', fontSize: 11, fontWeight: 700 }}>🔗 링크 복사</button>
            <button style={{ padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text3)', fontSize: 11 }}>📤 공유하기</button>
          </div>
        </div>

        {/* 추천 통계 */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 15px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📊 이달 링크 성과</div>
          {[{ l: '링크 클릭', v: '0회', c: '#4a8dc0' }, { l: '가입 전환', v: '0명', c: 'var(--gold)' }, { l: '구매 전환', v: '0건', c: '#4cad7e' }, { l: '발생 수익', v: '₩0', c: '#c9a84c' }].map(s => (
            <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{s.l}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: s.c }}>{s.v}</span>
            </div>
          ))}
        </div>

        {/* 등급 안내 */}
        <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 13, padding: '13px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>🏆 파트너 등급 혜택</div>
          {[{ g: 'ROOKIE', pct: '5%', req: '가입 즉시' }, { g: 'SILVER', pct: '8%', req: '추천 10명+' }, { g: 'GOLD', pct: '12%', req: '추천 30명+' }, { g: 'PLATINUM', pct: '15%', req: '추천 100명+' }].map(g => (
            <div key={g.g} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 11, color: g.g.toLowerCase() === grade ? 'var(--gold)' : 'var(--text3)', fontWeight: g.g.toLowerCase() === grade ? 700 : 400 }}>{g.g.toLowerCase() === grade ? '▶ ' : ''}{g.g}</span>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{g.req}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>{g.pct}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 13, padding: '13px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📋 추천 고객 CS 현황</div>
          {csRows.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>추천 고객 CS 요청이 없어요 ✅</div>
          ) : (
            csRows.map((r) => {
              const csType = String((r as any).type || (r as any).cs_type || 'CS')
              const status = String((r as any).status || 'pending')
              return (
                <div key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
                  <div style={{ fontSize: 12, color: '#fff' }}>{String((r as any)._customerName || '고객')}</div>
                  <div style={{ fontSize: 11, color: '#c4a7e7', marginTop: 4 }}>{csType}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                    접수일 {r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '-'} · 공유토스트 회수 예정 {Number((r as any)._shareToRecover || 0).toLocaleString()}T
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>상태: {status}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <DashboardBottomNav role="partner" />
    </div>
  )
}
