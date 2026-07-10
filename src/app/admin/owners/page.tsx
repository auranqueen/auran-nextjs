'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Salon = {
  id: string
  owner_id: string
  name: string
  area?: string | null
  address?: string | null
  phone?: string | null
  status: string
  created_at: string
}

type Owner = {
  id: string
  name: string
  email: string
  status: string
}

export default function AdminOwnersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [salons, setSalons] = useState<Salon[]>([])
  const [owners, setOwners] = useState<Record<string, Owner>>({})
  const [tab, setTab] = useState<'owners' | 'reports' | 'subs' | 'settlement'>('owners')
  const [ownerProfiles, setOwnerProfiles] = useState<any[]>([])
  const [ownerReports, setOwnerReports] = useState<any[]>([])
  const [ownerSubscriptions, setOwnerSubscriptions] = useState<any[]>([])
  const [ownerWarnings, setOwnerWarnings] = useState<any[]>([])
  const [kpi, setKpi] = useState({ monthNew: 0, total: 0, activeSub: 0, subSum: 0, presOrders: 0, presCommission: 0 })

  const pending = useMemo(() => salons.filter(s => (s.status || '').toLowerCase() === 'pending'), [salons])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: s } = await supabase
        .from('salons')
        .select('id,owner_id,name,area,address,phone,status,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      const list = (s || []) as Salon[]
      setSalons(list)

      const ownerIds = Array.from(new Set(list.map(x => x.owner_id).filter(Boolean)))
      if (ownerIds.length) {
        const { data: u } = await supabase
          .from('users')
          .select('id,name,email,status')
          .in('id', ownerIds)
        const m: Record<string, Owner> = {}
        ;(u || []).forEach((x: any) => (m[x.id] = x))
        setOwners(m)
      } else {
        setOwners({})
      }

      const [{ data: op }, { data: reps }, { data: subs }, { data: warns }, { data: setRows }, { data: pTx }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'owner').order('created_at', { ascending: false }).limit(300),
        supabase.from('owner_reports').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('owner_subscriptions').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('owner_warnings').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('admin_settings').select('value').eq('category', 'settlement').eq('key', 'owner_settlement_requires_chart').maybeSingle(),
        supabase.from('point_transactions').select('amount,type').eq('type', 'prescription_commission').limit(500),
      ])
      const ownersList = (op as any[]) || []
      setOwnerProfiles(ownersList)
      setOwnerReports((reps as any[]) || [])
      setOwnerSubscriptions((subs as any[]) || [])
      setOwnerWarnings((warns as any[]) || [])
      const monthKey = new Date().toISOString().slice(0, 7)
      const activeSub = ((subs as any[]) || []).filter((x) => String(x.status || '').toLowerCase() === 'active')
      const subSum = activeSub.reduce((sum, x) => sum + Number(x.price || x.amount || 0), 0)
      const pCom = ((pTx as any[]) || []).reduce((sum, x) => sum + Number(x.amount || 0), 0)
      setKpi({
        monthNew: ownersList.filter((x) => String(x.created_at || '').slice(0, 7) === monthKey).length,
        total: ownersList.length,
        activeSub: activeSub.length,
        subSum,
        presOrders: ((pTx as any[]) || []).length,
        presCommission: pCom,
      })
      setLoading(false)
    }
    run()
  }, [])

  const updateStatus = async (salon: Salon, status: string) => {
    const res = await fetch('/api/admin/owners/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        salon_id: salon.id,
        action: status === 'active' ? 'approve' : 'reject',
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j?.ok) {
      alert(typeof j?.error === 'string' ? j.error : '처리 실패')
      return
    }

    setSalons(prev => prev.map(s => (s.id === salon.id ? { ...s, status } : s)))
  }

  const sendWarning = async (report: any) => {
    await supabase.from('owner_warnings').insert({ owner_id: report.owner_id, report_id: report.id, reason: report.reason } as any)
    const target = ownerProfiles.find((x) => x.id === report.owner_id)
    const next = Number(target?.owner_warning_count || 0) + 1
    await supabase.from('profiles').update({ owner_warning_count: next } as any).eq('id', report.owner_id)
    const { data: u } = await supabase.from('users').select('id').eq('id', report.owner_id).maybeSingle()
    if (u?.id) {
      await supabase.from('notifications').insert({
        user_id: u.id,
        type: 'promo',
        title: '⚠️ 경고가 발송됐어요',
        body: `사유: ${report.reason}\n3회 누적 시 자격 정지됩니다`,
        icon: '⚠️',
        is_read: false,
      } as any)
    }
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>원장님 관리</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>입점 승인/거절</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, fontSize: 11 }}>이달 신규 {kpi.monthNew}명</div>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, fontSize: 11 }}>전체 {kpi.total}명</div>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, fontSize: 11 }}>활성 구독 {kpi.activeSub}건</div>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, fontSize: 11 }}>구독료 합계 ₩{kpi.subSum.toLocaleString()}</div>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, fontSize: 11 }}>처방전 구매 {kpi.presOrders}건</div>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10, fontSize: 11 }}>처방전 커미션 {kpi.presCommission.toLocaleString()}T</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[
          ['owners', '원장님 목록'],
          ['reports', '신고 관리'],
          ['subs', '구독 관리'],
          ['settlement', '정산 관리'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{ border: tab === k ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)', background: tab === k ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.04)', color: '#fff', borderRadius: 10, padding: '7px 10px', fontSize: 11 }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'owners' ? (
      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>입점 신청 대기</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{pending.length}건</div>
        </div>

        {loading ? (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>대기 중인 입점 신청이 없습니다.</div>
        ) : (
          pending.map(s => (
            <div key={s.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{s.name}</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                    {s.area || ''} {s.address ? `· ${s.address}` : ''}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                    owner: {owners[s.owner_id]?.name || s.owner_id?.slice(0, 6)} · {owners[s.owner_id]?.email || ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => updateStatus(s, 'active')}
                    style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.30)', color: '#4cad7e', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                  >
                    승인
                  </button>
                  <button
                    onClick={() => updateStatus(s, 'rejected')}
                    style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(217,79,79,0.12)', border: '1px solid rgba(217,79,79,0.30)', color: '#d94f4f', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                  >
                    거절
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      ) : null}

      {tab === 'reports' ? (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 12 }}>
          {ownerReports.map((r) => (
            <div key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0' }}>
              <div style={{ fontSize: 12, color: '#fff' }}>신고자 {r.reporter_id} / 대상 {r.owner_id}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{r.reason}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                <button onClick={() => void sendWarning(r)} style={{ border: '1px solid rgba(217,79,79,0.3)', background: 'rgba(217,79,79,0.12)', color: '#ff9d9d', borderRadius: 8, padding: '5px 8px', fontSize: 11 }}>경고 발송</button>
                <button onClick={async () => { await supabase.from('profiles').update({ owner_is_suspended: true } as any).eq('id', r.owner_id) }} style={{ border: '1px solid rgba(217,79,79,0.3)', background: 'rgba(217,79,79,0.12)', color: '#ff9d9d', borderRadius: 8, padding: '5px 8px', fontSize: 11 }}>자격 정지</button>
                <button style={{ border: '1px solid rgba(217,79,79,0.3)', background: 'rgba(217,79,79,0.12)', color: '#ff9d9d', borderRadius: 8, padding: '5px 8px', fontSize: 11 }}>영구 탈퇴</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'subs' ? (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 12 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>만료 7일 이내</div>
          {ownerSubscriptions.filter((s) => {
            const ex = new Date(s.expires_at || '').getTime()
            return ex && ex - Date.now() <= 7 * 86400000 && ex > Date.now()
          }).map((s) => (
            <div key={s.id} style={{ fontSize: 11, color: '#fff', marginBottom: 6 }}>{s.owner_id} / {s.plan} / 만료 {String(s.expires_at || '').slice(0, 10)}</div>
          ))}
        </div>
      ) : null}

      {tab === 'settlement' ? (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          차트 작성 완료 + 고객 서명 완료 주문만 정산 가능
          <div style={{ marginTop: 6, fontSize: 11, color: '#c4a7e7' }}>owner_settlement_requires_chart=true일 때 차트 없는 주문 정산 비활성화</div>
        </div>
      ) : null}
    </div>
  )
}

