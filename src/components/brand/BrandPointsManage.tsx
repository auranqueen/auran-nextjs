'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type Track = 'REWARD' | 'ARETE'

type LedgerRow = {
  id: string
  amount: number
  balance_after: number
  reason: string
  source_type: string
  created_at: string
}

interface Props {
  companyId: string
  staffId: string | null
  ownerId: string
  ownerName: string
  ownerShop: string
  onBack: () => void
}

const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
}
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const INPUT: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

function FullViewportModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 18,
          background: '#1a1520',
          padding: 16,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'sticky',
            top: 0,
            float: 'right',
            zIndex: 2,
            width: 32,
            height: 32,
            border: 'none',
            background: 'transparent',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

export default function BrandPointsManage({
  companyId,
  staffId,
  ownerId,
  ownerName,
  ownerShop,
  onBack,
}: Props) {
  const [track, setTrack] = useState<Track>('REWARD')
  const [balance, setBalance] = useState(0)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'idle' | 'credit' | 'debit'>('idle')
  const [amountStr, setAmountStr] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ company_id: companyId, owner_id: ownerId, track })
      const res = await fetch(`/api/brand/points/ledger?${qs.toString()}`)
      const json = await res.json()
      if (json?.ok) {
        setBalance(Math.trunc(Number(json.balance) || 0))
        setRows((json.rows || []) as LedgerRow[])
      } else {
        showToast(json?.error || '내역 불러오기 실패')
      }
    } catch {
      showToast('내역 불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [companyId, ownerId, track])

  useEffect(() => {
    setMode('idle')
    setAmountStr('')
    setReason('')
    void load()
  }, [load])

  const submit = async () => {
    const amount = Math.trunc(Number(String(amountStr).replace(/,/g, '')) || 0)
    const signed = mode === 'debit' ? -Math.abs(amount) : Math.abs(amount)
    if (!signed) {
      showToast('금액을 입력하세요')
      return
    }
    if (!reason.trim()) {
      showToast('사유는 필수입니다')
      return
    }
    if (!staffId) {
      showToast('스태프 인증이 필요합니다')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/brand/points/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          staff_id: staffId,
          owner_id: ownerId,
          track,
          amount: signed,
          reason: reason.trim(),
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        showToast(json?.error || '처리 실패')
        return
      }
      showToast(mode === 'debit' ? '차감 완료' : '적립 완료')
      setMode('idle')
      setAmountStr('')
      setReason('')
      await load()
    } catch {
      showToast('처리 실패')
    } finally {
      setBusy(false)
    }
  }

  const accent = track === 'REWARD' ? GOLD : PURPLE

  return (
    <FullViewportModal onClose={onBack}>
      {toast ? (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10050, background: '#2a2435', color: '#fff', padding: '8px 14px', borderRadius: 8, fontSize: 12 }}>
          {toast}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', color: SUB, fontSize: 12, cursor: 'pointer', marginBottom: 10, padding: 0 }}
      >
        ← 원장 목록
      </button>
      <div style={CARD}>
        <div style={{ fontSize: 14, color: TEXT, marginBottom: 4 }}>{ownerName}</div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 12 }}>{ownerShop || '-'}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {([
            { key: 'REWARD' as Track, label: '적립포인트' },
            { key: 'ARETE' as Track, label: '아레테포인트' },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTrack(t.key)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: `0.5px solid ${track === t.key ? accent : 'rgba(255,255,255,0.1)'}`,
                background: track === t.key ? `${accent}22` : 'transparent',
                color: track === t.key ? accent : SUB,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>현재 잔액</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: accent, marginBottom: 14 }}>
          {balance.toLocaleString()}P
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setMode('credit')}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: `0.5px solid ${GOLD}`, background: 'rgba(201,169,110,0.12)', color: GOLD, fontSize: 12, cursor: 'pointer' }}
          >
            강제 적립
          </button>
          <button
            type="button"
            onClick={() => setMode('debit')}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 12, cursor: 'pointer' }}
          >
            강제 차감
          </button>
        </div>
      </div>

      {mode !== 'idle' ? (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: TEXT, marginBottom: 10 }}>
            {mode === 'credit' ? '강제 적립' : '강제 차감'} · {track === 'REWARD' ? '적립포인트' : '아레테포인트'}
          </div>
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="금액 (원)"
            style={{ ...INPUT, marginBottom: 8 }}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="사유 (필수)"
            style={{ ...INPUT, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { setMode('idle'); setAmountStr(''); setReason('') }}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: mode === 'credit' ? GOLD : PURPLE, color: '#1a1520', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              {busy ? '처리 중…' : '확인'}
            </button>
          </div>
        </div>
      ) : null}

      <div style={CARD}>
        <div style={{ fontSize: 12, color: TEXT, marginBottom: 10 }}>내역</div>
        {loading ? (
          <div style={{ fontSize: 12, color: SUB, textAlign: 'center', padding: 16 }}>불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 12, color: SUB, textAlign: 'center', padding: 16 }}>내역이 없어요</div>
        ) : (
          rows.map((r) => {
            const positive = r.amount >= 0
            return (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{r.reason}</div>
                  <div style={{ fontSize: 10, color: SUB }}>{fmtDate(r.created_at)} · {r.source_type}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: positive ? GOLD : '#e57373' }}>
                    {positive ? '+' : ''}{r.amount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: SUB }}>{r.balance_after.toLocaleString()}P</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </FullViewportModal>
  )
}
