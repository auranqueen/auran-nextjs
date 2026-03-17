'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type AbuseRow = { id: string; user_id: string; description?: string | null; amount?: number | null; created_at: string }
type PaymentErrorRow = { id: string; user_id?: string | null; order_id?: string | null; message?: string | null; created_at: string }
type PendingBrandRow = { id: string; name: string; status: string; created_at: string }

export default function AnomalyPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [abuse, setAbuse] = useState<AbuseRow[]>([])
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrorRow[]>([])
  const [pendingBrands, setPendingBrands] = useState<PendingBrandRow[]>([])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      // 1) 포인트 이상 적립 감지: point_history에서 큰 적립(임계치) 최근 30일
      try {
        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
        const { data } = await supabase
          .from('point_history')
          .select('id,user_id,description,amount,created_at')
          .eq('type', 'earn')
          .gte('created_at', since)
          .gt('amount', 5000)
          .order('created_at', { ascending: false })
          .limit(50)
        setAbuse((data || []) as any)
      } catch {
        setAbuse([])
      }

      // 2) 결제 오류 목록: payments 테이블이 있으면 error 상태 조회 (없으면 빈 배열)
      try {
        const { data } = await supabase
          .from('payments')
          .select('id,user_id,order_id,message,created_at')
          .eq('status', 'error')
          .order('created_at', { ascending: false })
          .limit(50)
        setPaymentErrors((data || []) as any)
      } catch {
        setPaymentErrors([])
      }

      // 3) 입점 신청 대기: brands status=pending
      try {
        const { data } = await supabase
          .from('brands')
          .select('id,name,status,created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50)
        setPendingBrands((data || []) as any)
      } catch {
        setPendingBrands([])
      }

      setLoading(false)
    }
    run()
  }, [supabase])

  const suspendUser = async (userId: string) => {
    if (!confirm('이 사용자를 정지 처리할까요?')) return
    const { error } = await supabase.from('users').update({ status: 'suspended' }).eq('auth_id', userId)
    if (error) alert(error.message)
    else alert('정지 처리 완료')
  }

  const markPaymentChecked = async (id: string) => {
    try {
      const { error } = await supabase.from('payments').update({ status: 'checked' }).eq('id', id)
      if (error) throw error
      setPaymentErrors(prev => prev.filter(x => x.id !== id))
    } catch (e: any) {
      alert(e?.message || '처리 중 오류')
    }
  }

  const holdBrand = async (id: string) => {
    const { error } = await supabase.from('brands').update({ status: 'hold' }).eq('id', id)
    if (error) alert(error.message)
    else setPendingBrands(prev => prev.filter(x => x.id !== id))
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>이상 감지·알림</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
          포인트 남용/결제 오류/입점 신청 대기 상태를 한 번에 확인합니다.
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 포인트 이상 */}
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>⚠️ 포인트 이상 적립</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{abuse.length}건</div>
            </div>
            {abuse.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>이상 적립이 없습니다.</div>
            ) : abuse.map(a => (
              <div key={a.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.description || '포인트 적립'}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                      user={a.user_id?.slice(0, 10)} · {new Date(a.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 900, color: '#c9a84c' }}>
                      +{(a.amount || 0).toLocaleString()}P
                    </div>
                    <button
                      onClick={() => suspendUser(a.user_id)}
                      style={{ marginTop: 6, fontSize: 11, padding: '6px 10px', borderRadius: 10, background: 'rgba(217,79,79,0.12)', border: '1px solid rgba(217,79,79,0.30)', color: '#d94f4f', fontWeight: 900, cursor: 'pointer' }}
                    >
                      정지
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 결제 오류 */}
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>💳 결제 오류</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{paymentErrors.length}건</div>
            </div>
            {paymentErrors.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                결제 오류가 없습니다. (테이블 <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>payments</span> 가 없으면 0건으로 표시됩니다.)
              </div>
            ) : paymentErrors.map(p => (
              <div key={p.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.message || '결제 오류'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                    order={p.order_id?.slice(0, 10) || '-'} · {new Date(p.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>
                <button
                  onClick={() => markPaymentChecked(p.id)}
                  style={{ fontSize: 11, padding: '7px 10px', borderRadius: 10, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.30)', color: '#4cad7e', fontWeight: 900, cursor: 'pointer', flexShrink: 0 }}
                >
                  확인
                </button>
              </div>
            ))}
          </div>

          {/* 입점 신청 대기 */}
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🏭 입점 신청 대기</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{pendingBrands.length}건</div>
            </div>
            {pendingBrands.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>대기 중인 입점 신청이 없습니다.</div>
            ) : pendingBrands.map(b => (
              <div key={b.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{b.name}</div>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{new Date(b.created_at).toLocaleString('ko-KR')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => holdBrand(b.id)}
                    style={{ fontSize: 11, padding: '7px 10px', borderRadius: 10, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.30)', color: '#c9a84c', fontWeight: 900, cursor: 'pointer' }}
                  >
                    보류
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

