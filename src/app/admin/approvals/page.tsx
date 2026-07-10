'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = {
  type?: 'user' | 'brand'
  id: string
  auth_id?: string
  email?: string
  name?: string
  role?: 'partner' | 'owner' | 'brand' | string
  status?: string
  created_at: string
}

const roleLabel = (r: string) => {
  if (r === 'owner') return '원장님'
  if (r === 'partner') return '파트너스'
  if (r === 'brand') return '브랜드사'
  return r
}

export default function AdminApprovalsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [approvedRows, setApprovedRows] = useState<any[]>([])
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'partner' | 'brand'>('all')
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const pendingCount = useMemo(() => rows.length, [rows])

  const displayPendingRows = useMemo(() => {
    if (roleFilter === 'all') return rows
    return rows.filter(r => roleFilter === 'brand' ? r.type === 'brand' : r.role === roleFilter)
  }, [rows, roleFilter])

  const displayApprovedRows = useMemo(() => {
    if (roleFilter === 'all') return approvedRows
    return approvedRows.filter((r: any) => roleFilter === 'brand' ? r.type === 'brand' : r.role === roleFilter)
  }, [approvedRows, roleFilter])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals', { method: 'GET' })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) throw new Error(json?.error || json?.reason || 'failed')
      setRows((json.rows || []) as Row[])
      setApprovedRows(json.approvedRows || [])
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

  const approve = async (r: Row) => {
    const key = r.type === 'brand' ? r.id : (r.auth_id || r.id)
    setSavingId(key)
    setError('')
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          r.type === 'brand'
            ? { type: 'brand', id: r.id }
            : { type: 'user', auth_id: r.auth_id || r.id }
        ),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) throw new Error(json?.error || json?.reason || 'approve_failed')
      setRows(prev => prev.filter(row => row.id !== r.id))
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab('pending')}
            style={{ padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
            background: tab === 'pending' ? '#7B5EA7' : 'rgba(255,255,255,0.07)',
            color: tab === 'pending' ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            대기 {rows.length}
          </button>
          <button onClick={() => setTab('approved')}
            style={{ padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
            background: tab === 'approved' ? '#C9A96E' : 'rgba(255,255,255,0.07)',
            color: tab === 'approved' ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            승인완료 {approvedRows.length}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([
            { key: 'all', label: '전체' },
            { key: 'owner', label: '원장님' },
            { key: 'partner', label: '파트너스' },
            { key: 'brand', label: '브랜드사' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12,
                background: roleFilter === key
                  ? (tab === 'approved' ? '#C9A96E' : '#7B5EA7')
                  : 'rgba(255,255,255,0.07)',
                color: roleFilter === key ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
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
      ) : tab === 'pending' && displayPendingRows.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'rgba(255,255,255,0.55)' }}>
          {rows.length === 0 ? '승인 대기 요청이 없습니다.' : '해당 역할의 승인 대기 요청이 없습니다.'}
        </div>
      ) : tab === 'approved' && displayApprovedRows.length === 0 ? (
        <div className="card" style={{ padding: 16, color: 'rgba(255,255,255,0.55)' }}>
          {approvedRows.length === 0 ? '승인 완료 항목이 없습니다.' : '해당 역할의 승인 완료 항목이 없습니다.'}
        </div>
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
              {tab === 'approved' ? displayApprovedRows.map((r: any) => {
                const key = r.id
                const role = r.type === 'brand' ? '브랜드 입점' : roleLabel(r.role || '-')
                const name = r.name || '-'
                const status = r.apply_status || r.status || 'approved'
                return (
                <tr key={key}>
                  <td><span className="b b-gy">{role}</span></td>
                  <td style={{ fontWeight: 700 }}>{name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>-</td>
                  <td><span className="b b-gd">{status}</span></td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}></td>
                </tr>
                )
              }) : displayPendingRows.map(r => {
                const key = r.type === 'brand' ? r.id : (r.auth_id || r.id)
                const role = r.type === 'brand' ? '브랜드 입점' : roleLabel(r.role || '-')
                const name = r.type === 'brand' ? (r.name || '-') : (r.name || '-')
                const email = r.type === 'brand' ? '-' : (r.email || '-')
                const status = r.status || 'pending'
                const isOwnerUser = r.type !== 'brand' && r.role === 'owner'
                return (
                <tr key={key}>
                  <td><span className="b b-gy">{role}</span></td>
                  <td style={{ fontWeight: 700 }}>{name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{email}</td>
                  <td><span className="b b-gd">{status}</span></td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {isOwnerUser ? (
                      <button
                        type="button"
                        className="btn btn-gd"
                        onClick={() => router.push('/admin/owners')}
                        style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                      >
                        원장님 관리 탭에서 승인해주세요 →
                      </button>
                    ) : (
                      <button
                        className="btn btn-gd"
                        onClick={() => approve(r)}
                        disabled={savingId === key}
                      >
                        {savingId === key ? '처리 중...' : '승인'}
                      </button>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

