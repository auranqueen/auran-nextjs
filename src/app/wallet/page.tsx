'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import PaymentAuthGuard from '@/components/PaymentAuthGuard'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WalletPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [hasPin, setHasPin] = useState<boolean | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer')
        return
      }
      const { data: p } = await supabase.from('users').select('id,points,charge_balance').eq('auth_id', user.id).single()
      setProfile(p || null)
      if (p?.id) {
        const { data: ph } = await supabase
          .from('point_history')
          .select('*')
          .eq('user_id', p.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setHistory(ph || [])
      } else {
        setHistory([])
      }
      try {
        const res = await fetch('/api/auth/pin/status')
        const data = await res.json()
        setHasPin(!!data.hasPin)
      } catch {
        setHasPin(null)
      }
      setLoading(false)
    }
    run()
  }, [router, supabase])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="내 지갑" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : !profile ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>지갑 정보를 불러올 수 없습니다.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.65)', marginBottom: 6 }}>보유 포인트</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{(profile.points || 0).toLocaleString()}P</div>
              </div>
              <div style={{ background: 'rgba(76,173,126,0.10)', border: '1px solid rgba(76,173,126,0.25)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.65)', marginBottom: 6 }}>충전 잔액</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: '#4cad7e' }}>₩{(profile.charge_balance || 0).toLocaleString()}</div>
              </div>
            </div>
            {hasPin === false && (
              <div style={{ marginBottom: 14, padding: 12, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 8 }}>🔐 충전·정산을 위해 결제 PIN을 설정해주세요.</p>
                <button onClick={() => router.push('/auth/set-pin')} style={{ padding: '8px 14px', background: '#c9a84c', border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 600, fontSize: 13 }}>PIN 설정하기</button>
              </div>
            )}
            {hasPin === true && (
              <div style={{ marginBottom: 14 }}>
                <PaymentAuthGuard title="결제 PIN 확인" onSuccess={() => alert('충전 기능 준비 중입니다.')} requirePin>
                  <button type="button" style={{ width: '100%', padding: 14, background: 'rgba(76,173,126,0.2)', border: '1px solid rgba(76,173,126,0.4)', borderRadius: 12, color: '#4cad7e', fontWeight: 700 }}>
                    충전하기
                  </button>
                </PaymentAuthGuard>
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>✨ 포인트 내역</div>
            {history.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>내역이 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(h => (
                  <div key={h.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.description || '포인트 내역'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{h.created_at ? new Date(h.created_at).toLocaleDateString('ko-KR') : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: h.type === 'earn' ? 'var(--gold)' : '#e08080' }}>
                        {h.type === 'earn' ? '+' : ''}{(h.amount || 0).toLocaleString()}P
                      </div>
                      {typeof h.balance === 'number' && (
                        <div style={{ fontSize: 9, color: 'var(--text3)' }}>잔액 {h.balance.toLocaleString()}P</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

