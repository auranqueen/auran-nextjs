'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
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
  checkout_batch_id: string | null
  items: { product_name: string; quantity: number }[]
}
export default function BrandRetailOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [courierInputs, setCourierInputs] = useState<Record<string, string>>({})
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<string, Set<string>>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/brand-product-orders/my-salon-orders').then(r => r.json())
    if (res.ok) setOrders(res.orders)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const batches = useMemo(() => {
    const map = new Map<string, OrderRow[]>()
    for (const o of orders) {
      const key = o.checkout_batch_id || o.id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    }
    return Array.from(map.entries()).map(([key, list]) => ({ key, orders: list }))
  }, [orders])

  const toggleOrderSelect = (batchKey: string, orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = { ...prev }
      const set = new Set(next[batchKey] || [])
      if (set.has(orderId)) set.delete(orderId)
      else set.add(orderId)
      next[batchKey] = set
      return next
    })
  }

  const handleShipBatch = async (batchKey: string, batchOrders: OrderRow[]) => {
    const courier = courierInputs[batchKey]
    const trackingNo = trackingInputs[batchKey]
    if (!courier || !trackingNo) { alert('택배사와 송장번호를 입력해주세요'); return }
    const unshipped = batchOrders.filter(o => !o.tracking_no && o.status === '결제완료')
    if (unshipped.length === 0) { alert('이미 전부 발송 처리되었어요'); return }
    const selected = selectedOrderIds[batchKey]
    const targetIds = selected && selected.size > 0
      ? unshipped.filter(o => selected.has(o.id)).map(o => o.id)
      : unshipped.map(o => o.id)
    if (targetIds.length === 0) { alert('발송할 주문을 선택해주세요'); return }
    setSubmitting(batchKey)
    let failed = false
    for (const orderId of targetIds) {
      const res = await fetch(`/api/brand-product-orders/${orderId}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_status: '배송중', courier, tracking_no: trackingNo }),
      }).then(r => r.json())
      if (!res.ok) { failed = true; alert('처리에 실패했어요'); break }
    }
    setSubmitting(null)
    setSelectedOrderIds(prev => {
      const next = { ...prev }
      delete next[batchKey]
      return next
    })
    setCourierInputs(prev => {
      const next = { ...prev }
      delete next[batchKey]
      return next
    })
    setTrackingInputs(prev => {
      const next = { ...prev }
      delete next[batchKey]
      return next
    })
    void failed
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
        <div style={{ fontSize: 16 }}>소매 주문 관리</div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {batches.map(batch => {
          const first = batch.orders[0]
          const unshipped = batch.orders.filter(o => !o.tracking_no && o.status === '결제완료')
          const unshippedCount = unshipped.length
          const selSize = selectedOrderIds[batch.key]?.size || 0
          const shipHint = selSize > 0
            ? `선택 ${selSize}건 발송`
            : unshippedCount > 0
              ? `미발송 ${unshippedCount}건 전체 발송`
              : ''
          return (
            <div key={batch.key} style={{ background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
              <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `0.5px solid ${BORDER}` }}>
                <div style={{ fontSize: 13, marginBottom: 2 }}>
                  {first.recipient_name} · {first.recipient_phone}
                </div>
                <div style={{ fontSize: 12, color: TEXT_SUB }}>{first.address}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                  {new Date(first.ordered_at).toLocaleDateString('ko-KR')}
                  {batch.orders.length > 1 ? ` · ${batch.orders.length}건` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: unshippedCount > 0 ? 12 : 0 }}>
                {batch.orders.map(order => {
                  const statusInfo = STATUS_LABEL[order.status] || { label: order.status, bg: 'rgba(255,255,255,0.08)', color: '#fff' }
                  const canSelect = !order.tracking_no && order.status === '결제완료'
                  const isSelected = selectedOrderIds[batch.key]?.has(order.id) || false
                  return (
                    <div key={order.id} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {canSelect && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelect(batch.key, order.id)}
                            style={{ marginTop: 4 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, background: statusInfo.bg, color: statusInfo.color, padding: '3px 10px', borderRadius: 6 }}>{statusInfo.label}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{order.order_no}</span>
                          </div>
                          <div style={{ fontSize: 13, marginBottom: 4 }}>
                            {order.items.map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                          </div>
                          {order.tracking_no ? (
                            <div style={{ fontSize: 12, color: '#97C459', marginBottom: 8 }}>
                              발송완료 · {order.courier} · {order.tracking_no}
                            </div>
                          ) : null}
                          {order.status === '배송중' && order.tracking_no && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
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
                                disabled={submitting === order.id || submitting === batch.key}
                                style={{ flex: 1, border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: 9, fontSize: 12 }}
                              >
                                배송완료 처리
                              </button>
                            </div>
                          )}
                          {(order.status === '배송완료' || order.status === '구매확정') && (
                            <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 4 }}>
                              정산액 {order.owner_amount?.toLocaleString()}원
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {unshippedCount > 0 && (
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>{shipHint}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select
                      value={courierInputs[batch.key] || ''}
                      onChange={e => setCourierInputs(prev => ({ ...prev, [batch.key]: e.target.value }))}
                      style={{ flex: 1, minWidth: 120, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.05)' }}
                    >
                      <option value="">택배사 선택</option>
                      {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      placeholder="송장번호 입력"
                      value={trackingInputs[batch.key] || ''}
                      onChange={e => setTrackingInputs(prev => ({ ...prev, [batch.key]: e.target.value }))}
                      style={{ flex: 1, minWidth: 120, border: `0.5px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                    />
                    <button
                      onClick={() => handleShipBatch(batch.key, batch.orders)}
                      disabled={submitting === batch.key}
                      style={{ border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      {submitting === batch.key ? '처리 중...' : '발송처리'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}