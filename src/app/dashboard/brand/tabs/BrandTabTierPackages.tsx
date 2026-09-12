'use client'
import { useCallback, useEffect, useState } from 'react'
import BrandTierOrderApprovalSection from './BrandTierOrderApprovalSection'
import BrandTierPromoRulesSection from './BrandTierPromoRulesSection'
import BrandGradePointRatesCard from '../components/BrandGradePointRatesCard'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const KIT_TYPES = ['부자재', '인증패', '진열장', '기타'] as const
const SUBTABS = [
  { key: 'price', label: '등급·가격' },
  { key: 'orders', label: '등급구매 승인' },
] as const
type SubTab = typeof SUBTABS[number]['key']
type TierPackage = {
  id: string
  tier_name: string
  price: number
  is_active: boolean | null
}
type Draft = {
  tier_name: string
  price: string
}
type KitItem = {
  id: string
  tier_package_id: string
  item_name: string
  item_type: string
  qty: number
  note: string | null
}
type KitDraft = {
  item_name: string
  item_type: string
  qty: string
  note: string
}
const EMPTY_KIT_DRAFT: KitDraft = { item_name: '', item_type: '부자재', qty: '1', note: '' }
type Props = {
  myBrands: { id: string; name: string }[]
  staffId: string | null
  isCEO: boolean
}
export default function BrandTabTierPackages({ myBrands, staffId, isCEO }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const supabase = createClient()
  const [sub, setSub] = useState<SubTab>('price')
  const [rows, setRows] = useState<TierPackage[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [kitItemsByPkg, setKitItemsByPkg] = useState<Record<string, KitItem[]>>({})
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [kitDraft, setKitDraft] = useState<KitDraft>(EMPTY_KIT_DRAFT)
  const [editingKitId, setEditingKitId] = useState<string | null>(null)
  const [editKitDraft, setEditKitDraft] = useState<KitDraft>(EMPTY_KIT_DRAFT)
  const [kitSaving, setKitSaving] = useState(false)
  const [showAddPkg, setShowAddPkg] = useState(false)
  const [addPkgName, setAddPkgName] = useState('')
  const [addPkgPrice, setAddPkgPrice] = useState('')
  const [addPkgSaving, setAddPkgSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }
  useEffect(() => {
    const anchorBrandId = myBrands[0]?.id
    if (!anchorBrandId) {
      setCompanyId(null)
      setCompanyName('')
      return
    }
    let cancelled = false
    ;(async () => {
      const { data: brandRow } = await supabase
        .from('brands')
        .select('company_id')
        .eq('id', anchorBrandId)
        .maybeSingle()
      const cid = brandRow?.company_id ? String(brandRow.company_id) : null
      if (cancelled) return
      if (!cid) {
        setCompanyId(null)
        setCompanyName('')
        return
      }
      const { data: companyRow } = await supabase
        .from('brand_companies')
        .select('id, name')
        .eq('id', cid)
        .maybeSingle()
      if (cancelled) return
      setCompanyId(cid)
      setCompanyName(String(companyRow?.name || ''))
    })()
    return () => {
      cancelled = true
    }
  }, [myBrands])
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('brand_tier_packages')
        .select('id, tier_name, price, is_active')
        .eq('company_id', companyId)
        .order('price', { ascending: true })
      if (error) {
        showToast('등급 패키지를 불러오지 못했어요')
        return
      }
      const list = (data || []) as TierPackage[]
      setRows(list)
      const next: Record<string, Draft> = {}
      for (const r of list) {
        next[r.id] = {
          tier_name: String(r.tier_name || ''),
          price: String(Math.trunc(Number(r.price) || 0)),
        }
      }
      setDrafts(next)
      const { data: kitData } = await supabase
        .from('brand_tier_kit_items')
        .select('id, tier_package_id, item_name, item_type, qty, note')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      const grouped: Record<string, KitItem[]> = {}
      for (const k of (kitData || []) as KitItem[]) {
        const pid = String(k.tier_package_id)
        if (!grouped[pid]) grouped[pid] = []
        grouped[pid].push(k)
      }
      setKitItemsByPkg(grouped)
    } finally {
      setLoading(false)
    }
  }, [companyId])
  useEffect(() => {
    void load()
  }, [load])
  const saveRow = async (pkg: TierPackage) => {
    if (!companyId) return
    const draft = drafts[pkg.id]
    if (!draft) return
    const tierName = draft.tier_name.trim()
    const price = Math.trunc(Number(draft.price.replace(/,/g, '')))
    if (!tierName) {
      showToast('등급명을 입력해 주세요')
      return
    }
    if (!Number.isFinite(price) || price < 1000) {
      showToast('가격은 1,000원 이상이어야 해요')
      return
    }
    setSavingId(pkg.id)
    try {
      const res = await fetch('/api/brand/tier-packages/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, id: pkg.id, tier_name: tierName, price }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast(json?.error === 'invalid_price' ? '가격이 올바르지 않아요' : json?.error === 'duplicate_tier_name' ? '같은 이름의 등급이 이미 있어요' : '저장에 실패했어요')
        return
      }
      showToast('저장했어요')
      await load()
    } finally {
      setSavingId(null)
    }
  }
  const createPackage = async () => {
    if (!companyId) return
    const tierName = addPkgName.trim()
    const price = Math.trunc(Number(addPkgPrice.replace(/,/g, '')))
    if (!tierName) {
      showToast('등급명을 입력해 주세요')
      return
    }
    if (!Number.isFinite(price) || price < 1000) {
      showToast('가격은 1,000원 이상이어야 해요')
      return
    }
    setAddPkgSaving(true)
    try {
      const res = await fetch('/api/brand/tier-packages/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, tier_name: tierName, price }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast(json?.error === 'invalid_price' ? '가격이 올바르지 않아요' : json?.error === 'duplicate_tier_name' ? '같은 이름의 등급이 이미 있어요' : '추가에 실패했어요')
        return
      }
      setAddPkgName('')
      setAddPkgPrice('')
      setShowAddPkg(false)
      showToast('등급을 추가했어요')
      await load()
    } finally {
      setAddPkgSaving(false)
    }
  }
  const deletePackage = async (pkg: TierPackage) => {
    if (!companyId) return
    if (!window.confirm(`"${pkg.tier_name}" 등급을 삭제할까요? 원장님에게 배정된 등급은 삭제 대신 숨김 처리돼요.`)) return
    setDeletingId(pkg.id)
    try {
      const res = await fetch('/api/brand/tier-packages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: pkg.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('삭제에 실패했어요')
        return
      }
      if (json.action === 'deactivated') {
        showToast('원장님에게 배정되어 있어 숨김 처리했어요')
      } else {
        showToast('삭제했어요')
      }
      await load()
    } finally {
      setDeletingId(null)
    }
  }
  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
    setAddingFor(null)
    setEditingKitId(null)
  }
  const startAdd = (pkgId: string) => {
    setAddingFor(pkgId)
    setKitDraft(EMPTY_KIT_DRAFT)
  }
  const submitAdd = async (pkgId: string) => {
    if (!companyId) return
    const itemName = kitDraft.item_name.trim()
    const qty = Math.trunc(Number(kitDraft.qty))
    if (!itemName) {
      showToast('구성품 이름을 입력해 주세요')
      return
    }
    if (!Number.isFinite(qty) || qty < 1) {
      showToast('수량은 1개 이상이어야 해요')
      return
    }
    setKitSaving(true)
    try {
      const res = await fetch('/api/brand/tier-kit-items/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          company_id: companyId,
          tier_package_id: pkgId,
          item_name: itemName,
          item_type: kitDraft.item_type,
          qty,
          note: kitDraft.note.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('추가 실패')
        return
      }
      showToast('구성품 추가됐어요')
      setAddingFor(null)
      await load()
    } finally {
      setKitSaving(false)
    }
  }
  const startEditKit = (item: KitItem) => {
    setEditingKitId(item.id)
    setEditKitDraft({
      item_name: item.item_name,
      item_type: item.item_type,
      qty: String(item.qty),
      note: item.note || '',
    })
  }
  const submitEditKit = async (item: KitItem) => {
    if (!companyId) return
    const itemName = editKitDraft.item_name.trim()
    const qty = Math.trunc(Number(editKitDraft.qty))
    if (!itemName || !Number.isFinite(qty) || qty < 1) {
      showToast('입력값을 확인해 주세요')
      return
    }
    setKitSaving(true)
    try {
      const res = await fetch('/api/brand/tier-kit-items/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          company_id: companyId,
          tier_package_id: item.tier_package_id,
          id: item.id,
          item_name: itemName,
          item_type: editKitDraft.item_type,
          qty,
          note: editKitDraft.note.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('수정 실패')
        return
      }
      showToast('수정됐어요')
      setEditingKitId(null)
      await load()
    } finally {
      setKitSaving(false)
    }
  }
  const deleteKit = async (item: KitItem) => {
    if (!companyId) return
    if (!window.confirm(`"${item.item_name}" 구성품을 삭제할까요?`)) return
    const res = await fetch('/api/brand/tier-kit-items/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ company_id: companyId, id: item.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) {
      showToast('삭제 실패')
      return
    }
    showToast('삭제했어요')
    await load()
  }
  const kitBadgeStyle = {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 20,
    background: 'rgba(123,94,167,0.15)',
    color: '#c4a8f0',
  } as const
  return (
    <div style={{ maxWidth: 640 }}>
      {!companyId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>불러오는 중…</div>
      ) : (
      <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          {sub === 'orders' ? '등급구매 승인 관리' : '등급 패키지 관리'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {companyName || '회사'} 전체
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto' as const, marginBottom: 16, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSub(t.key)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              fontSize: 12,
              border: 'none',
              background: 'transparent',
              color: sub === t.key ? '#c4a7e7' : SUB,
              borderBottom: sub === t.key ? `2px solid ${PURPLE}` : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {toast ? (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#c4a8f0' }}>{toast}</div>
      ) : null}
      {sub === 'price' && (
        <>
        <BrandGradePointRatesCard companyId={companyId} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowAddPkg((v) => !v)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${PURPLE}`, background: showAddPkg ? 'rgba(123,94,167,0.15)' : 'transparent', color: '#c4a8f0', fontSize: 12, cursor: 'pointer' }}
          >
            {showAddPkg ? '닫기' : '+ 등급 추가'}
          </button>
        </div>
        {showAddPkg ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 14, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ flex: '1 1 140px', minWidth: 120 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>등급명</div>
              <input
                type="text"
                value={addPkgName}
                onChange={(e) => setAddPkgName(e.target.value)}
                placeholder="등급 이름"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13 }}
              />
            </label>
            <label style={{ flex: '1 1 140px', minWidth: 120 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>가격(이상, 원)</div>
              <input
                type="text"
                inputMode="numeric"
                value={addPkgPrice}
                onChange={(e) => setAddPkgPrice(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="1000000"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </label>
            <button
              type="button"
              disabled={addPkgSaving}
              onClick={() => void createPackage()}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, fontWeight: 600, cursor: addPkgSaving ? 'not-allowed' : 'pointer', opacity: addPkgSaving ? 0.7 : 1 }}
            >
              {addPkgSaving ? '추가 중…' : '등록'}
            </button>
          </div>
        ) : null}
        {loading ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>불러오는 중…</div>
        ) : rows.length === 0 && !showAddPkg ? (
          <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>아직 등록된 등급이 없어요</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12, lineHeight: 1.6 }}>등급을 운영하려면 추가할 수 있어요. 쓰지 않아도 괜찮아요.</div>
            <button
              type="button"
              onClick={() => setShowAddPkg(true)}
              style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${PURPLE}`, background: 'transparent', color: '#c4a8f0', fontSize: 12, cursor: 'pointer' }}
            >
              + 등급 추가
            </button>
          </div>
        ) : rows.length === 0 ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map((pkg) => {
              const draft = drafts[pkg.id] || { tier_name: '', price: '0' }
              const dirty =
                draft.tier_name.trim() !== String(pkg.tier_name || '') ||
                Math.trunc(Number(draft.price.replace(/,/g, ''))) !== Math.trunc(Number(pkg.price) || 0)
              const expanded = expandedId === pkg.id
              const kitItems = kitItemsByPkg[pkg.id] || []
              return (
                <div
                  key={pkg.id}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${expanded ? PURPLE : 'rgba(255,255,255,0.08)'}`,
                    background: 'rgba(255,255,255,0.03)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(pkg.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(pkg.id) } }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '14px 16px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{pkg.tier_name}</div>
                        {pkg.is_active === false ? (
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>숨김</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        {Math.trunc(Number(pkg.price)).toLocaleString()}원 이상
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === pkg.id}
                      onClick={(e) => { e.stopPropagation(); void deletePackage(pkg) }}
                      style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', cursor: deletingId === pkg.id ? 'not-allowed' : 'pointer', fontSize: 12 }}
                    >
                      {deletingId === pkg.id ? '처리 중…' : '삭제'}
                    </button>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{expanded ? '▲' : '▼'}</span>
                  </div>
                  {expanded && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
                        <label style={{ flex: '1 1 140px', minWidth: 120 }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>등급명</div>
                          <input
                            type="text"
                            value={draft.tier_name}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [pkg.id]: { ...draft, tier_name: e.target.value } }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13 }}
                          />
                        </label>
                        <label style={{ flex: '1 1 140px', minWidth: 120 }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>가격(이상, 원)</div>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draft.price}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [pkg.id]: { ...draft, price: e.target.value.replace(/[^\d]/g, '') } }))}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={!dirty || savingId === pkg.id}
                          onClick={() => void saveRow(pkg)}
                          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: dirty ? PURPLE : 'rgba(255,255,255,0.08)', color: dirty ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, cursor: !dirty || savingId === pkg.id ? 'not-allowed' : 'pointer', opacity: savingId === pkg.id ? 0.7 : 1 }}
                        >
                          {savingId === pkg.id ? '저장 중…' : '가격 저장'}
                        </button>
                      </div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 14 }} />
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                        고정 구성품 (선택불가, 등급 구매시 자동 지급)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {kitItems.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>등록된 구성품이 없어요</div>
                        ) : (
                          kitItems.map((item) =>
                            editingKitId === item.id ? (
                              <div key={item.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                                <input
                                  type="text"
                                  value={editKitDraft.item_name}
                                  onChange={(e) => setEditKitDraft((p) => ({ ...p, item_name: e.target.value }))}
                                  style={{ flex: '1 1 120px', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                                />
                                <select
                                  value={editKitDraft.item_type}
                                  onChange={(e) => setEditKitDraft((p) => ({ ...p, item_type: e.target.value }))}
                                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                                >
                                  {KIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editKitDraft.qty}
                                  onChange={(e) => setEditKitDraft((p) => ({ ...p, qty: e.target.value.replace(/[^\d]/g, '') }))}
                                  style={{ width: 50, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                                />
                                <button type="button" disabled={kitSaving} onClick={() => void submitEditKit(item)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 12 }}>저장</button>
                                <button type="button" onClick={() => setEditingKitId(null)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>취소</button>
                              </div>
                            ) : (
                              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                <span style={kitBadgeStyle}>{item.item_type}</span>
                                <span style={{ fontSize: 13, color: '#fff', flex: 1 }}>{item.item_name}</span>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>수량 {item.qty}</span>
                                <button type="button" onClick={() => startEditKit(item)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>수정</button>
                                <button type="button" onClick={() => void deleteKit(item)} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', cursor: 'pointer', fontSize: 12 }}>삭제</button>
                              </div>
                            ),
                          )
                        )}
                      </div>
                      {addingFor === pkg.id ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                          <input
                            type="text"
                            placeholder="구성품 이름"
                            value={kitDraft.item_name}
                            onChange={(e) => setKitDraft((p) => ({ ...p, item_name: e.target.value }))}
                            style={{ flex: '1 1 120px', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                          />
                          <select
                            value={kitDraft.item_type}
                            onChange={(e) => setKitDraft((p) => ({ ...p, item_type: e.target.value }))}
                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                          >
                            {KIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="수량"
                            value={kitDraft.qty}
                            onChange={(e) => setKitDraft((p) => ({ ...p, qty: e.target.value.replace(/[^\d]/g, '') }))}
                            style={{ width: 50, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                          />
                          <button type="button" disabled={kitSaving} onClick={() => void submitAdd(pkg.id)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 12 }}>추가</button>
                          <button type="button" onClick={() => setAddingFor(null)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>취소</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startAdd(pkg.id)}
                          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${PURPLE}`, background: 'transparent', color: '#c4a8f0', fontSize: 12, cursor: 'pointer' }}
                        >
                          + 구성품 추가
                        </button>
                      )}
                      <BrandTierPromoRulesSection companyId={companyId} tierPackageId={pkg.id} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </>
      )}
      {sub === 'orders' && (
        <BrandTierOrderApprovalSection companyId={companyId} />
      )}
      </>
      )}
    </div>
  )
}
