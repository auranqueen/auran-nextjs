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
  description?: string | null
  manager_name?: string | null
  manager_title?: string | null
  manager_phone?: string | null
  contact?: string | null
  address?: string | null
  biz_no?: string | null
  ceo_name?: string | null
  bank_name?: string | null
  bank_account?: string | null
  bank_holder?: string | null
  extra_request?: string | null
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
  default_earn_points?: number | null
}

type DetailForm = {
  name: string
  brand_name_kr: string
  origin: string
  description: string
  manager_name: string
  manager_title: string
  mgrEmail: string
  mgrPhone: string
  address: string
  biz_no: string
  corpName: string
  ceo_name: string
  bank_name: string
  bank_account: string
  bank_holder: string
  settlement_cycle: string
  price_min: string
  price_max: string
  promo_condition: string
  apply_status: string
  reject_reason: string
  extra_request: string
}

type ProductRow = {
  id: string
  name: string
  retail_price?: number | null
  thumb_img?: string | null
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
  const [detailBrand, setDetailBrand] = useState<BRow | null>(null)
  const [detailTab, setDetailTab] = useState<'info' | 'products'>('info')
  const [detailForm, setDetailForm] = useState<DetailForm | null>(null)
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailProducts, setDetailProducts] = useState<ProductRow[]>([])
  const [detailProductsLoading, setDetailProductsLoading] = useState(false)
  const [productBusyId, setProductBusyId] = useState<string | null>(null)
  const [brandEarnEditId, setBrandEarnEditId] = useState<string | null>(null)
  const [brandEarnDraft, setBrandEarnDraft] = useState('')
  const [brandEarnBusyId, setBrandEarnBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [productCountByBrand, setProductCountByBrand] = useState<Record<string, number>>({})

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: bs, error } = await supabase
      .from('brands')
      .select(
        'id,name,brand_name_kr,origin_country,origin,description,manager_name,manager_title,manager_phone,contact,address,biz_no,ceo_name,bank_name,bank_account,bank_holder,extra_request,product_categories,settlement_cycle,price_range_min,price_range_max,promo_condition,applied_at,created_at,biz_doc_url,apply_status,approved_at,reject_reason,user_id,status,default_earn_points'
      )
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      showToast('불러오기 실패: ' + error.message)
      setRows([])
      setUserById({})
      setProductCountByBrand({})
      setLoading(false)
      return
    }

    const list = (bs || []) as BRow[]
    setRows(list)

    const bids = list.map(b => b.id)
    const pcm: Record<string, number> = {}
    if (bids.length > 0) {
      const { data: prows } = await supabase.from('products').select('brand_id').in('brand_id', bids)
      for (const p of prows || []) {
        const bid = String((p as { brand_id?: string | null }).brand_id || '')
        if (bid) pcm[bid] = (pcm[bid] || 0) + 1
      }
    }
    setProductCountByBrand(pcm)

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
  }, [])

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
    const q = searchQuery.trim().toLowerCase()
    return rows.filter(r => {
      const s = normApply(r.apply_status)
      if (tab === 'pending') {
        if (s !== 'pending') return false
      } else if (tab === 'approved') {
        if (s !== 'approved') return false
      } else if (tab === 'rejected') {
        if (s !== 'rejected') return false
      }
      if (q) {
        const n = (r.name || '').toLowerCase()
        const kr = (r.brand_name_kr || '').toLowerCase()
        if (!n.includes(q) && !kr.includes(q)) return false
      }
      return true
    })
  }, [rows, tab, searchQuery])

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

  const openDetail = (b: BRow) => {
    const ex = String(b.extra_request || '')
    let corpName = ''
    const cm = ex.match(/상호\(법인명\):\s*([^\n]*)/)
    if (cm) corpName = cm[1].trim()
    const cLines = String(b.contact || '').split('\n')
    const uid = b.user_id || ''
    const u = uid ? userById[uid] : undefined
    setDetailForm({
      name: b.name || '',
      brand_name_kr: b.brand_name_kr || '',
      origin: String(b.origin_country || b.origin || ''),
      description: String(b.description || ''),
      manager_name: b.manager_name || '',
      manager_title: b.manager_title || '',
      mgrEmail: contactEmail(b.contact) || u?.email || '',
      mgrPhone: (cLines[1] || '').trim() || b.manager_phone || '',
      address: b.address || '',
      biz_no: b.biz_no || '',
      corpName,
      ceo_name: b.ceo_name || '',
      bank_name: b.bank_name || '',
      bank_account: b.bank_account || '',
      bank_holder: b.bank_holder || '',
      settlement_cycle: b.settlement_cycle || '',
      price_min: b.price_range_min != null ? String(b.price_range_min) : '',
      price_max: b.price_range_max != null ? String(b.price_range_max) : '',
      promo_condition: b.promo_condition || '',
      apply_status: normApply(b.apply_status) || 'pending',
      reject_reason: b.reject_reason || '',
      extra_request: ex,
    })
    setDetailBrand(b)
    setDetailTab('info')
    setDetailProducts([])
  }

  const saveBrandDetail = async () => {
    if (!detailBrand || !detailForm) return
    setDetailSaving(true)
    let extra = String(detailForm.extra_request || '')
    const corp = detailForm.corpName.trim()
    if (corp) {
      const line = `상호(법인명): ${corp}`
      extra = /상호\(법인명\):/.test(extra) ? extra.replace(/상호\(법인명\):[^\n]*/g, line) : (extra.trim() ? `${extra.trim()}\n\n${line}` : line)
    }
    const prMin = detailForm.price_min.trim() === '' ? null : Math.floor(Number(detailForm.price_min))
    const prMax = detailForm.price_max.trim() === '' ? null : Math.floor(Number(detailForm.price_max))
    const payload: Record<string, unknown> = {
      name: detailForm.name.trim(),
      brand_name_kr: detailForm.brand_name_kr.trim() || null,
      origin_country: detailForm.origin.trim() || null,
      origin: detailForm.origin.trim() || null,
      description: detailForm.description.trim() || null,
      manager_name: detailForm.manager_name.trim() || null,
      manager_title: detailForm.manager_title.trim() || null,
      manager_phone: detailForm.mgrPhone.trim() || null,
      contact: `${detailForm.mgrEmail.trim()}\n${detailForm.mgrPhone.trim()}`,
      address: detailForm.address.trim() || null,
      biz_no: detailForm.biz_no.trim() || null,
      ceo_name: detailForm.ceo_name.trim() || null,
      bank_name: detailForm.bank_name.trim() || null,
      bank_account: detailForm.bank_account.trim() || null,
      bank_holder: detailForm.bank_holder.trim() || null,
      settlement_cycle: detailForm.settlement_cycle.trim() || null,
      price_range_min: prMin != null && Number.isFinite(prMin) ? prMin : null,
      price_range_max: prMax != null && Number.isFinite(prMax) ? prMax : null,
      promo_condition: detailForm.promo_condition.trim() || null,
      apply_status: detailForm.apply_status,
      reject_reason: detailForm.apply_status === 'rejected' ? detailForm.reject_reason.trim() || null : null,
      extra_request: extra.trim() || null,
    }
    const { error } = await supabase.from('brands').update(payload as any).eq('id', detailBrand.id)
    setDetailSaving(false)
    if (error) {
      showToast('저장 실패: ' + error.message)
      return
    }
    showToast('저장됨')
    setDetailBrand(null)
    setDetailForm(null)
    await load()
  }

  useEffect(() => {
    if (!detailBrand || detailTab !== 'products') return
    const authId = userById[detailBrand.user_id || '']?.auth_id
    let cancelled = false
    ;(async () => {
      setDetailProductsLoading(true)
      if (!authId) {
        if (!cancelled) {
          setDetailProducts([])
          setDetailProductsLoading(false)
        }
        return
      }
      const { data, error } = await supabase
        .from('products')
        .select('id,name,retail_price,thumb_img,status')
        .eq('brand_user_id', authId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
      if (!cancelled) {
        if (error) {
          setDetailProducts([])
          showToast('제품 목록 실패: ' + error.message)
        } else setDetailProducts((data || []) as ProductRow[])
        setDetailProductsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailBrand, detailTab, userById])

  const approveProductRow = async (id: string) => {
    setProductBusyId(id)
    const { error } = await supabase.from('products').update({ status: 'active' } as any).eq('id', id)
    setProductBusyId(null)
    if (error) {
      showToast('승인 실패: ' + error.message)
      return
    }
    setDetailProducts(prev => prev.map(p => (p.id === id ? { ...p, status: 'active' } : p)))
    showToast('제품 승인됨')
  }

  const rejectProductRow = async (id: string) => {
    setProductBusyId(id)
    const { error } = await supabase.from('products').update({ status: 'discontinued' } as any).eq('id', id)
    setProductBusyId(null)
    if (error) {
      showToast('거절 실패: ' + error.message)
      return
    }
    setDetailProducts(prev => prev.map(p => (p.id === id ? { ...p, status: 'discontinued' } : p)))
    showToast('제품 거절 처리됨')
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
        <div style={{ padding: '12px 16px 8px' }}>
          <label style={{ fontSize: 10, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>브랜드명 검색</label>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="브랜드명 (영문/한글)"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '9px 12px',
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              boxSizing: 'border-box',
            }}
          />
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
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedId(expandedId === b.id ? null : b.id)
                    }
                  }}
                  onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  style={{
                    padding: '14px 16px',
                    borderBottom: expandedId === b.id ? '1px solid var(--border)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em', flex: 1, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {b.name}
                      {b.brand_name_kr ? <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>{b.brand_name_kr}</span> : null}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {statusBadge(applyLabel)}
                    <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>
                      제품 {productCountByBrand[b.id] ?? 0}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }} aria-hidden>
                      {expandedId === b.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>
                {expandedId === b.id ? (
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
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setBrandEarnEditId(b.id)
                          setBrandEarnDraft(String(b.default_earn_points ?? 0))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setBrandEarnEditId(b.id)
                            setBrandEarnDraft(String(b.default_earn_points ?? 0))
                          }
                        }}
                        style={{ marginTop: 6, cursor: 'pointer' }}
                      >
                        <span style={{ color: 'var(--text2)' }}>구매 토스트 적립률</span>
                        {brandEarnEditId === b.id ? (
                          <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={brandEarnDraft}
                              onChange={(e) => setBrandEarnDraft(e.target.value)}
                              style={{
                                width: 56,
                                padding: '4px 6px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--bg)',
                                color: 'var(--text)',
                                fontSize: 11,
                              }}
                            />
                            <span style={{ color: 'var(--text2)' }}>%</span>
                            <button
                              type="button"
                              disabled={brandEarnBusyId === b.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                void (async () => {
                                  const v = Math.max(0, Math.min(100, Math.floor(Number(brandEarnDraft) || 0)))
                                  setBrandEarnBusyId(b.id)
                                  const { error } = await supabase.from('brands').update({ default_earn_points: v }).eq('id', b.id)
                                  setBrandEarnBusyId(null)
                                  if (error) {
                                    showToast('저장 실패: ' + error.message)
                                    return
                                  }
                                  setRows((prev) => prev.map((r) => (r.id === b.id ? { ...r, default_earn_points: v } : r)))
                                  setBrandEarnEditId(null)
                                  showToast('저장됨')
                                })()
                              }}
                              style={{
                                fontSize: 10,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: `1px solid ${ACC}`,
                                background: 'rgba(123,94,167,0.2)',
                                color: ACC,
                                cursor: brandEarnBusyId === b.id ? 'wait' : 'pointer',
                              }}
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setBrandEarnEditId(null)
                              }}
                              style={{
                                fontSize: 10,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text2)',
                                cursor: 'pointer',
                              }}
                            >
                              취소
                            </button>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text)', marginLeft: 6 }}>{b.default_earn_points ?? 0}%</span>
                        )}
                      </div>
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
                    <button
                      type="button"
                      onClick={() => openDetail(b)}
                      style={{
                        fontSize: 11,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: `1px solid ${ACC}`,
                        background: 'rgba(123,94,167,0.12)',
                        color: ACC,
                        cursor: 'pointer',
                      }}
                    >
                      상세보기/수정
                    </button>
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
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {detailBrand && detailForm ? (
        <div
          onClick={() => !detailSaving && (setDetailBrand(null), setDetailForm(null))}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="card"
            style={{
              width: '100%',
              maxWidth: 600,
              maxHeight: '80vh',
              overflowY: 'auto',
              marginBottom: 0,
              background: 'var(--bg2)',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 14, color: ACC }}>{detailBrand.name}</div>
              <button
                type="button"
                className="btn btn-gy"
                style={{ fontSize: 11 }}
                onClick={() => !detailSaving && (setDetailBrand(null), setDetailForm(null))}
              >
                닫기
              </button>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setDetailTab('info')}
                style={{
                  fontSize: 11,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: detailTab === 'info' ? `1px solid ${ACC}` : '1px solid var(--border)',
                  background: detailTab === 'info' ? 'rgba(123,94,167,0.12)' : 'transparent',
                  color: detailTab === 'info' ? ACC : 'var(--text3)',
                  cursor: 'pointer',
                }}
              >
                브랜드 정보
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('products')}
                style={{
                  fontSize: 11,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: detailTab === 'products' ? `1px solid ${ACC}` : '1px solid var(--border)',
                  background: detailTab === 'products' ? 'rgba(123,94,167,0.12)' : 'transparent',
                  color: detailTab === 'products' ? ACC : 'var(--text3)',
                  cursor: 'pointer',
                }}
              >
                등록 제품
              </button>
            </div>

            {detailTab === 'info' ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(
                  [
                    ['브랜드명 (영문)', 'name', 'text'],
                    ['브랜드명 (한글)', 'brand_name_kr', 'text'],
                    ['원산지', 'origin', 'text'],
                    ['브랜드 소개', 'description', 'area'],
                    ['담당자명', 'manager_name', 'text'],
                    ['직책', 'manager_title', 'text'],
                    ['이메일', 'mgrEmail', 'email'],
                    ['연락처', 'mgrPhone', 'text'],
                    ['사업장 주소', 'address', 'area'],
                    ['사업자등록번호', 'biz_no', 'text'],
                    ['법인명/상호', 'corpName', 'text'],
                    ['대표자명', 'ceo_name', 'text'],
                    ['은행명', 'bank_name', 'text'],
                    ['계좌번호', 'bank_account', 'text'],
                    ['예금주', 'bank_holder', 'text'],
                    ['정산주기', 'settlement_cycle', 'text'],
                    ['납품단가 최소', 'price_min', 'text'],
                    ['납품단가 최대', 'price_max', 'text'],
                    ['추가증정 조건', 'promo_condition', 'area'],
                  ] as const
                ).map(([label, key, kind]) => (
                  <div key={key}>
                    <label style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>{label}</label>
                    {kind === 'area' ? (
                      <textarea
                        value={detailForm[key as keyof DetailForm]}
                        onChange={e => setDetailForm(f => (f ? { ...f, [key]: e.target.value } : f))}
                        rows={key === 'description' ? 4 : 3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--text)',
                          fontSize: 12,
                          padding: '8px 10px',
                          resize: 'vertical',
                        }}
                      />
                    ) : (
                      <input
                        type={kind === 'email' ? 'email' : 'text'}
                        value={detailForm[key as keyof DetailForm]}
                        onChange={e => setDetailForm(f => (f ? { ...f, [key]: e.target.value } : f))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'var(--bg3)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--text)',
                          fontSize: 12,
                          padding: '8px 10px',
                        }}
                      />
                    )}
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>apply_status</label>
                  <select
                    value={detailForm.apply_status}
                    onChange={e => setDetailForm(f => (f ? { ...f, apply_status: e.target.value } : f))}
                    style={{
                      width: '100%',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text)',
                      fontSize: 12,
                      padding: '8px 10px',
                    }}
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
                {detailForm.apply_status === 'rejected' ? (
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>거절 사유</label>
                    <textarea
                      value={detailForm.reject_reason}
                      onChange={e => setDetailForm(f => (f ? { ...f, reject_reason: e.target.value } : f))}
                      rows={3}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'var(--bg3)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--text)',
                        fontSize: 12,
                        padding: '8px 10px',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={detailSaving}
                  onClick={() => void saveBrandDetail()}
                  style={{
                    marginTop: 6,
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${ACC}`,
                    background: 'rgba(123,94,167,0.22)',
                    color: '#e7ddf7',
                    fontSize: 12,
                    cursor: detailSaving ? 'wait' : 'pointer',
                  }}
                >
                  {detailSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            ) : (
              <div style={{ padding: 14 }}>
                {detailProductsLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>제품 불러오는 중…</div>
                ) : detailProducts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {userById[detailBrand.user_id || '']?.auth_id
                      ? '등록된 제품이 없습니다.'
                      : 'brand_user_id(계정)을 찾을 수 없어 제품을 불러올 수 없습니다.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {detailProducts.map(p => {
                      const st = String(p.status || '')
                      let sc = 'var(--text3)'
                      let sb = 'rgba(255,255,255,0.08)'
                      if (st === 'active') {
                        sc = '#4cad7e'
                        sb = 'rgba(76,173,126,0.15)'
                      } else if (st === 'pending') {
                        sc = '#eab308'
                        sb = 'rgba(234,179,8,0.12)'
                      } else if (st === 'discontinued' || st === 'hidden') {
                        sc = '#d94f4f'
                        sb = 'rgba(217,79,79,0.1)'
                      }
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                            padding: 10,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'var(--bg3)',
                          }}
                        >
                          {p.thumb_img ? (
                            <img src={p.thumb_img} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>₩{Number(p.retail_price || 0).toLocaleString()}</div>
                            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 12, background: sb, color: sc, fontFamily: "'JetBrains Mono', monospace" }}>{st || '—'}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                              <button
                                type="button"
                                disabled={productBusyId === p.id}
                                onClick={() => void approveProductRow(p.id)}
                                style={{
                                  fontSize: 10,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: `1px solid ${ACC}`,
                                  background: 'rgba(123,94,167,0.15)',
                                  color: ACC,
                                  cursor: 'pointer',
                                }}
                              >
                                승인
                              </button>
                              <button
                                type="button"
                                disabled={productBusyId === p.id}
                                onClick={() => void rejectProductRow(p.id)}
                                style={{
                                  fontSize: 10,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(217,79,79,0.45)',
                                  background: 'rgba(217,79,79,0.1)',
                                  color: '#f0a0a0',
                                  cursor: 'pointer',
                                }}
                              >
                                거절
                              </button>
                              <a
                                href="/admin/marketing/products"
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: 10,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  color: 'var(--text2)',
                                  textDecoration: 'none',
                                  display: 'inline-block',
                                }}
                              >
                                수정
                              </a>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

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
