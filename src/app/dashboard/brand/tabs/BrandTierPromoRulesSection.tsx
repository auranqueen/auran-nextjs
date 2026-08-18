'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
type BrandOpt = { id: string; name: string }
type Rule = { id: string; brand_id: string; min_qty: number; bonus_qty: number; option_no?: number }
type OptionDraft = { key: string; id?: string; min: string; bonus: string }
type Props = {
  companyId: string | null
  tierPackageId: string
}
const emptyDraft = (brandId: string): OptionDraft => ({ key: `new-${brandId}`, min: '', bonus: '' })
export default function BrandTierPromoRulesSection({ companyId, tierPackageId }: Props) {
  const supabase = createClient()
  const [brands, setBrands] = useState<BrandOpt[]>([])
  const [rules, setRules] = useState<Record<string, Rule[]>>({})
  const [drafts, setDrafts] = useState<Record<string, OptionDraft[]>>({})
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data: brandRows } = await supabase.from('brands').select('id, name').eq('company_id', companyId)
      setBrands((brandRows || []) as BrandOpt[])
      const { data: ruleRows } = await supabase
        .from('brand_tier_promo_rules')
        .select('id, brand_id, min_qty, bonus_qty, option_no')
        .eq('tier_package_id', tierPackageId)
        .order('option_no', { ascending: true })
      const ruleMap: Record<string, Rule[]> = {}
      const draftMap: Record<string, OptionDraft[]> = {}
      for (const r of (ruleRows || []) as Rule[]) {
        if (!ruleMap[r.brand_id]) ruleMap[r.brand_id] = []
        ruleMap[r.brand_id].push(r)
      }
      for (const bid of Object.keys(ruleMap)) {
        ruleMap[bid].sort((a, b) => (a.option_no || 1) - (b.option_no || 1))
        draftMap[bid] = ruleMap[bid].map((r) => ({
          key: r.id,
          id: r.id,
          min: String(r.min_qty),
          bonus: String(r.bonus_qty),
        }))
      }
      for (const b of (brandRows || []) as BrandOpt[]) {
        if (!draftMap[b.id] || draftMap[b.id].length === 0) draftMap[b.id] = [emptyDraft(b.id)]
      }
      setRules(ruleMap)
      setDrafts(draftMap)
    } finally {
      setLoading(false)
    }
  }, [companyId, tierPackageId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const saveRule = async (brandId: string) => {
    if (!companyId) return
    const options = (drafts[brandId] || []).filter((o) => o.min.trim() !== '' || o.bonus.trim() !== '')
    const toSave = options.length > 0 ? options : (drafts[brandId] || [])
    if (toSave.length === 0) {
      showToast('수량을 확인해 주세요')
      return
    }
    for (const draft of toSave) {
      const minQty = Math.trunc(Number(draft.min))
      const bonusQty = Math.trunc(Number(draft.bonus))
      if (!Number.isFinite(minQty) || minQty < 1 || !Number.isFinite(bonusQty) || bonusQty < 1) {
        showToast('수량을 확인해 주세요')
        return
      }
    }
    setSavingId(brandId)
    try {
      const knownIds = (rules[brandId] || []).map((r) => r.id)
      const keptIds: string[] = []
      for (let i = 0; i < toSave.length; i++) {
        const draft = toSave[i]
        const minQty = Math.trunc(Number(draft.min))
        const bonusQty = Math.trunc(Number(draft.bonus))
        const res = await fetch('/api/brand/tier-promo-rules/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            company_id: companyId,
            tier_package_id: tierPackageId,
            brand_id: brandId,
            min_qty: minQty,
            bonus_qty: bonusQty,
            option_no: i + 1,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!json?.ok) {
          showToast('저장 실패')
          return
        }
        const savedId = json?.rule?.id ? String(json.rule.id) : ''
        if (savedId) keptIds.push(savedId)
      }
      for (const id of knownIds) {
        if (keptIds.includes(id)) continue
        const delRes = await fetch('/api/brand/tier-promo-rules/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ company_id: companyId, id }),
        })
        const delJson = await delRes.json().catch(() => ({}))
        if (!delJson?.ok) {
          showToast('저장 실패')
          return
        }
      }
      showToast('저장됐어요')
      await load()
    } finally {
      setSavingId(null)
    }
  }
  const addOption = (brandId: string) => {
    setDrafts((prev) => {
      const list = prev[brandId] && prev[brandId].length > 0 ? prev[brandId] : [emptyDraft(brandId)]
      return { ...prev, [brandId]: [...list, { key: `new-${brandId}-${Date.now()}`, min: '', bonus: '' }] }
    })
  }
  const removeOption = async (brandId: string, key: string) => {
    if (!companyId) return
    const list = drafts[brandId] || []
    if (list.length <= 1) {
      showToast('최소 1개 옵션은 남겨 주세요')
      return
    }
    const target = list.find((o) => o.key === key)
    if (!target) return
    if (target.id) {
      const res = await fetch('/api/brand/tier-promo-rules/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, id: target.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('삭제 실패')
        return
      }
      setRules((prev) => ({ ...prev, [brandId]: (prev[brandId] || []).filter((r) => r.id !== target.id) }))
      showToast('삭제했어요')
    }
    setDrafts((prev) => ({ ...prev, [brandId]: (prev[brandId] || []).filter((o) => o.key !== key) }))
  }
  if (loading) {
    return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>불러오는 중…</div>
  }
  if (brands.length === 0) {
    return null
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
        재구매 상시 프로모션 (브랜드별 "N개 이상 담으면 M개 보너스" — 이 등급 보유 원장의 재고발주 발송처리시 자동 적용)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {brands.map((b) => {
          const options = drafts[b.id] && drafts[b.id].length > 0 ? drafts[b.id] : [emptyDraft(b.id)]
          const hasRule = (rules[b.id] || []).length > 0
          return (
            <div key={b.id} style={{ padding: '8px 10px', borderRadius: 8, background: hasRule ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 12, color: '#fff', marginBottom: 6 }}>{b.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map((draft) => (
                  <div key={draft.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="N개"
                      value={draft.min}
                      onChange={(e) => {
                        const min = e.target.value.replace(/[^\d]/g, '')
                        setDrafts((prev) => ({
                          ...prev,
                          [b.id]: (prev[b.id] || options).map((o) => (o.key === draft.key ? { ...o, min } : o)),
                        }))
                      }}
                      style={{ width: 50, padding: '5px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>이상 →</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="M개"
                      value={draft.bonus}
                      onChange={(e) => {
                        const bonus = e.target.value.replace(/[^\d]/g, '')
                        setDrafts((prev) => ({
                          ...prev,
                          [b.id]: (prev[b.id] || options).map((o) => (o.key === draft.key ? { ...o, bonus } : o)),
                        }))
                      }}
                      style={{ width: 50, padding: '5px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
                    />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>보너스</span>
                    <button
                      type="button"
                      onClick={() => void removeOption(b.id, draft.key)}
                      style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: options.length <= 1 ? 'rgba(255,255,255,0.25)' : '#e88', fontSize: 11, cursor: options.length <= 1 ? 'default' : 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => addOption(b.id)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${PURPLE}`, background: 'transparent', color: '#c4a8f0', fontSize: 11, cursor: 'pointer' }}
                >
                  옵션 추가
                </button>
                <button type="button" disabled={savingId === b.id} onClick={() => void saveRule(b.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}>저장</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
