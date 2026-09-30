'use client'

import type { ShipmentHistoryRow } from './types'
import { C, SERIF, histTh, histTd } from './types'

export function ShipHistoryModal({
  loading, rows, summary, onClose,
}: {
  loading: boolean
  rows: ShipmentHistoryRow[]
  summary: { total: number; monthCount: number }
  onClose: () => void
}) {
  const label = (r: ShipmentHistoryRow) =>
    r.delivery_type === 'direct' ? '직접전달' : r.delivery_type === 'quick' ? `퀵 · ${r.courier || ''}` : `택배 · ${r.courier || ''}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 720, maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 15, color: C.plum, fontFamily: SERIF }}>발송 내역</div>
          <button type="button" onClick={onClose} style={{ padding: '5px 12px', background: '#f0f0f0', border: 'none', color: C.muted, borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>✕ 닫기</button>
        </div>
        {!loading && rows.length > 0 && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
            총 발송 {summary.total}건 · 이번달 {summary.monthCount}건
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 32, fontSize: 13 }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: 32, fontSize: 13 }}>발송 완료 내역이 없어요</div>
        ) : (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={histTh}>고객명</th>
                  <th style={histTh}>회차</th>
                  <th style={histTh}>발송일</th>
                  <th style={histTh}>배송방식</th>
                  <th style={histTh}>운송장</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={histTd}>{(Array.isArray(r.users) ? r.users[0] : r.users)?.name || '-'}</td>
                    <td style={histTd}>{r.cycle_no ? `${r.cycle_no}회차` : '-'}</td>
                    <td style={histTd}>{r.shipped_at ? new Date(r.shipped_at).toLocaleDateString('ko-KR') : '-'}</td>
                    <td style={histTd}>{label(r)}</td>
                    <td style={histTd}>{r.delivery_type === 'courier' ? (r.tracking_no || '-') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
