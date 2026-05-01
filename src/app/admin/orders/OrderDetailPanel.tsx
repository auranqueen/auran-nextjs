'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type OrderRow = {
  id: string
  order_no: string
  status: string
  total_amount?: number | null
  final_amount?: number | null
  coupon_discount?: number | null
  point_used?: number | null
  payment_method?: string | null
  tracking_no?: string | null
  courier?: string | null
  ordered_at?: string | null
  customer_id?: string | null
  admin_order_notes?: string | null
  recipient_name?: string | null
  recipient_phone?: string | null
  address?: string | null
  charge_used?: number | null
  toast_used?: number | null
  items?: any[] | null
  shipping_fee?: number | null
  grade_discount?: number | null
  subtotal?: number | null
}

type Props = {
  order: OrderRow | null
  open: boolean
  onClose: () => void
}

export default function OrderDetailPanel({ order, open, onClose }: Props) {
  const supabase = createClient()
  const [courier, setCourier] = useState('CJ대한통운')
  const [trackingNo, setTrackingNo] = useState('')
  const [memo, setMemo] = useState('')
  const [savingShip, setSavingShip] = useState(false)
  const [savingMemo, setSavingMemo] = useState(false)

  useEffect(() => {
    setCourier(order?.courier || 'CJ대한통운')
    setTrackingNo(String(order?.tracking_no || ''))
    setMemo(String(order?.admin_order_notes || ''))
  }, [order?.id])

  const paymentBadgeColor = useMemo(() => {
    const pay = String(order?.payment_method || '')
    if (/카드|card/i.test(pay)) return '#8ab0ff'
    if (/무통장|무통|입금|bank|transfer/i.test(pay)) return '#c9a96e'
    if (/토스트|toast/i.test(pay)) return '#c4a7e7'
    return 'rgba(255,255,255,0.7)'
  }, [order?.payment_method])

  if (!open || !order) return null

  const saveShipping = async () => {
    if (!trackingNo.trim()) return
    setSavingShip(true)
    try {
      const shippedAt = new Date().toISOString()
      const { error } = await supabase
        .from('orders')
        .update({
          status: '배송중',
          tracking_no: trackingNo.trim(),
          courier,
          shipped_at: shippedAt,
        } as any)
        .eq('id', order.id)
      if (error) {
        alert(error.message)
        return
      }
      await supabase.from('notifications').insert({
        user_id: order.customer_id,
        type: 'shipping',
        title: '🚚 발송 안내',
        body:
          `[AURAN] 주문이 발송됐습니다.\n` +
          `운송장번호: ${trackingNo.trim()}\n` +
          `주문번호: ${order.order_no}\n\n` +
          `배송조회: https://auran.kr/track/\n` +
          `문의: support@auran.kr`,
        icon: '🚚',
        is_read: false,
        created_at: new Date().toISOString(),
      } as any)
      alert('배송정보가 등록됐어')
    } finally {
      setSavingShip(false)
    }
  }

  const saveMemo = async () => {
    setSavingMemo(true)
    try {
      const { error } = await supabase.from('orders').update({ admin_order_notes: memo } as any).eq('id', order.id)
      if (error) {
        alert(error.message)
        return
      }
      alert('메모 저장 완료')
    } finally {
      setSavingMemo(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 210,
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 'min(460px, 92vw)',
          background: 'var(--bg2)',
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>주문 상세</div>
          <button type="button" className="btn btn-gy" onClick={onClose}>닫기</button>
        </div>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>주문 정보</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>{order.order_no}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
            {order.ordered_at ? new Date(order.ordered_at).toLocaleString('ko-KR') : '-'}
          </div>
          <span className="b b-gy" style={{ marginTop: 6, display: 'inline-block' }}>{order.status}</span>
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>고객 정보</div>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>받는분: {order.recipient_name || '-'}</div>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>연락처: {order.recipient_phone || '-'}</div>
          <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4, wordBreak: 'break-all' }}>
            주소: {order.address || '-'}
          </div>
          <button
            type="button"
            className="btn btn-bl"
            style={{ marginTop: 8 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(String(order.address || ''))
              } catch {}
            }}
          >
            주소 복사
          </button>
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>주문 상품</div>
          {(Array.isArray(order.items) ? order.items : (() => { try { return JSON.parse(String(order.items || '[]')) } catch { return [] } })()).map((item: any, i: number) => (
            <div key={i} className="mono" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 2 }}>
              {item.product_name || item.name || '상품'} × {item.quantity || 1} — ₩{Number(item.price ?? 0).toLocaleString()}
            </div>
          ))}
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>결제 상세</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>상품 소계: ₩{Number(order.subtotal ?? order.total_amount ?? 0).toLocaleString()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>배송비: {Number(order.shipping_fee ?? 0) === 0 ? '무료' : `₩${Number(order.shipping_fee ?? 0).toLocaleString()}`}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>등급할인: -₩{Number(order.grade_discount ?? 0).toLocaleString()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>쿠폰할인: -₩{Number(order.coupon_discount ?? 0).toLocaleString()}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>충전금 사용: -₩{Number(order.charge_used ?? 0).toLocaleString()}</div>
          {Number(order.toast_used ?? 0) > 0 && <div className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>토스트 사용: -{Number(order.toast_used ?? 0).toLocaleString()}T</div>}
          <div className="mono" style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, marginTop: 4 }}>최종결제: ₩{Number(order.final_amount ?? 0).toLocaleString()}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, color: paymentBadgeColor, border: `1px solid ${paymentBadgeColor}`, borderRadius: 999, padding: '3px 8px' }}>
              {order.payment_method || '-'}
            </span>
          </div>
        </section>

        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>배송 정보</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>현재 택배사: {order.courier || '-'}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>현재 송장번호: {order.tracking_no || '-'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select value={courier} onChange={(e) => setCourier(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '8px 10px' }}>
              {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '로젠택배'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="송장번호"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', padding: '8px 10px' }}
            />
          </div>
          <button type="button" className="btn btn-gr" style={{ marginTop: 8 }} onClick={() => void saveShipping()} disabled={savingShip}>
            {savingShip ? '등록 중...' : '등록'}
          </button>
        </section>

        <section>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>관리자 메모</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              color: 'var(--text)',
              fontSize: 12,
              padding: '10px 11px',
              lineHeight: 1.6,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <button type="button" className="btn btn-gr" style={{ marginTop: 8 }} onClick={() => void saveMemo()} disabled={savingMemo}>
            {savingMemo ? '저장 중...' : '저장'}
          </button>
        </section>
      </aside>
    </div>
  )
}

