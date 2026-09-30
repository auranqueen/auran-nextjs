'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { Membership } from './types'
import { C, SERIF } from './types'
import { calcCycleDate } from './utils'

export function ShipConfirmModal({
  membership, busy,
  nextDate, setNextDate,
  cycleDates, setCycleDates,
  onClose, onConfirm,
}: {
  membership: Membership
  busy: boolean
  nextDate: string
  setNextDate: (v: string) => void
  cycleDates: Record<number, string>
  setCycleDates: Dispatch<SetStateAction<Record<number, string>>>
  onClose: () => void
  onConfirm: () => void
}) {
  const currentCycle = membership.shipments_total - membership.shipments_remaining + 1
  const futureCycles = Array.from({ length: membership.shipments_total - currentCycle }, (_, i) => currentCycle + 1 + i)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 57, padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 440, maxHeight: '88vh', overflow: 'auto', background: '#fff', borderRadius: 16, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, color: C.plum, fontFamily: SERIF, marginBottom: 4 }}>{currentCycle}회차 발송 처리</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{membership.users?.name || '회원'} · 남은 {membership.shipments_remaining}회</div>
        {membership.shipments_remaining > 1 && (
          <>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              다음 회차 발송일 (next_shipment_date)
              <button
                type="button"
                title="날짜 수정"
                onClick={() => {
                  const el = document.getElementById('ship-modal-next-date') as HTMLInputElement | null
                  el?.showPicker?.()
                  el?.focus()
                }}
                style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
              >✏️</button>
            </div>
            <input
              id="ship-modal-next-date"
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff', marginBottom: 12 }}
            />
            {futureCycles.length > 0 && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>회차별 예정일 (started_at + 30일 간격, 수정 가능)</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {futureCycles.map((cycle) => (
                <div key={`ship-modal-cycle-${cycle}`}>
                  <div style={{ fontSize: 11, color: C.ink, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {cycle}회차 예정일
                    <button
                      type="button"
                      title="날짜 수정"
                      onClick={() => {
                        const el = document.getElementById(`ship-modal-cycle-${cycle}`) as HTMLInputElement | null
                        el?.showPicker?.()
                        el?.focus()
                      }}
                      style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                    >✏️</button>
                  </div>
                  <input
                    id={`ship-modal-cycle-${cycle}`}
                    type="date"
                    value={cycleDates[cycle] || ''}
                    onChange={(e) => setCycleDates((prev) => ({ ...prev, [cycle]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ flex: 1, padding: 11, background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            취소
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            style={{ flex: 1, padding: 11, background: busy ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {busy ? '처리 중...' : '발송 확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
