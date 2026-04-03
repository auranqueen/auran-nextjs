'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

const ACC = '#7B5EA7'

type UInfo = { email: string; auth_id: string }

type BRow = {
  id: string
  name: string
  brand_name_kr?: string | null
  origin_country?: string | null
  origin?: string | null
  manager_name?: string | null
  manager_phone?: string | null
  contact?: string | null
  product_categories?: string[] | null
  settlement_cycle?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  promo_condition?: string | null
  applied_at?: string | null
  created_at?: string | null
  biz_doc_url?: string | null
  apply_status?: string | null
  approved_at?: string | null
  reject_reason?: string | null
  user_id?: string | null
  status?: string | null
}

type TabKey = 'pending' | 'approved' | 'rejected' | 'all'

function normApply(v: unknown) {
  if (v == null || v === '') return ''
  return String(v).toLowerCase().trim()
}

function contactEmail(contact: string | null | undefined) {
  if (!contact) return ''
  const line = contact.split('\n')[0]?.trim() || ''
  if (line.includes('@')) return line
  return ''
}

export default function AdminBrandsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<BRow[]>([])
  const [userById, setUserById] = useState<Record<string, UInfo>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('pending')
  const [toast, setToast] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectFor, setRejectFor] = useState<{ id: string; name: string } | null>(null)
  const [rejectText, setRejectText] = useState('')
  const [connectFor, setConnectFor] = useState<{ brand: BRow; authId: string } | null>(null)
  const [connectProducts, setConnectProducts] = useState<{ id: string; name: string; brand_user_id: string | null }[]>([])
  const [connectSel, setConnectSel] = useState<Set<string>>(new Set())
  const [connectBusy, setConnectBusy] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: bs, error } = await supabase
      .from('brands')
      .select(
        'id,name,brand_name_kr,origin_country,origin,manager_name,manager_phone,contact,product_categories,settlement_cycle,price_range_min,price_range_max,promo_condition,applied_at,created_at,biz_doc_url,apply_status,approved_at,reject_reason,user_id,status'
      )
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      showToast('불러오기 실패: ' + error.message)
      setRows([])
      setUserById({})
      setLoading(false)
      return
    }

    const list = (bs || []) as BRow[]
    setRows(list)

    const uids = Array.from(new Set(list.map(b => b.user_id).filter(Boolean) as string[]))
    if (uids.length === 0) {
      setUserById({})
      setLoading(false)
      return
    }

    const { data: us } = await supabase.from('users').select('id,email,auth_id').in('id', uids)
    const m: Record<string, UInfo> = {}
    for (const u of us || []) {
      const r = u as { id: string; email?: string | null; auth_id?: string | null }
      if (r.id && r.auth_id) m[r.id] = { email: String(r.email || ''), auth_id: String(r.auth_id) }
    }
    setUserById(m)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    for (const r of rows) {
      const s = normApply(r.apply_status)
      if (s === 'pending') pending += 1
      else if (s === 'approved') approved += 1
      else if (s === 'rejected') rejected += 1
    }
    return { pending, approved, rejected, all: rows.length }
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const s = normApply(r.apply_status)
      if (tab === 'pending') return s === 'pending'
      if (tab === 'approved') return s === 'approved'
      if (tab === 'rejected') return s === 'rejected'
      return true
    })
  }, [rows, tab])

  const approve = async (b: BRow) => {
    setBusyId(b.id)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('brands')
      .update({ apply_status: 'approved', approved_at: now, status: 'active' } as any)
      .eq('id', b.id)
    if (error) {
      showToast('승인 저장 실패: ' + error.message)
      setBusyId(null)
      return
    }

    let emailSent = false
    try {
      const res = await fetch('/api/brand-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: b.id }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j?.ok && j?.emailSent) emailSent = true
    } catch {
      /* ignore */
    }

    showToast(emailSent ? '승인 완료 · 이메일 발송됨' : '승인 완료')
    setBusyId(null)
    await load()
  }

  const submitReject = async () => {
    if (!rejectFor) return
    const reason = rejectText.trim()
    if (!reason) {
      showToast('거절 사유를 입력해 주세요')
      return
    }
    setBusyId(rejectFor.id)
    const { error } = await supabase
      .from('brands')
      .update({ apply_status: 'rejected', reject_reason: reason } as any)
      .eq('id', rejectFor.id)
    setBusyId(null)
    if (error) {
      showToast('거절 처리 실패: ' + error.message)
      return
    }
    showToast('거절 처리됨')
    setRejectFor(null)
    setRejectText('')
    await load()
  }

  const openConnect = async (b: BRow) => {
    const uid = b.user_id || ''
    const authId = uid ? userById[uid]?.auth_id || '' : ''
    if (!authId) {
      showToast('브랜드 계정(auth)을 찾을 수 없습니다')
      return
    }
    setConnectFor({ brand: b, authId })
    const { data: pr, error } = await supabase
      .from('products')
      .select('id,name,brand_user_id')
      .eq('brand_id', b.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) {
      showToast('제품 목록 실패: ' + error.message)
      setConnectFor(null)
      return
    }
    const plist = (pr || []) as { id: string; name: string; brand_user_id: string | null }[]
    setConnectProducts(plist)
    setConnectSel(new Set(plist.map(p => p.id)))
    setConnectBusy(false)
  }

  const applyConnect = async () => {
    if (!connectFor) return
    const ids = Array.from(connectSel)
    if (ids.length === 0) {
      showToast('연결할 제품을 선택해 주세요')
      return
    }
    setConnectBusy(true)
    const { error } = await supabase
      .from('products')
      .update({ brand_user_id: connectFor.authId } as any)
      .in('id', ids)
    setConnectBusy(false)
    if (error) {
      showToast('연결 실패: ' + error.message)
      return
    }
    showToast(`브랜드 연결 완료 (${ids.length}건)`)
    setConnectFor(null)
    setConnectProducts([])
    setConnectSel(new Set())
  }

  const tabBtn = (k: TabKey, label: string, n: number) => {
    const on = tab === k
    return (
      <button
        type="button"
        onClick={() => setTab(k)}
        style={{
          padding: '9px 14px',
          fontSize: 11,
          borderRadius: 8,
          border: on ? `1px solid ${ACC}` : '1px solid var(--border)',
          background: on ? 'rgba(123,94,167,0.12)' : 'var(--bg3)',
          color: on ? ACC : 'var(--text2)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {label} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text3)' }}>{n}</span>
      </button>
    )
  }

  const statusBadge = (s: string) => {
    const low = normApply(s) || '—'
    let bg = 'rgba(255,255,255,0.06)'
    let bd = 'var(--border)'
    let c = 'var(--text3)'
    if (low === 'pending') {
      bg = 'rgba(234,179,8,0.12)'
      bd = 'rgba(234,179,8,0.35)'
      c = '#eab308'
    } else if (low === 'approved') {
      bg = 'rgba(123,94,167,0.14)'
      bd = 'rgba(123,94,167,0.45)'
      c = ACC
    } else if (low === 'rejected') {
      bg = 'rgba(217,79,79,0.1)'
      bd = 'rgba(217,79,79,0.35)'
      c = '#d94f4f'
    }
    return (
      <span
        style={{
          fontSize: 10,
          padding: '3px 9px',
          borderRadius: 14,
          background: bg,
          border: `1px solid ${bd}`,
          color: c,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {low}
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {toast ? (
        <div className="alert alert-ok" style={{ position: 'fixed', top: 72, right: 18, zIndex: 80, maxWidth: 360, marginBottom: 0 }}>
          {toast}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title" style={{ fontWeight: 400, fontSize: 14, color: ACC }}>
              브랜드 입점 신청
            </div>
            <div className="card-sub">apply_status 기준으로 검토 · 승인 시 이메일 발송(API 설정 시)</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tabBtn('pending', '신청 대기', counts.pending)}
          {tabBtn('approved', '승인됨', counts.approved)}
          {tabBtn('rejected', '거절됨', counts.rejected)}
          {tabBtn('all', '전체', counts.all)}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 18, color: 'var(--text3)', fontSize: 12 }}>
          로딩 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 18, color: 'var(--text3)', fontSize: 12 }}>
          해당 탭에 표시할 브랜드가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(b => {
            const uid = b.user_id || ''
            const u = uid ? userById[uid] : undefined
            const mgrEmail = contactEmail(b.contact) || u?.email || '—'
            const origin = String(b.origin_country || b.origin || '—')
            const cats = Array.isArray(b.product_categories) ? b.product_categories.join(', ') : '—'
            const prMin = b.price_range_min != null ? b.price_range_min : '—'
            const prMax = b.price_range_max != null ? b.price_range_max : '—'
            const applied =
              b.applied_at != null
                ? new Date(String(b.applied_at)).toLocaleString('ko-KR')
                : b.created_at != null
                  ? new Date(String(b.created_at)).toLocaleString('ko-KR')
                  : '—'
            const applyLabel = normApply(b.apply_status) || '(미지정)'

            return (
              <div key={b.id} className="card" style={{ marginBottom: 0 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                      {b.name}
                      {b.brand_name_kr ? <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{b.brand_name_kr}</span> : null}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text2)', lineHeight: 1.55 }}>
                      <div>원산지: {origin}</div>
                      <div>
                        담당: {b.manager_name || '—'} · {mgrEmail} · {b.manager_phone || '—'}
                      </div>
                      <div>주요 취급 제품군: {cats}</div>
                      <div>정산주기: {b.settlement_cycle || '—'}</div>
                      <div>
                        납품단가 범위: {prMin} ~ {prMax}
                      </div>
                      <div>추가증정 조건: {b.promo_condition?.trim() ? b.promo_condition : '—'}</div>
                      <div style={{ color: 'var(--text3)', marginTop: 4 }}>신청일: {applied}</div>
                      {b.biz_doc_url ? (
                        <div style={{ marginTop: 6 }}>
                          <a href={b.biz_doc_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: ACC }}>
                            사업자등록증 보기
                          </a>
                        </div>
                      ) : null}
                      {tab === 'approved' && b.approved_at ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                          승인일: {new Date(String(b.approved_at)).toLocaleString('ko-KR')}
                        </div>
                      ) : null}
                      {tab === 'rejected' && b.reject_reason ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#d94f4f' }}>사유: {b.reject_reason}</div>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    {statusBadge(applyLabel)}
                    {tab === 'pending' && normApply(b.apply_status) === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => void approve(b)}
                          style={{
                            fontSize: 11,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${ACC}`,
                            background: 'rgba(123,94,167,0.2)',
                            color: '#e7ddf7',
                            cursor: busyId === b.id ? 'wait' : 'pointer',
                          }}
                        >
                          {busyId === b.id ? '처리 중...' : '승인'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => {
                            setRejectFor({ id: b.id, name: b.name })
                            setRejectText('')
                          }}
                          style={{
                            fontSize: 11,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(217,79,79,0.45)',
                            background: 'rgba(217,79,79,0.12)',
                            color: '#f0a0a0',
                            cursor: 'pointer',
                          }}
                        >
                          거절
                        </button>
                      </div>
                    ) : null}
                    {tab === 'approved' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                        <a
                          href="https://auran.kr/dashboard/brand"
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 11,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid ${ACC}`,
                            color: ACC,
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                        >
                          대시보드 바로가기
                        </a>
                        <button
                          type="button"
                          onClick={() => void openConnect(b)}
                          style={{
                            fontSize: 11,
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: `1px solid rgba(123,94,167,0.35)`,
                            background: 'transparent',
                            color: ACC,
                            cursor: 'pointer',
                          }}
                        >
                          브랜드 연결
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {rejectFor ? (
        <div
          onClick={() => !busyId && setRejectFor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: 420, marginBottom: 0, background: 'var(--bg2)' }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }}>
              거절 사유 · {rejectFor.name}
            </div>
            <div style={{ padding: 14 }}>
              <textarea
                value={rejectText}
                onChange={e => setRejectText(e.target.value)}
                rows={4}
                placeholder="거절 사유를 입력하세요"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 9,
                  color: 'var(--text)',
                  fontSize: 12,
                  padding: 10,
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-gy" style={{ flex: 1 }} onClick={() => !busyId && setRejectFor(null)}>
                  취소
                </button>
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() => void submitReject()}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(217,79,79,0.45)',
                    background: 'rgba(217,79,79,0.15)',
                    color: '#f0a0a0',
                    cursor: busyId ? 'wait' : 'pointer',
                  }}
                >
                  거절 확정
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {connectFor ? (
        <div
          onClick={() => !connectBusy && setConnectFor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 210,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: 480, marginBottom: 0, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, color: ACC }}>
              브랜드 연결 · {connectFor.brand.name}
            </div>
            <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text3)' }}>
              선택한 어드민 제품에 brand_user_id를 브랜드 계정 auth_id로 설정합니다.
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 12px 12px' }}>
              {connectProducts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: 12 }}>이 브랜드 ID로 등록된 제품이 없습니다.</div>
              ) : (
                connectProducts.map(p => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 6px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: 11,
                      color: 'var(--text2)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={connectSel.has(p.id)}
                      onChange={() => {
                        setConnectSel(prev => {
                          const n = new Set(prev)
                          if (n.has(p.id)) n.delete(p.id)
                          else n.add(p.id)
                          return n
                        })
                      }}
                    />
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {p.brand_user_id ? '연결됨' : '미연결'}
                    </span>
                  </label>
                ))
              )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-gy" style={{ flex: 1 }} onClick={() => !connectBusy && setConnectFor(null)}>
                닫기
              </button>
              <button
                type="button"
                disabled={connectBusy || connectProducts.length === 0}
                onClick={() => void applyConnect()}
                style={{
                  flex: 1,
                  fontSize: 11,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${ACC}`,
                  background: 'rgba(123,94,167,0.22)',
                  color: '#e7ddf7',
                  cursor: connectBusy ? 'wait' : 'pointer',
                }}
              >
                {connectBusy ? '적용 중...' : '선택 항목 연결'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
