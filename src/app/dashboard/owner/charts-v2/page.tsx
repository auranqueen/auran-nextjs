'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CustomerPopup from './CustomerPopup'
import ChartPopup from './ChartPopup'
import InvitePopup from './InvitePopup'

const BG = '#ffffff'
const CARD = '#f9f8fc'
const BORDER = '#ede9f7'
const POINT = '#7B5EA7'
const TEXT = '#1A1A2E'
const SUB = '#888888'

type CustomerRow = {
  key: string
  kind: 'user'
  id: string
  authId: string | null
  name: string
  profile: Record<string, unknown> | null
  visitCount: number
  lastVisit: string | null
}

function getPhaseFromCycleStart(startDate: string | null | undefined): string {
  if (!startDate) return '—'
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return '—'
  const today = new Date()
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const day = ((diff % 28) + 28) % 28
  if (day < 5) return '달빛기'
  if (day < 13) return '황금기'
  if (day < 20) return '만개기'
  return '물들기'
}

function phaseEmoji(phase: string): string {
  if (phase === '달빛기') return '🌙'
  if (phase === '황금기') return '✨'
  if (phase === '만개기') return '🌸'
  if (phase === '물들기') return '🍂'
  return ''
}

function cycleStartFromProfile(profile: Record<string, unknown> | null | undefined): string | null {
  if (!profile) return null
  const start = profile.last_period_date
  return start ? String(start) : null
}

function parseMemo(raw: string | null | undefined) {
  try {
    return JSON.parse(String(raw || '{}'))
  } catch {
    return {}
  }
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: 44,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 400,
    borderRadius: 20,
    border: active ? `1px solid ${POINT}` : `1px solid ${BORDER}`,
    background: active ? '#EDE9F7' : BG,
    color: active ? POINT : TEXT,
    cursor: 'pointer',
  }
}

function PhaseBadge({ phase }: { phase: string }) {
  if (!phase || phase === '—') return <span style={{ color: SUB, fontSize: 12 }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#EDE9F7', color: POINT, border: `1px solid ${BORDER}` }}>
      {phase}
      {phaseEmoji(phase)}
    </span>
  )
}

function visitStatusBadge(row: any) {
  if (row.auran_joined) {
    return <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 20, background: '#e8f8ef', color: '#2d8a56' }}>오렌 연동</span>
  }
  const memo = parseMemo(row.memo)
  if (memo.invite_sent_at) {
    return <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 20, background: '#fff8e6', color: '#b8860b' }}>앱 초대 중</span>
  }
  return <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 20, background: '#f0f0f0', color: SUB }}>내방</span>
}

