'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function OrderCompleteContent() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    const orderId = params.get('order_id')
    if (!orderId) return
    supabase.from('orders').select('order_no, total_amount, final_amount, items, recipient_name, address').eq('id', orderId).maybeSingle().then(({ data }) => {
      if (data) setOrder(data)
    })
  }, [])

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a14', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, fontFamily:'sans-serif' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
      <div style={{ fontSize:20, color:'#fff', marginBottom:8 }}>주문이 완료됐어요!</div>
      {order && (
        <div style={{ background:'rgba(255,255,255,0.05)', borderRadius:16, padding:20, marginBottom:24, width:'100%', maxWidth:360 }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>주문번호</div>
          <div style={{ fontSize:14, color:'#fff', marginBottom:12 }}>{order.order_no}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>결제금액</div>
          <div style={{ fontSize:18, color:'#C9A96E', marginBottom:12 }}>₩{(order.final_amount || order.total_amount)?.toLocaleString()}</div>
          {order.recipient_name && (
            <>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>배송지</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)' }}>{order.recipient_name} · {order.address}</div>
            </>
          )}
        </div>
      )}
      <div style={{ display:'flex', gap:8, width:'100%', maxWidth:360 }}>
        <button onClick={() => router.push('/')} style={{ flex:1, padding:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, color:'rgba(255,255,255,0.6)', fontSize:13, cursor:'pointer' }}>
          홈으로
        </button>
        <button onClick={() => router.push('/my')} style={{ flex:1, padding:14, background:'#7B5EA7', border:'none', borderRadius:10, color:'#fff', fontSize:13, cursor:'pointer' }}>
          주문내역
        </button>
      </div>
    </div>
  )
}

export default function OrderCompletePage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',background:'#0a0a14'}}/>}>
      <OrderCompleteContent />
    </Suspense>
  )
}
