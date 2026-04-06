'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tab = 'partner' | 'owner'

function monthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export default function AdminCommissionsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('partner')
  const [loading, setLoading] = useState(true)
  const [partnerRows, setPartnerRows] = useState<any[]>([])
  const [ownerRows, setOwnerRows] = useState<any[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})
  const [productMap, setProductMap] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [df, setDf] = useState('')
  const [dt, setDt] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let pq = supabase.from('partner_commissions' as any).select('*').order('created_at', { ascending: false }).limit(500)
      let oq = supabase.from('owner_commissions' as any).select('*').order('created_at', { ascending: false }).limit(500)
      if (statusFilter) {
        pq = pq.eq('status', statusFilter)
        oq = oq.eq('status', statusFilter)
      }
      if (df) {
        pq = pq.gte('created_at', new Date(df).toISOString())
        oq = oq.gte('created_at', new Date(df).toISOString())
      }
      if (dt) {
        const e = new Date(dt)
        e.setHours(23, 59, 59, 999)
        pq = pq.lte('created_at', e.toISOString())
        oq = oq.lte('created_at', e.toISOString())
      }
      const [{ data: pr }, { data: or }] = await Promise.all([pq, oq])
      const pl = (pr as any[]) || []
      const ol = (or as any[]) || []
      setPartnerRows(pl)
      setOwnerRows(ol)

      const userIds = Array.from(
        new Set([
          ...pl.map((r) => String(r.partner_id || '')).filter(Boolean),
          ...ol.map((r) => String(r.owner_id || '')).filter(Boolean),
        ])
      )
      const pids = Array.from(
        new Set([...pl.map((r) => String(r.product_id || '')), ...ol.map((r) => String(r.product_id || ''))].filter(Boolean))
      )

      const nm: Record<string, string> = {}
      if (userIds.length) {
        const { data: users } = await supabase.from('users').select('id,name').in('id', userIds)
        ;((users as any[]) || []).forEach((u) => {
          nm[String(u.id)] = String(u.name || u.id).slice(0, 20)
        })
      }
      setNameMap(nm)

      const pm: Record<string, string> = {}
      if (pids.length) {
        const { data: prods } = await supabase.from('products').select('id,name').in('id', pids)
        ;((prods as any[]) || []).forEach((p) => {
          pm[String(p.id)] = String(p.name || '')
        })
      }
      setProductMap(pm)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, df, dt])

  useEffect(() => {
    void load()
  }, [load])

  const updatePartner = async (id: string, status: string) => {
    await supabase.from('partner_commissions' as any).update({ status } as any).eq('id', id)
    setToast('상태가 반영됐어요')
    void load()
  }

  const updateOwner = async (id: string, status: string) => {
    await supabase.from('owner_commissions' as any).update({ status } as any).eq('id', id)
    setToast('상태가 반영됐어요')
    void load()
  }

  const runPartnerMonthSettlement = async () => {
    const { start, end } = monthBounds()
    const { data: rows } = await supabase
      .from('partner_commissions' as any)
      .select('*')
      .eq('status', 'confirmed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    const list = (rows as any[]) || []
    if (!list.length) {
      setToast('이번 달 확정 커미션이 없어요')
      return
    }
    const byPartner: Record<string, any[]> = {}
    for (const r of list) {
      const k = String(r.partner_id || '')
      if (!k) continue
      if (!byPartner[k]) byPartner[k] = []
      byPartner[k].push(r)
    }
    for (const pid of Object.keys(byPartner)) {
      const chunk = byPartner[pid]
      const sum = chunk.reduce((a, r) => a + Number(r.commission_amount || 0), 0)
      await supabase.from('partner_settlements' as any).insert({
        partner_id: pid,
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        total_commission: sum,
        settlement_amount: sum,
        net_amount: sum,
        status: 'paid',
      } as any)
      const ids = chunk.map((r) => r.id)
      await supabase.from('partner_commissions' as any).update({ status: 'paid' } as any).in('id', ids)
    }
    setToast('이달 파트너 정산 처리됐어요')
    void load()
  }

  const runOwnerMonthSettlement = async () => {
    const { start, end } = monthBounds()
    const { data: rows } = await supabase
      .from('owner_commissions' as any)
      .select('*')
      .eq('status', 'confirmed')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    const list = (rows as any[]) || []
    if (!list.length) {
      setToast('이번 달 확정 커미션이 없어요')
      return
    }
    const byOwner: Record<string, any[]> = {}
    for (const r of list) {
      const k = String(r.owner_id || '')
      if (!k) continue
      if (!byOwner[k]) byOwner[k] = []
      byOwner[k].push(r)
    }
    for (const oid of Object.keys(byOwner)) {
      const chunk = byOwner[oid]
      const sum = chunk.reduce((a, r) => a + Number(r.commission_amount || 0), 0)
      await supabase.from('owner_settlements' as any).insert({
        owner_id: oid,
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        total_commission: sum,
        settlement_amount: sum,
        net_amount: sum,
        status: 'paid',
      } as any)
      const ids = chunk.map((r) => r.id)
      await supabase.from('owner_commissions' as any).update({ status: 'paid' } as any).in('id', ids)
    }
    setToast('이달 원장 정산 처리됐어요')
    void load()
  }

  const rows = tab === 'partner' ? partnerRows : ownerRows

  const statusColor = (s: string) => {
    const x = String(s || '').toLowerCase()
    if (x === 'paid' || x === '지급완료') return '#4cad7e'
    if (x === 'confirmed' || x === '확정') return '#4a8dc0'
    if (x === 'cancelled' || x === 'canceled') return '#ff6b6b'
    return 'var(--text3)'
  }

  if (loading && !partnerRows.length && !ownerRows.length) {
    return <div style={{ color: 'var(--text2)', fontSize: 13 }}>불러오는 중…</div>
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>커미션 관리</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setTab('partner')}
            style={{
              border: tab === 'partner' ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: tab === 'partner' ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            파트너스 커미션
          </button>
          <button
            type="button"
            onClick={() => setTab('owner')}
            style={{
              border: tab === 'owner' ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: tab === 'owner' ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
              color: 'var(--text)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            원장님 커미션
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="confirmed">확정</option>
          <option value="paid">지급완료</option>
          <option value="cancelled">취소</option>
        </select>
        <input type="date" value={df} onChange={(e) => setDf(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 6, fontSize: 12 }} />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>~</span>
        <input type="date" value={dt} onChange={(e) => setDt(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 6, fontSize: 12 }} />
        <button type="button" className="btn btn-bl" onClick={() => void load()} style={{ fontSize: 12, padding: '6px 12px' }}>
          조회
        </button>
        {tab === 'partner' ? (
          <button type="button" className="btn btn-gr" onClick={() => void runPartnerMonthSettlement()} style={{ fontSize: 12, padding: '6px 12px' }}>
            이달 정산 처리 (파트너)
          </button>
        ) : (
          <button type="button" className="btn btn-gr" onClick={() => void runOwnerMonthSettlement()} style={{ fontSize: 12, padding: '6px 12px' }}>
            이달 정산 처리 (원장)
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>{tab === 'partner' ? '파트너' : '원장'}</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>제품</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>주문금액</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>율</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>커미션</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>상태</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>일시</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 20, color: 'var(--text3)' }}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const uid = tab === 'partner' ? String(r.partner_id) : String(r.owner_id)
                const pname = productMap[String(r.product_id)] || r.product_id || '-'
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{nameMap[uid] || uid.slice(0, 8)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{pname}</td>
                    <td style={{ padding: '10px 12px' }}>₩{Number(r.order_amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>{Number(r.commission_rate || 0)}%</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>₩{Number(r.commission_amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: statusColor(r.status) }}>{r.status}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <button type="button" className="btn btn-bl" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => void (tab === 'partner' ? updatePartner(r.id, 'confirmed') : updateOwner(r.id, 'confirmed'))}>
                          확정
                        </button>
                        <button type="button" className="btn btn-re" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => void (tab === 'partner' ? updatePartner(r.id, 'cancelled') : updateOwner(r.id, 'cancelled'))}>
                          취소
                        </button>
                        <button type="button" className="btn btn-gr" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => void (tab === 'partner' ? updatePartner(r.id, 'paid') : updateOwner(r.id, 'paid'))}>
                          지급완료
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 300 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