export default function OwnerChartsV2Page() {
  const supabase = createClient()
  const router = useRouter()
  const supabaseRef = useRef(supabase)
  supabaseRef.current = supabase

  const [owner, setOwner] = useState<{ id: string; auth_id?: string } | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [visitCustomers, setVisitCustomers] = useState<any[]>([])
  const [kpi, setKpi] = useState({ today: 0, month: 0, unsigned: 0, totalCustomers: 0 })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [activeTab, setActiveTab] = useState<'oraen' | 'visit'>('visit')
  const [showCustomerPopup, setShowCustomerPopup] = useState(false)
  const [showChartPopup, setShowChartPopup] = useState(false)
  const [showInvitePopup, setShowInvitePopup] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<any>(null)

  const refreshData = useCallback(async (ownerId: string) => {
    const sb = supabaseRef.current
    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const monthKey = todayKey.slice(0, 7)

    const [{ data: charts }, { data: externals }] = await Promise.all([
      sb.from('treatment_charts').select('id,treatment_date,customer_signed_at,customer_id,treatment_items,before_photos,after_photos').eq('owner_id', ownerId).order('treatment_date', { ascending: false }).limit(200),
      sb.from('external_customers').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    ])

    const chartList = (charts as any[]) || []
    const customerIds = Array.from(new Set(chartList.map((c) => String(c.customer_id || '')).filter(Boolean)))

    let userList: any[] = []
    if (customerIds.length) {
      const { data: usersData } = await sb.from('users').select('id,name,auth_id').in('id', customerIds)
      userList = (usersData as any[]) || []
    }

    const authIds = userList.map((u) => u.auth_id).filter(Boolean)
    const userIds = userList.map((u) => u.id).filter(Boolean)

    let profileMap: Record<string, Record<string, unknown>> = {}
    if (authIds.length) {
      const { data: profiles } = await sb.from('profiles').select('auth_id,skin_type,skin_concerns,birth_date,body_status,allergy_ingredients').in('auth_id', authIds)
      for (const p of (profiles as any[]) || []) {
        if (p.auth_id) profileMap[p.auth_id] = p
      }
    }

    let hormoneMap: Record<string, string> = {}
    if (userIds.length) {
      const { data: hcRows } = await sb.from('hormone_cycle').select('user_id,last_period_date,created_at').in('user_id', userIds).order('created_at', { ascending: false })
      for (const h of (hcRows as any[]) || []) {
        const uid = String(h.user_id || '')
        if (uid && !hormoneMap[uid] && h.last_period_date) hormoneMap[uid] = String(h.last_period_date)
      }
    }

    const visitByCustomer: Record<string, { count: number; last: string | null }> = {}
    for (const c of chartList) {
      const cid = String(c.customer_id || '')
      if (!cid) continue
      const prev = visitByCustomer[cid] || { count: 0, last: null }
      const d = String(c.treatment_date || '').slice(0, 10)
      visitByCustomer[cid] = { count: prev.count + 1, last: !prev.last || d > prev.last ? d : prev.last }
    }

    const rows: CustomerRow[] = []
    for (const u of userList) {
      const uid = String(u.id)
      const authId = u.auth_id ? String(u.auth_id) : null
      const prof = authId ? profileMap[authId] : null
      const mergedProfile = prof ? { ...prof, last_period_date: hormoneMap[uid] ?? null } : hormoneMap[uid] ? { last_period_date: hormoneMap[uid] } : null
      rows.push({ key: `user-${uid}`, kind: 'user', id: uid, authId, name: String(u.name || '고객'), profile: mergedProfile, visitCount: visitByCustomer[uid]?.count ?? 0, lastVisit: visitByCustomer[uid]?.last ?? null })
    }

    setCustomers(rows)
    setVisitCustomers((externals as any[]) || [])
    setKpi({
      today: chartList.filter((x) => String(x.treatment_date || '').slice(0, 10) === todayKey).length,
      month: chartList.filter((x) => String(x.treatment_date || '').slice(0, 7) === monthKey).length,
      unsigned: chartList.filter((x) => !x.customer_signed_at).length,
      totalCustomers: customerIds.length,
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    const run = async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      const user = auth.user
      if (!user) {
        router.push('/login?role=owner')
        return
      }
      const { data: me } = await sb.from('users').select('id,auth_id').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) return
      setOwner(me as any)
      await refreshData(String(me.id))
    }
    void run()
  }, [router, refreshData])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const visitSkin = (row: any) => {
    const m = parseMemo(row.memo)
    const st = m.skin_type
    if (Array.isArray(st)) return st.join(', ') || '—'
    return st ? String(st) : '—'
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 1024, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, padding: '14px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 20, minWidth: 44, minHeight: 44, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>시술 차트 V2</div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            ['오늘 차트', kpi.today],
            ['이번 달', kpi.month],
            ['미서명', kpi.unsigned],
            ['담당 고객', kpi.totalCustomers],
          ].map(([label, val]) => (
            <div key={String(label)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: SUB }}>{label}</div>
              <div style={{ fontSize: 20, marginTop: 6, fontWeight: 500, color: POINT }}>{Number(val).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
            {[
              ['oraen', '오렌 예약 고객'],
              ['visit', '내방 고객'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as 'oraen' | 'visit')}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: activeTab === key ? POINT : SUB,
                  borderBottom: activeTab === key ? `2px solid ${POINT}` : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>고객 목록</span>
            {activeTab === 'visit' ? (
              <button type="button" onClick={() => setShowCustomerPopup(true)} style={{ ...btnStyle(false), minHeight: 44, fontSize: 12 }}>
                + 고객 추가
              </button>
            ) : null}
          </div>

          {loading ? (
            <div style={{ padding: 20, fontSize: 13, color: SUB }}>불러오는 중…</div>
          ) : activeTab === 'oraen' ? (
            customers.length === 0 ? (
              <div style={{ padding: 32, fontSize: 13, color: SUB, textAlign: 'center', lineHeight: 1.7 }}>
                아직 등록된 고객이 없어요.
                <br />
                내방 고객 탭에서 + 고객 추가 버튼으로 첫 고객을 등록해보세요 💜
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: SUB, textAlign: 'left' }}>
                      {['고객명', '호르몬위상', '피부타입', '방문횟수', '마지막방문'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => {
                      const phase = getPhaseFromCycleStart(cycleStartFromProfile(c.profile))
                      const skin = c.profile?.skin_type ? String(c.profile.skin_type) : '—'
                      return (
                        <tr key={c.key} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: '12px' }}>{c.name}</td>
                          <td style={{ padding: '12px' }}>
                            <PhaseBadge phase={phase} />
                          </td>
                          <td style={{ padding: '12px' }}>{skin}</td>
                          <td style={{ padding: '12px' }}>{c.visitCount}회</td>
                          <td style={{ padding: '12px', color: SUB }}>{c.lastVisit || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : visitCustomers.length === 0 ? (
            <div style={{ padding: 32, fontSize: 13, color: SUB, textAlign: 'center', lineHeight: 1.7 }}>
              아직 등록된 고객이 없어요.
              <br />
              + 고객 추가 버튼으로 첫 고객을 등록해보세요 💜
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: SUB, textAlign: 'left' }}>
                    {['고객명', '연락처', '피부타입', '방문횟수', '마지막방문', '상태', '액션'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitCustomers.map((c) => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '12px' }}>{c.name}</td>
                      <td style={{ padding: '12px', color: SUB }}>{c.phone || '—'}</td>
                      <td style={{ padding: '12px' }}>{visitSkin(c)}</td>
                      <td style={{ padding: '12px' }}>{Number(c.visit_count || 0)}회</td>
                      <td style={{ padding: '12px', color: SUB }}>{c.last_purchase_at ? String(c.last_purchase_at).slice(0, 10) : '—'}</td>
                      <td style={{ padding: '12px' }}>{visitStatusBadge(c)}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPickedCustomer(c)
                              setShowChartPopup(true)
                            }}
                            style={{ ...btnStyle(false), background: POINT, color: '#fff', border: 'none', minHeight: 44 }}
                          >
                            차트 작성
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPickedCustomer(c)
                              setShowInvitePopup(true)
                            }}
                            style={{ ...btnStyle(false), minHeight: 44 }}
                          >
                            앱 초대
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {owner?.id ? (
        <CustomerPopup
          open={showCustomerPopup}
          onClose={() => setShowCustomerPopup(false)}
          onSaved={(c) => {
            setVisitCustomers((prev) => [c, ...prev])
            setShowCustomerPopup(false)
          }}
          ownerId={owner.id}
        />
      ) : null}

      {owner?.id && pickedCustomer ? (
        <ChartPopup
          open={showChartPopup}
          onClose={() => setShowChartPopup(false)}
          onSaved={() => {
            setShowChartPopup(false)
            if (owner?.id) void refreshData(owner.id)
          }}
          customer={pickedCustomer}
          ownerId={owner.id}
        />
      ) : null}

      <InvitePopup open={showInvitePopup} onClose={() => setShowInvitePopup(false)} customer={pickedCustomer} />

      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: POINT, color: '#fff', borderRadius: 12, padding: '12px 18px', fontSize: 13, fontWeight: 500, zIndex: 200 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
