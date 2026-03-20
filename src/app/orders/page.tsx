'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [paymentDone, setPaymentDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    setPaymentDone(q.get('payment') === 'done')
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer')
        return
      }
      const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (!profile?.id) {
        setOrders([])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('orders')
        .select('id,order_no,status,final_amount,ordered_at,order_items(product_name,quantity)')
        .eq('customer_id', profile.id)
        .order('ordered_at', { ascending: false })
        .limit(20)
      setOrders(data || [])
      setLoading(false)
    }
    run()
  }, [router, supabase])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="구매내역" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        {paymentDone && (
          <div style={{ marginBottom: 12, padding: 12, background: 'rgba(76,173,126,0.12)', border: '1px solid rgba(76,173,126,0.35)', borderRadius: 12, fontSize: 13, color: '#4cad7e', fontWeight: 600 }}>
            결제가 완료되었습니다.
          </div>
        )}
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : orders.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>구매 내역이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map(o => (
              <div key={o.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text3)' }}>{o.order_no}</div>
                  <div style={{ fontSize: 11, color: 'var(--gold)' }}>{o.status}</div>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#fff', fontWeight: 700 }}>
                  {o.order_items?.[0]?.product_name || '주문 상품'}
                  {o.order_items?.length > 1 ? ` 외 ${o.order_items.length - 1}종` : ''}
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{o.ordered_at ? new Date(o.ordered_at).toLocaleDateString('ko-KR') : ''}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: '#fff' }}>₩{(o.final_amount || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

