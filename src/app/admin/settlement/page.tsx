'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Settlement = {
  id: string
  target_id: string
  target_role: string
  target_name?: string | null
  amount: number
  platform_fee: number
  net_amount: number
  period_start: string
  period_end: string
  status: string
  created_at: string
}

export default function AdminSettlementBatchPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [rows, setRows] = useState<Settlement[]>([])
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [showAllPending, setShowAllPending] = useState(false)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [createStart, setCreateStart] = useState('')
  const [createEnd, setCreateEnd] = useState('')

  const cutoff = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    return d
  }, [])

  const eligible = useMemo(() => {
    if (showAllPending) return rows
    return rows.filter(r => new Date(r.period_end) <= cutoff)
  }, [rows, cutoff, showAllPending])

  const selected = useMemo(() => eligible.filter(r => selectedIds[r.id]), [eligible, selectedIds])

  const summary = useMemo(() => {
    const byRole: Record<string, { count: number; net: number }> = {}
    for (const r of selected) {
      const k = r.target_role || '-'
      if (!byRole[k]) byRole[k] = { count: 0, net: 0 }
      byRole[k].count += 1
      byRole[k].net += r.net_amount || 0
    }
    const totalNet = selected.reduce((a, b) => a + (b.net_amount || 0), 0)
    return { byRole, totalNet, totalCount: selected.length }
  }, [selected])

  const load = async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const authUser = auth?.user
    if (authUser) {
      const { data: u } = await supabase.from('users').select('id,role').eq('auth_id', authUser.id).single()
      setAdminId(u?.id || null)
    } else {
      setAdminId(null)
    }

    const { data } = await supabase
      .from('settlements')
      .select('id,target_id,target_role,target_name,amount,platform_fee,net_amount,period_start,period_end,status,created_at')
      .eq('status', '정산대기')
      .order('created_at', { ascending: false })
      .limit(500)

    const list = ((data || []) as any[]).map(x => ({
      ...x,
      amount: Number(x.amount || 0),
      platform_fee: Number(x.platform_fee || 0),
      net_amount: Number(x.net_amount || 0),
    })) as Settlement[]

    setRows(list)
    const init: Record<string, boolean> = {}
    list.forEach(r => {
      if (new Date(r.period_end) <= cutoff) init[r.id] = true
    })
    setSelectedIds(init)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // 기본값: 이번달 1일 ~ 오늘
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setCreateStart(fmt(start))
    setCreateEnd(fmt(now))
  }, [])

  const toggleAllEligible = (on: boolean) => {
    const next = { ...selectedIds }
    eligible.forEach(r => (next[r.id] = on))
    setSelectedIds(next)
  }

  const holdOne = async (id: string) => {
    if (!confirm('이 정산을 보류 처리할까요?')) return
    const { error } = await supabase.from('settlements').update({ status: '보류' }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows(prev => prev.filter(r => r.id !== id))
    setSelectedIds(prev => {
      const n = { ...prev }
      delete n[id]
      return n
    })
  }

  const batchPay = async () => {
    if (!adminId) {
      alert('관리자 인증 정보를 확인할 수 없습니다. 다시 로그인 후 시도해주세요.')
      return
    }
    if (selected.length === 0) {
      alert('선택된 정산이 없습니다.')
      return
    }
    if (!confirm(`선택된 ${selected.length}건을 정산완료 처리할까요?`)) return

    setProcessing(true)
    const now = new Date().toISOString()
    const ids = selected.map(s => s.id)
    const { error } = await supabase
      .from('settlements')
      .update({ status: '정산완료', approved_by: adminId, approved_at: now, paid_at: now })
      .in('id', ids)

    if (error) {
      alert(error.message)
      setProcessing(false)
      return
    }

    // UI 반영
    setRows(prev => prev.filter(r => !ids.includes(r.id)))
    setSelectedIds({})
    setProcessing(false)
  }

  const createFromOrders = async () => {
    if (!createStart || !createEnd) {
      alert('기간을 입력해주세요.')
      return
    }
    const start = new Date(`${createStart}T00:00:00`)
    const end = new Date(`${createEnd}T23:59:59`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      alert('기간이 올바르지 않습니다.')
      return
    }

    if (!confirm(`해당 기간 주문을 기반으로 정산대기를 생성할까요?\n${createStart} ~ ${createEnd}`)) return

    setCreating(true)
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id,partner_id,partner_commission,owner_id,owner_commission,delivered_at,status')
        .gte('delivered_at', start.toISOString())
        .lte('delivered_at', end.toISOString())
        .eq('status', '배송완료')

      if (error) {
        alert(error.message)
        return
      }

      const partnerSum = new Map<string, number>()
      const ownerSum = new Map<string, number>()
      ;(orders || []).forEach((o: any) => {
        if (o.partner_id && o.partner_commission) partnerSum.set(o.partner_id, (partnerSum.get(o.partner_id) || 0) + Number(o.partner_commission || 0))
        if (o.owner_id && o.owner_commission) ownerSum.set(o.owner_id, (ownerSum.get(o.owner_id) || 0) + Number(o.owner_commission || 0))
      })

      const targetIds = Array.from(new Set([...Array.from(partnerSum.keys()), ...Array.from(ownerSum.keys())]))
      if (targetIds.length === 0) {
        alert('해당 기간에 생성할 정산 대상이 없습니다. (commission이 없거나 대상 id가 없음)')
        return
      }

      // 이름 채우기
      const { data: users } = await supabase.from('users').select('id,name').in('id', targetIds)
      const nameMap: Record<string, string> = {}
      ;(users || []).forEach((u: any) => (nameMap[u.id] = u.name))

      const periodStart = start.toISOString()
      const periodEnd = end.toISOString()

      // 중복 방지: 동일 target_id + role + period_start/end 조합이 이미 있으면 제외
      const { data: existing } = await supabase
        .from('settlements')
        .select('id,target_id,target_role,period_start,period_end,status')
        .in('target_id', targetIds)
        .eq('status', '정산대기')
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .limit(500)

      const existKey = new Set<string>()
      ;(existing || []).forEach((x: any) => {
        existKey.add(`${x.target_id}|${x.target_role}|${String(x.period_start).slice(0, 10)}|${String(x.period_end).slice(0, 10)}`)
      })
      const keyOf = (targetId: string, role: string) => `${targetId}|${role}|${periodStart.slice(0, 10)}|${periodEnd.slice(0, 10)}`

      const inserts: any[] = []
      partnerSum.forEach((amount, targetId) => {
        if (amount <= 0) return
        if (existKey.has(keyOf(targetId, 'partner'))) return
        inserts.push({
          target_id: targetId,
          target_role: 'partner',
          target_name: nameMap[targetId] || null,
          amount,
          platform_fee: 0,
          net_amount: amount,
          period_start: periodStart,
          period_end: periodEnd,
          status: '정산대기',
        })
      })
      ownerSum.forEach((amount, targetId) => {
        if (amount <= 0) return
        if (existKey.has(keyOf(targetId, 'owner'))) return
        inserts.push({
          target_id: targetId,
          target_role: 'owner',
          target_name: nameMap[targetId] || null,
          amount,
          platform_fee: 0,
          net_amount: amount,
          period_start: periodStart,
          period_end: periodEnd,
          status: '정산대기',
        })
      })

      if (inserts.length === 0) {
        alert('이미 생성된 정산대기(동일 기간)가 있어 추가 생성할 항목이 없습니다.')
        return
      }

      const { error: insErr } = await supabase.from('settlements').insert(inserts)
      if (insErr) {
        alert(insErr.message)
        return
      }

      alert(`정산대기 ${inserts.length}건 생성 완료`)
      await load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>정산 일괄 처리</div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            기본 대상: <span style={{ color: '#c9a84c', fontWeight: 900 }}>D-3</span> (기간 종료일 ≤ {cutoff.toLocaleDateString('ko-KR')})
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading || processing}
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.75)',
            fontWeight: 900,
            cursor: loading || processing ? 'not-allowed' : 'pointer',
          }}
        >
          새로고침
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
          <input type="checkbox" checked={showAllPending} onChange={e => setShowAllPending(e.target.checked)} />
          D-3 조건 무시하고 “정산대기” 전체 보기
        </label>
        <button
          onClick={() => toggleAllEligible(true)}
          disabled={loading || processing}
          style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.30)', color: '#c9a84c', fontWeight: 900, cursor: loading || processing ? 'not-allowed' : 'pointer', fontSize: 12 }}
        >
          전체 선택
        </button>
        <button
          onClick={() => toggleAllEligible(false)}
          disabled={loading || processing}
          style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.70)', fontWeight: 900, cursor: loading || processing ? 'not-allowed' : 'pointer', fontSize: 12 }}
        >
          선택 해제
        </button>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '12px 12px', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>정산대기 생성 (주문 기반)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>시작일</div>
            <input
              value={createStart}
              onChange={e => setCreateStart(e.target.value)}
              placeholder="YYYY-MM-DD"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 14, background: '#141414', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontSize: 12, outline: 'none', fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>종료일</div>
            <input
              value={createEnd}
              onChange={e => setCreateEnd(e.target.value)}
              placeholder="YYYY-MM-DD"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 14, background: '#141414', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontSize: 12, outline: 'none', fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
          기준: <span style={{ color: '#c9a84c', fontWeight: 900 }}>배송완료</span> 주문의 `partner_commission`, `owner_commission`을 합산하여 생성합니다.
        </div>
        <button
          onClick={createFromOrders}
          disabled={loading || processing || creating}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 16,
            background: creating ? 'rgba(255,255,255,0.06)' : 'rgba(76,173,126,0.14)',
            border: creating ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(76,173,126,0.30)',
            color: creating ? 'rgba(255,255,255,0.65)' : '#4cad7e',
            fontWeight: 900,
            cursor: loading || processing || creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? '생성 중…' : '정산대기 생성'}
        </button>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '12px 12px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)' }}>
            선택: <span style={{ color: '#fff', fontWeight: 900 }}>{summary.totalCount}건</span>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 900, color: '#c9a84c' }}>
            ₩{summary.totalNet.toLocaleString()}
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(summary.byRole).map(([role, v]) => (
            <div key={role} style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              {role} {v.count}건 · ₩{v.net.toLocaleString()}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            onClick={batchPay}
            disabled={loading || processing || summary.totalCount === 0}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 16,
              background: processing ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.18)',
              border: '1px solid rgba(201,168,76,0.35)',
              color: '#c9a84c',
              fontWeight: 900,
              cursor: loading || processing || summary.totalCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {processing ? '처리 중…' : '선택 정산 완료(일괄 지급)'}
          </button>
        </div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>정산 대기 목록</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            표시 {eligible.length}건 / 전체 {rows.length}건
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : eligible.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>대상이 없습니다.</div>
        ) : (
          eligible.map(r => {
            const isEligible = new Date(r.period_end) <= cutoff
            return (
              <div key={r.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!selectedIds[r.id]}
                      onChange={e => setSelectedIds(prev => ({ ...prev, [r.id]: e.target.checked }))}
                      style={{ marginTop: 3 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.target_name || r.target_id?.slice(0, 8)} <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)' }}>({r.target_role})</span>
                      </div>
                      <div style={{ marginTop: 5, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                        period {r.period_start?.slice(0, 10)} ~ {r.period_end?.slice(0, 10)} {isEligible ? '' : '· not D-3'}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: "'JetBrains Mono', monospace" }}>
                        <span>amount ₩{(r.amount || 0).toLocaleString()}</span>
                        <span>fee ₩{(r.platform_fee || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 900, color: '#c9a84c' }}>₩{(r.net_amount || 0).toLocaleString()}</div>
                    <button
                      onClick={() => holdOne(r.id)}
                      disabled={processing}
                      style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.70)', fontWeight: 900, cursor: processing ? 'not-allowed' : 'pointer', fontSize: 12 }}
                    >
                      보류
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

