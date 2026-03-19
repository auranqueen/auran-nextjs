'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'

export default function AdminMarketingProductsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected'>('pending')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<any[]>([])
  const [counts, setCounts] = useState<{ pending: number; active: number; rejected: number }>({ pending: 0, active: 0, rejected: 0 })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [q, setQ] = useState('')
  const [brandQ, setBrandQ] = useState<string>('all')

  const statusParam = tab

  const fetchRows = async () => {
    setLoading(true)
    try {
      // ensure session cookie exists (admin layout already checks)
      await supabase.auth.getSession()
      const res = await fetch(`/api/admin/products?status=${encodeURIComponent(statusParam)}`, { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || json?.reason || 'load_failed')
      setRows(json.rows || [])
      setCounts(json.counts || { pending: 0, active: 0, rejected: 0 })
    } catch (e) {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const mappedRows = useMemo(() => {
    return (rows || []).map(r => ({
      ...r,
      brandName: r.brands?.name || '-',
      price: Number(r.retail_price || 0),
    }))
  }, [rows])

  const brandOptions = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of mappedRows) {
      const b = (r.brandName || '-').trim()
      if (!b || b === '-') continue
      map.set(b, (map.get(b) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [mappedRows])

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return mappedRows.filter(r => {
      if (brandQ !== 'all' && r.brandName !== brandQ) return false
      if (!qq) return true
      const hay = `${r.name || ''} ${r.brandName || ''}`.toLowerCase()
      return hay.includes(qq)
    })
  }, [brandQ, mappedRows, q])

  const approveOne = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'approve', id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'approve_failed')
      await fetchRows()
    } finally {
      setBusyId(null)
    }
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'reject', id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'reject_failed')
      await fetchRows()
    } finally {
      setBusyId(null)
    }
  }

  const bulkApprove = async () => {
    if (!confirm(`pending 제품 ${counts.pending}개를 모두 승인할까요?`)) return
    setBulkBusy(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'bulk_approve' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'bulk_failed')
      await fetchRows()
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>제품 관리</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            대기/승인/거절 탭 · 검색·브랜드 필터 · 일괄 승인
          </div>
        </div>
        {tab === 'pending' && (
          <button
            onClick={bulkApprove}
            disabled={bulkBusy || counts.pending === 0}
            style={{
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(76,173,126,0.14)',
              border: '1px solid rgba(76,173,126,0.38)',
              color: '#4cad7e',
              fontWeight: 800,
              opacity: bulkBusy ? 0.7 : 1,
              cursor: 'pointer',
            }}
          >
            {bulkBusy ? '승인 중...' : `✅ 전체 일괄 승인 (${counts.pending})`}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        {([
          { id: 'pending', label: `PENDING (${counts.pending})`, c: 'rgba(201,168,76,0.9)' },
          { id: 'active', label: `ACTIVE (${counts.active})`, c: 'rgba(76,173,126,0.9)' },
          { id: 'rejected', label: `REJECTED (${counts.rejected})`, c: 'rgba(217,79,79,0.9)' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0,
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 999,
              background: tab === t.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
              border: tab === t.id ? `1px solid ${t.c}` : '1px solid rgba(255,255,255,0.10)',
              color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.7)',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: tab === t.id ? 800 : 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="검색: 제품명 / 브랜드"
          style={{
            flex: '1 1 220px',
            minWidth: 180,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 12,
            padding: '10px 12px',
            color: '#fff',
            fontSize: 12,
          }}
        />
        <select
          value={brandQ}
          onChange={e => setBrandQ(e.target.value)}
          style={{
            flex: '0 0 auto',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 12,
            padding: '10px 12px',
            color: '#fff',
            fontSize: 12,
          }}
        >
          <option value="all">전체 브랜드</option>
          {brandOptions.map(b => (
            <option key={b.name} value={b.name}>
              {b.name} ({b.count})
            </option>
          ))}
        </select>
        {(q || brandQ !== 'all') && (
          <button
            onClick={() => {
              setQ('')
              setBrandQ('all')
            }}
            style={{
              flex: '0 0 auto',
              fontSize: 11,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            필터 초기화
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
      ) : filteredRows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>표시할 제품이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredRows.map(p => (
            <div key={p.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12, display: 'flex', gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                {p.thumb_img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{p.brandName}</span>
                  <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: 'var(--gold)' }}>₩{p.price.toLocaleString()}</span>
                  <span style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                {tab === 'pending' ? (
                  <>
                    <button
                      onClick={() => approveOne(p.id)}
                      disabled={busyId === p.id}
                      style={{ fontSize: 11, padding: '6px 10px', borderRadius: 10, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.38)', color: '#4cad7e', fontWeight: 800, cursor: 'pointer', opacity: busyId === p.id ? 0.7 : 1 }}
                    >
                      승인
                    </button>
                    <button
                      onClick={() => rejectOne(p.id)}
                      disabled={busyId === p.id}
                      style={{ fontSize: 11, padding: '6px 10px', borderRadius: 10, background: 'rgba(217,79,79,0.10)', border: '1px solid rgba(217,79,79,0.28)', color: '#d94f4f', fontWeight: 800, cursor: 'pointer', opacity: busyId === p.id ? 0.7 : 1 }}
                    >
                      거절
                    </button>
                  </>
                ) : tab === 'rejected' ? (
                  <button
                    onClick={() => approveOne(p.id)}
                    disabled={busyId === p.id}
                    style={{ fontSize: 11, padding: '6px 10px', borderRadius: 10, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.38)', color: '#4cad7e', fontWeight: 800, cursor: 'pointer', opacity: busyId === p.id ? 0.7 : 1 }}
                  >
                    다시 승인
                  </button>
                ) : (
                  <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 999, border: '1px solid rgba(76,173,126,0.35)', color: '#4cad7e', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>
                    ACTIVE
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

