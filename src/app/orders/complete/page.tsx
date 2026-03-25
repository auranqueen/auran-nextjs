'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OrderCompletePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('order_id')
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    if (!orderId) return
    const supabase = createClient()
    supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
      .then(({ data }) => setOrder(data))
  }, [orderId])

  const points = order ? Math.floor(order.total_amount * 0.05) : 0

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0B09',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: 'sans-serif',
      color: '#fff'
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <div style={{ fontSize: 11, letterSpacing: '0.2em', color: '#C9A96E', marginBottom: 8 }}>ORDER COMPLETE</div>
      <div style={{ fontSize: 24, marginBottom: 8 }}>결제가 완료됐어요</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>
        1~3 영업일 내 배송 출발 예정이에요
      </div>

      {order && (
        <div style={{
          width: '100%', maxWidth: 360,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12, padding: 20, marginBottom: 16
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>ORDER INFO</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>주문번호</span>
            <span style={{ fontSize: 12 }}>{order.order_no}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>결제금액</span>
            <span style={{ color: '#C9A96E', fontWeight: 700 }}>
              {order.total_amount?.toLocaleString()}원
            </span>
          </div>
        </div>
      )}

      <div style={{
        width: '100%', maxWidth: 360,
        background: 'linear-gradient(135deg, rgba(201,169,110,0.15), rgba(201,169,110,0.05))',
        border: '1px solid rgba(201,169,110,0.3)',
        borderRadius: 12, padding: 16, marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 12
      }}>
        <span style={{ fontSize: 24 }}>🎁</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#C9A96E' }}>토스트 포인트 적립!</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {points.toLocaleString()}T 지갑에 적립됐어요
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
        <button
          onClick={() => router.push('/home')}
          style={{
            flex: 1, padding: '14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, color: 'rgba(255,255,255,0.6)',
            fontSize: 13, cursor: 'pointer'
          }}>
          홈으로
        </button>
        <button
          onClick={() => router.push('/dashboard/customer/products')}
          style={{
            flex: 1, padding: '14px',
            background: '#C9A96E',
            border: 'none',
            borderRadius: 10, color: '#1a1000',
            fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>
          계속 쇼핑
        </button>
      </div>
    </div>
  )
}

