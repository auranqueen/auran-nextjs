'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PlanRow = Record<string, unknown> & { id?: string; name?: string | null; slug?: string | null; code?: string | null; mode?: string | null; owner_mode?: string | null; monthly_price?: number | null; sort_order?: number | null; is_active?: boolean | null }

type SubRow = Record<string, unknown> & {
  id?: string
  owner_id?: string | null
  plan?: string | null
  status?: string | null
  started_at?: string | null
  expires_at?: string | null
  monthly_price?: number | null
  created_at?: string | null
}

type UserRow = { id: string; name?: string | null; email?: string | null }

export default function AdminSubscriptionsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [subs, setSubs] = useState<SubRow[]>([])
  const [usersById, setUsersById] = useState<Record<string, UserRow>>({})

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const [{ data: planData }, { data: subData }] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true }).limit(200),
        supabase.from('owner_subscriptions').select('*').order('created_at', { ascending: false }).limit(500),
      ])
      const subList = (subData || []) as SubRow[]
      setPlans((planData || []) as PlanRow[])
      setSubs(subList)

      const ownerIds = Array.from(new Set(subList.map((s) => String(s.owner_id || '')).filter(Boolean)))
      if (ownerIds.length) {
        const { data: urows } = await supabase.from('users').select('id,name,email').in('id', ownerIds)
        const m: Record<string, UserRow> = {}
        ;((urows || []) as UserRow[]).forEach((u) => {
          m[u.id] = u
        })
        setUsersById(m)
      } else {
        setUsersById({})
      }
      setLoading(false)
    }
    void run()
  }, [supabase])

  const kpi = useMemo(() => {
    const active = subs.filter((s) => String(s.status || '').toLowerCase() === 'active')
    const mrr = active.reduce((a, s) => a + Number(s.monthly_price || 0), 0)
    return { totalSubs: subs.length, activeCount: active.length, mrr }
  }, [subs])

  if (loading) {
    return (
      <div style={{ color: 'var(--text2)', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>구독 관리</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>원장님 구독 플랜·결제 구독 레코드를 한곳에서 확인합니다.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>구독 레코드</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>{kpi.totalSubs}</div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>활성 구독</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 6 }}>{kpi.activeCount}</div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>월 구독료 합(활성)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold2)', marginTop: 6 }}>₩{kpi.mrr.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>판매 중 플랜 ({plans.length})</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>이름</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>슬러그/코드</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>모드</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>월 가격</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>정렬</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: 'var(--text3)' }}>
                  등록된 플랜이 없습니다. <code style={{ color: 'var(--text2)' }}>subscription_plans</code> 테이블을 확인해 주세요.
                </td>
              </tr>
            ) : (
              plans.map((p) => (
                <tr key={String(p.id)} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{p.name || '-'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)', fontFamily: 'monospace' }}>{p.slug || p.code || '-'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{String(p.mode || p.owner_mode || '-')}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>₩{Number(p.monthly_price || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{p.sort_order ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: 14, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>원장님 구독 내역 ({subs.length})</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>원장님</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>플랜</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>상태</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>월 요금</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>시작</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>만료</th>
              <th style={{ padding: '10px 12px', color: 'var(--text3)', fontWeight: 600 }}>생성일</th>
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: 'var(--text3)' }}>
                  구독 레코드가 없습니다.
                </td>
              </tr>
            ) : (
              subs.map((s) => {
                const oid = String(s.owner_id || '')
                const u = usersById[oid]
                const st = String(s.status || '')
                const stLower = st.toLowerCase()
                const badgeColor =
                  stLower === 'active' ? '#4cad7e' : stLower === 'cancelled' || stLower === 'canceled' ? 'var(--text3)' : 'var(--gold2)'
                return (
                  <tr key={String(s.id)} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>
                      <div style={{ fontWeight: 600 }}>{u?.name || oid.slice(0, 8) + '…'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{u?.email || ''}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', fontFamily: 'monospace' }}>{s.plan || '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: badgeColor, fontWeight: 600 }}>{st || '-'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>₩{Number(s.monthly_price || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{s.started_at ? new Date(s.started_at).toLocaleDateString('ko-KR') : '-'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{s.expires_at ? new Date(s.expires_at).toLocaleDateString('ko-KR') : '-'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{s.created_at ? new Date(s.created_at).toLocaleString('ko-KR') : '-'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
