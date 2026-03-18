'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = {
  id: string
  auth_id: string
  email: string
  name: string
  role: 'partner' | 'owner' | 'brand' | string
  status: string
  created_at: string
}

const roleLabel = (r: string) => {
  if (r === 'owner') return '원장님'
  if (r === 'partner') return '파트너스'
  if (r === 'brand') return '브랜드사'
  return r
}

export default function AdminApprovalsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const pendingCount = useMemo(() => rows.length, [rows])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals', { method: 'GET' })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) throw new Error(json?.error || json?.reason || 'failed')
      setRows((json.rows || []) as Row[])
    } catch (e: any) {
      setError(e?.message || '불러오기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const approve = async (authId: string) => {
    setSavingId(authId)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_id: authId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) throw new Error(json?.error || json?.reason || 'approve_failed')
      await load()
    } catch (e: any) {
      setError(e?.message || '승인에 실패했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>✅ 승인 요청</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              파트너스/원장님/브랜드사 계정은 승인 후 대시보드가 활성화됩니다.
            </div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--gold)' }}>
            PENDING {pendingCount}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-err" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      {loading ? (
        <div className="card" style={{ padding: 16, color: 'rgba(255,255,255,0.55)' }}>로딩 중...</div>
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'rgba(255,255,255,0.55)' }}>승인 대기 요청이 없습니다.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 120 }}>역할</th>
                <th>이름</th>
                <th>이메일</th>
                <th style={{ width: 110 }}>상태</th>
                <th style={{ width: 140 }}>요청일</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.auth_id}>
                  <td><span className="b b-gy">{roleLabel(r.role)}</span></td>
                  <td style={{ fontWeight: 700 }}>{r.name || '-'}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{r.email}</td>
                  <td><span className="b b-gd">{r.status}</span></td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-gd"
                      onClick={() => approve(r.auth_id)}
                      disabled={savingId === r.auth_id}
                    >
                      {savingId === r.auth_id ? '처리 중...' : '승인'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

