'use client'
import { useState, useEffect, useCallback } from 'react'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  '결제완료': { label: '결제완료', bg: 'rgba(239,159,39,0.15)', color: '#EF9F27' },
  '배송중': { label: '배송중', bg: 'rgba(55,138,221,0.15)', color: '#7FB2E8' },
  '배송완료': { label: '배송완료', bg: 'rgba(123,94,167,0.15)', color: '#C9BEDD' },
  '구매확정': { label: '구매확정', bg: 'rgba(99,153,34,0.15)', color: '#97C459' },
}
const COURIERS = ['CJ대한통운', '한진택배', '롯데택배', '우체국택배', '로젠택배']
function getTrackingUrl(courier: string, trackingNo: string) {
  if (!trackingNo) return ''
  if (courier.includes('CJ') || courier.includes('대한통운')) return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`
  if (courier.includes('한진')) return `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trackingNo)}`
  if (courier.includes('롯데')) return `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trackingNo)}`
  if (courier.includes('우체국')) return `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trackingNo)}`
  if (courier.includes('로젠')) return `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trackingNo)}`
  return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trackingNo)}`
}
interface OrderRow {
  id: string
  order_no: string
  status: string
  recipient_name: string
  recipient_phone: string
  address: string
  final_amount: number
  owner_amount: number
  courier: string | null
  tracking_no: string | null
  ordered_at: string
  items: { product_name: string; quantity: number }[]
}
export default function BrandRetailOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [courierInputs, setCourierInputs] = useState<Record<string, string>>({})
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/brand-product-orders/my-salon-orders').then(r => r.json())
    if (res.ok) setOrders(res.orders)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  const handleShip = async (orderId: string) => {
    const courier = courierInputs[orderId]
    const trackingNo = trackingInputs[orderId]
    if (!courier || !trackingNo) { alert('택배사와 송장번호를 입력해주세요'); return }
    setSubmitting(orderId)
    const res = await fetch(`/api/brand-product-orders/${orderId}/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: '배송중', courier, tracking_no: trackingNo }),
    }).then(r => r.json())
    setSubmitting(null)
    if (!res.ok) { alert('처리에 실패했어요'); return }
    load()
  }
  const handleDeliver = async (orderId: string) => {
    setSubmitting(orderId)
    const res = await fetch(`/api/brand-product-orders/${orderId}/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_status: '배송완료' }),
    }).then(r => r.json())
    setSubmitting(null)
    if (!res.ok) { alert('처리에 실패했어요'); return }
    load()
  }
  const pendingCount = orders.filter(o => o.status === '결제완료').length
  const shippingCount = orders.filter(o => o.status === '배송중').length
  const monthlyAmount = orders
    .filter(o => ['배송완료', '구매확정'].includes(o.status))
    .reduce((s, o) => s + (o.owner_amount || 0), 0)
  return (
    <div style={{ background: '#0a0c0f', minHeight: '100vh', padding: 20, color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16 }}>제품 주문 관리</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>발송 대기</div>
          <div style={{ fontSize: 20 }}>{pendingCount}건</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>배송중</div>
          <div style={{ fontSize: 20 }}>{shippingCount}건</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>정산액(배송완료+)</div>
          <div style={{ fontSize: 20, color: GOLD }}>{monthlyAmount.toLocaleString()}원</div>
        </div>
      </div>
      {loading && <div style={{ color: TEXT_SUB, fontSize: 13 }}>불러오는 중...</div>}
      {!loading && orders.length === 0 && <div style={{ color: TEXT_SUB, fontSize: 13 }}>아직 주문이 없어요</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.map(order => {
          const statusInfo = STATUS_LABEL[order.status] || { label: order.status, bg: 'rgba(255,255,255,0.08)', color: '#fff' }
          return (
            <div key={order.id} style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, background: statusInfo.bg, color: statusInfo.color, padding: '3px 10px', borderRadius: 6 }}>{statusInfo.label}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{order.order_no} · {new Date(order.ordered_at).toLocaleDateString('ko-KR')}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 2 }}>
                {order.items.map(i => i.product_name).join(', ')}
              </div>
              <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 12 }}>
                {order.recipient_name} · {order.recipient_phone} · {order.address}
              </div>
              {order.status === '결제완료' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={courierInputs[order.id] || ''}
                    onChange={e => setCourierInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                    style={{ flex: 1, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.05)' }}
                  >
                    <option value="">택배사 선택</option>
                    {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    placeholder="송장번호 입력"
                    value={trackingInputs[order.id] || ''}
                    onChange={e => setTrackingInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                    style={{ flex: 1, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                  />
                  <button
                    onClick={() => handleShip(order.id)}
                    disabled={submitting === order.id}
                    style={{ border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, whiteSpace: 'nowrap' }}
                  >
                    발송처리
                  </button>
                </div>
              )}
              {order.status === '배송중' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={getTrackingUrl(order.courier || '', order.tracking_no || '')}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, textAlign: 'center', border: `0.5px solid ${BORDER}`, color: GOLD, borderRadius: 8, padding: 9, fontSize: 12, textDecoration: 'none' }}
                  >
                    배송조회
                  </a>
                  <button
                    onClick={() => handleDeliver(order.id)}
                    disabled={submitting === order.id}
                    style={{ flex: 1, border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: 9, fontSize: 12 }}
                  >
                    배송완료 처리
                  </button>
                </div>
              )}
              {(order.status === '배송완료' || order.status === '구매확정') && (
                <div style={{ fontSize: 12, color: TEXT_SUB }}>
                  정산액 {order.owner_amount?.toLocaleString()}원
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
