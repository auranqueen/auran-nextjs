'use client'

import { useState } from 'react'

export function OrdersTab({ orders }: { orders: any[] }) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {orders.length === 0 ? (
        <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>주문 내역이 없습니다.</div>
      ) : (
        orders.map(o => {
          const items = (o.order_items || []) as { product_name: string; quantity: number }[]
          const firstName = items[0]?.product_name ?? ''
          const extra = items.length > 1 ? ` 외 ${items.length - 1}종` : ''
          const statusLabel = o.status
          const statusColor =
            o.status === '취소'
              ? 'rgba(239,68,68,0.85)'
              : o.status === '배송중'
                ? 'rgba(34,197,94,0.85)'
                : o.status === '완료' || o.status === '배송완료'
                  ? 'rgba(255,255,255,0.45)'
                  : 'rgba(123,94,167,0.95)'
          const expanded = selectedOrder?.id === o.id
          return (
            <div
              key={o.id}
              style={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedOrder(expanded ? null : o)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  color: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, flex: 1, minWidth: 0 }}>{firstName}{extra}</div>
                  <div style={{ fontSize: 11, color: statusColor, fontWeight: 500, whiteSpace: 'nowrap' }}>{statusLabel}</div>
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                  <span>{o.order_no}</span>
                  <span>{o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : ''}</span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: '#c9a84c' }}>
                  ₩{(o.final_amount || 0).toLocaleString()}
                </div>
              </button>
              {expanded && (
                <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 8, marginBottom: 4 }}>상품</div>
                  {items.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>항목 없음</div>
                  ) : (
                    items.map((it, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product_name}</span>
                        <span style={{ marginLeft: 8, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.5)' }}>×{it.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
