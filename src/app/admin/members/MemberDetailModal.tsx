'use client'

import { useState } from 'react'
import type { DetailTab, Member, Plan } from './types'
import { useMemberDetail } from './useMemberDetail'
import { ToastAdjustPanel } from './ToastAdjustPanel'
import { PointGrantModal } from './PointGrantModal'
import { SummaryTab } from './tabs/SummaryTab'
import { OrdersTab } from './tabs/OrdersTab'
import { PointsTab } from './tabs/PointsTab'
import { LogsTab } from './tabs/LogsTab'

type Props = {
  member: Member
  planList: Plan[]
  approving: boolean
  onClose: () => void
  onPatchMember: (id: string, patch: Partial<Member>) => void
  onSuspend: (m: Member) => void
  onActivate: (m: Member) => void
  onApprove: (m: Member) => void
}

const footerBtn = { flex: 1, padding: '12px 14px', borderRadius: 16, fontWeight: 900, cursor: 'pointer' } as const

export function MemberDetailModal({ member, planList, approving, onClose, onPatchMember, onSuspend, onActivate, onApprove }: Props) {
  const [tab, setTab] = useState<DetailTab>('summary')
  const [pointOpen, setPointOpen] = useState(false)
  const [toastAdjustOpen, setToastAdjustOpen] = useState(false)
  const { detailOrders, detailPoints, detailLogs, detailLoading, prependPoint } = useMemberDetail(member.id)

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 560, marginLeft: 0, background: '#141414', borderRadius: 24, padding: '18px 18px 26px', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', margin: '0 auto 14px' }} />
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{member.name}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: "'JetBrains Mono', monospace" }}>{member.email}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {([
              { id: 'summary', label: '요약' },
              { id: 'orders', label: '주문' },
              { id: 'points', label: '포인트' },
              { id: 'logs', label: '로그' },
            ] as const).map(x => (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: tab === x.id ? 'rgba(201,168,76,0.16)' : 'rgba(255,255,255,0.06)',
                  color: tab === x.id ? '#c9a84c' : 'rgba(255,255,255,0.72)',
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                }}
              >
                {x.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            {detailLoading && (
              <div style={{ padding: 12, borderRadius: 16, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                상세 데이터 불러오는 중...
              </div>
            )}

            {tab === 'summary' && (
              <SummaryTab member={member} planList={planList} onGradeSaved={grade => onPatchMember(member.id, { customer_grade: grade })} />
            )}

            {tab === 'orders' && <OrdersTab orders={detailOrders} />}
            {tab === 'points' && <PointsTab points={detailPoints} />}
            {tab === 'logs' && <LogsTab logs={detailLogs} />}
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={() => setPointOpen(true)} style={{ ...footerBtn, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.30)', color: '#c9a84c' }}>
              ✨ 포인트 지급
            </button>
            <button type="button" onClick={() => setToastAdjustOpen(v => !v)} style={{ ...footerBtn, background: 'rgba(123,94,167,0.14)', border: '1px solid rgba(123,94,167,0.30)', color: '#9B7EC8' }}>
              💰 토스트 지급/차감
            </button>
            {(member.status === 'pending' && (member.role === 'partner' || member.role === 'owner' || member.role === 'brand')) ? (
              <button onClick={() => onApprove(member)} disabled={approving} style={{ ...footerBtn, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.30)', color: '#4cad7e', opacity: approving ? 0.7 : 1 }}>
                {approving ? '승인 중...' : '승인'}
              </button>
            ) : null}
            {member.status === 'suspended' ? (
              <button onClick={() => onActivate(member)} style={{ ...footerBtn, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.30)', color: '#4cad7e' }}>
                활성화
              </button>
            ) : (
              <button onClick={() => onSuspend(member)} style={{ ...footerBtn, background: 'rgba(217,79,79,0.12)', border: '1px solid rgba(217,79,79,0.30)', color: '#d94f4f' }}>
                정지
              </button>
            )}
            <button onClick={onClose} style={{ ...footerBtn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }}>
              닫기
            </button>
          </div>
          {toastAdjustOpen ? (
            <ToastAdjustPanel
              member={member}
              onCancel={() => setToastAdjustOpen(false)}
              onDone={amt => {
                setToastAdjustOpen(false)
                onPatchMember(member.id, { points: (Number(member.points) || 0) + amt })
              }}
            />
          ) : null}
        </div>
      </div>

      {pointOpen && (
        <PointGrantModal
          member={member}
          onClose={() => setPointOpen(false)}
          onGranted={(balance, row) => {
            onPatchMember(member.id, { points: balance })
            prependPoint(row)
            setPointOpen(false)
          }}
        />
      )}
    </>
  )
}
