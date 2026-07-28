'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
type BrandOpt = { id: string; name: string }
type Rule = { id: string; brand_id: string; min_qty: number; bonus_qty: number }
type Props = {
  companyId: string | null
  tierPackageId: string
}
export default function BrandTierPromoRulesSection({ companyId, tierPackageId }: Props) {
  const supabase = createClient()
  const [brands, setBrands] = useState<BrandOpt[]>([])
  const [rules, setRules] = useState<Record<string, Rule>>({})
  const [drafts, setDrafts] = useState<Record<string, { min: string; bonus: string }>>({})
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
        .select('id, brand_id, min_qty, bonus_qty')
        .eq('tier_package_id', tierPackageId)
      const ruleMap: Record<string, Rule> = {}
      const draftMap: Record<string, { min: string; bonus: string }> = {}
      for (const r of (ruleRows || []) as Rule[]) {
        ruleMap[r.brand_id] = r
        draftMap[r.brand_id] = { min: String(r.min_qty), bonus: String(r.bonus_qty) }
      }
      setRules(ruleMap)
      setDrafts((prev) => ({ ...draftMap, ...prev }))
    } finally {
      setLoading(false)
    }
  }, [companyId, tierPackageId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const saveRule = async (brandId: string) => {
    if (!companyId) return
    const draft = drafts[brandId] || { min: '', bonus: '' }
    const minQty = Math.trunc(Number(draft.min))
    const bonusQty = Math.trunc(Number(draft.bonus))
    if (!Number.isFinite(minQty) || minQty < 1 || !Number.isFinite(bonusQty) || bonusQty < 1) {
      showToast('수량을 확인해 주세요')
      return
    }
    setSavingId(brandId)
    try {
      const res = await fetch('/api/brand/tier-promo-rules/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, tier_package_id: tierPackageId, brand_id: brandId, min_qty: minQty, bonus_qty: bonusQty }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('저장 실패')
        return
      }
      showToast('저장됐어요')
      await load()
    } finally {
      setSavingId(null)
    }
  }
  const removeRule = async (brandId: string) => {
    if (!companyId) return
    const rule = rules[brandId]
    if (!rule) return
    const res = await fetch('/api/brand/tier-promo-rules/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ company_id: companyId, id: rule.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) {
      showToast('삭제 실패')
      return
    }
    showToast('삭제했어요')
    setDrafts((prev) => ({ ...prev, [brandId]: { min: '', bonus: '' } }))
    await load()
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {brands.map((b) => {
          const draft = drafts[b.id] || { min: '', bonus: '' }
          const hasRule = Boolean(rules[b.id])
          return (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: hasRule ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize: 12, color: '#fff', flex: 1, minWidth: 0 }}>{b.name}</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="N개"
                value={draft.min}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [b.id]: { ...draft, min: e.target.value.replace(/[^\d]/g, '') } }))}
                style={{ width: 50, padding: '5px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>이상 →</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="M개"
                value={draft.bonus}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [b.id]: { ...draft, bonus: e.target.value.replace(/[^\d]/g, '') } }))}
                style={{ width: 50, padding: '5px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>보너스</span>
              <button type="button" disabled={savingId === b.id} onClick={() => void saveRule(b.id)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}>저장</button>
              {hasRule && (
                <button type="button" onClick={() => void removeRule(b.id)} style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', fontSize: 11, cursor: 'pointer' }}>삭제</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
