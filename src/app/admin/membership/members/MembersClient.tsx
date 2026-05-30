'use client'

import { useState } from 'react'

const C = {
  purple: '#7B5EA7', purpleSoft: '#F1ECF8', goldDark: '#A07F4A', goldSoft: '#F6EFE3',
  plum: '#2A2433', ink: '#4A4256', muted: '#8A7E92', faint: '#A89CB5',
  line: 'rgba(123,94,167,0.15)', green: '#5B8A6B', greenSoft: '#EAF3EC',
}
const SERIF = "'Cormorant Garamond', Georgia, serif"

type Membership = {
  id: string; user_id: string; status: string; shipments_total: number; shipments_remaining: number
  next_shipment_date: string | null; users: { name: string } | null; membership_plans: { name: string } | null
}
type Tpl = { id: string; theme_name: string; target_phase: string | null }
type Scored = { id: string; name: string; retail_price: number | null; _score: number; _reasons: string[] }

export default function MembersClient({ memberships: initial, templates }: { memberships: Membership[]; templates: Tpl[] }) {
  const [memberships, setMemberships] = useState<Membership[]>(initial)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tplId, setTplId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ theme: string; phase: string | null; products: Scored[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const open = (id: string) => { setOpenId(openId === id ? null : id); setTplId(null); setPreview(null); setMsg(null) }

  const call = async (mId: string, action: 'preview' | 'ship') => {
    if (!tplId) { setMsg('리추얼을 먼저 선택하세요'); return }
    if (action === 'ship' && !confirm('이 리추얼을 발송 처리할까요?')) return
    setBusy(true); setMsg(null)
    const res = await fetch('/api/admin/membership/curate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_membership_id: mId, bundle_template_id: tplId, action }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!json.ok) { setMsg(json.error || '실패했어요'); return }
    if (action === 'preview') {
      setPreview({ theme: json.theme, phase: json.phase, products: json.products })
    } else {
      setMemberships((ms) => ms.map((m) => (m.id === mId ? { ...m, shipments_remaining: json.remaining, status: json.remaining > 0 ? 'active' : 'expired' } : m)))
      setMsg(`${json.cycle_no}회차 발송 완료 · 남은 ${json.remaining}회`)
      setPreview(null)
    }
  }

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, cursor: 'pointer', color: active ? '#fff' : C.muted, background: active ? C.purple : '#fff',
    border: active ? 'none' : `0.5px solid rgba(123,94,167,0.22)`, borderRadius: 17, padding: '6px 13px', fontFamily: 'inherit',
  })

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '22px 16px 48px', fontFamily: "'Helvetica Neue', Arial, sans-serif", color: C.plum }}>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: C.ink, marginBottom: 18 }}>멤버 · 큐레이션</div>
      {memberships.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>아직 멤버가 없어요.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {memberships.map((m) => {
          const opened = openId === m.id
          return (
            <div key={m.id} style={{ background: '#fff', border: `0.5px solid ${opened ? C.purple : C.line}`, borderRadius: 12, padding: 15 }}>
              <div onClick={() => open(m.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span style={{ fontSize: 15, color: C.plum }}>{m.users?.name || '회원'}</span>
                  <span style={{ fontSize: 11, color: C.goldDark, background: C.goldSoft, borderRadius: 5, padding: '2px 8px' }}>{m.membership_plans?.name || '멤버'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{m.shipments_total - m.shipments_remaining}/{m.shipments_total}회</span>
                  <span style={{ fontSize: 11, color: m.status === 'active' ? C.green : C.faint, background: m.status === 'active' ? C.greenSoft : 'transparent', borderRadius: 5, padding: '2px 7px' }}>
                    {m.status === 'active' ? '활성' : m.status === 'gifted_pending' ? '선물대기' : m.status === 'expired' ? '소진' : m.status}
                  </span>
                </div>
              </div>
              {opened && (
                <div style={{ marginTop: 14, borderTop: `0.5px solid ${C.line}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                    남은 {m.shipments_remaining}회 · {m.next_shipment_date ? `다음 ${m.next_shipment_date}` : '예정일 없음'}
                  </div>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 7 }}>이번 회차 리추얼 선택</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
                    {templates.map((t) => (
                      <button key={t.id} onClick={() => { setTplId(t.id); setPreview(null) }} style={pill(tplId === t.id)}>{t.theme_name}</button>
                    ))}
                  </div>
                  {preview && (
                    <div style={{ background: C.purpleSoft, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: C.purple, marginBottom: 10 }}>{preview.theme}{preview.phase ? ` · ${preview.phase}` : ''} · 자동 큐레이션</div>
                      {preview.products.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>이 리추얼에 제품이 없어요. 템플릿에 제품을 먼저 채우세요.</div>}
                      {preview.products.map((p) => (
                        <div key={p.id} style={{ paddingBottom: 9, marginBottom: 9, borderBottom: `0.5px solid rgba(123,94,167,0.1)` }}>
                          <div style={{ fontSize: 13, color: C.plum }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                            {p._reasons.map((r, i) => (<span key={i} style={{ fontSize: 11, color: C.purple, background: '#fff', borderRadius: 5, padding: '2px 7px' }}>{r}</span>))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>{msg}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => call(m.id, 'preview')} disabled={busy} style={{ flex: 1, background: 'transparent', border: `0.5px solid rgba(123,94,167,0.3)`, color: C.muted, borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>{busy ? '...' : '미리보기'}</button>
                    <button onClick={() => call(m.id, 'ship')} disabled={busy || m.shipments_remaining <= 0} style={{ flex: 1, background: m.shipments_remaining <= 0 ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', cursor: m.shipments_remaining <= 0 ? 'default' : 'pointer' }}>발송 처리</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
