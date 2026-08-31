'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'

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
  track: Track
  companyId?: string | null
  title?: string
  onBack: () => void
}

const wrap: CSSProperties = {
  background: '#FBF8F4',
  borderRadius: 16,
  border: '1px solid #EDE6DA',
  padding: 16,
  marginTop: 8,
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return iso
  }
}

export default function OwnerPointsLedgerView({ track, companyId, title, onBack }: Props) {
  const [balance, setBalance] = useState(0)
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const accent = track === 'REWARD' ? '#a8863f' : '#7b5ea7'
  const label = title || (track === 'REWARD' ? '적립포인트 내역' : '아레테포인트 내역')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ track })
      if (companyId) qs.set('company_id', companyId)
      const res = await fetch(`/api/owner/points/ledger?${qs.toString()}`)
      const json = await res.json()
      if (!json?.ok) {
        setError(json?.error || '불러오기 실패')
        setRows([])
        return
      }
      setBalance(Math.trunc(Number(json.balance) || 0))
      setRows((json.rows || []) as LedgerRow[])
    } catch {
      setError('불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [track, companyId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div style={wrap}>
      <button
        type="button"
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 12 }}
      >
        ← 돌아가기
      </button>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: accent, marginBottom: 4 }}>현재 잔액</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1A2E', marginBottom: 16 }}>
        {balance.toLocaleString()}P
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 20 }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ fontSize: 12, color: '#c62828', textAlign: 'center', padding: 20 }}>{error}</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: 20 }}>내역이 없어요</div>
      ) : (
        rows.map((r) => {
          const positive = r.amount >= 0
          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid #EDE6DA',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#3A3540', marginBottom: 3 }}>{r.reason}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{fmtDate(r.created_at)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: positive ? accent : '#c62828' }}>
                  {positive ? '+' : ''}{r.amount.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>{r.balance_after.toLocaleString()}P</div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
