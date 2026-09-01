'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import BrandHqCampaignSection from './BrandHqCampaignSection'
import TabBrandSelector from '../components/TabBrandSelector'

const BrandInventoryMarketing = dynamic(() => import('./BrandInventoryMarketing'), { ssr: false })

const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'

const SUBTABS = [
  { key: 'events', label: '캠페인' },
  { key: 'stock', label: '재고' },
] as const

type SubTab = typeof SUBTABS[number]['key']

interface Props {
  myBrands: { id: string; name: string; slug?: string | null }[]
  staffId: string | null
  isCEO: boolean
  initialSub?: string
}

export default function BrandTabMarketingManage({ myBrands, staffId, isCEO, initialSub }: Props) {
  const supabase = createClient()
  const initialSubParts = (initialSub || 'events').split(':')
  const [sub, setSub] = useState<SubTab>((initialSubParts[0] as SubTab) || 'events')
  const initialViewModeHint = initialSubParts[1]

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [lowStockCounts, setLowStockCounts] = useState<Record<string, number>>({})

  const brandId = selectedBrandId
  const effectiveBrandId = brandId === 'all' ? null : brandId
  const brandName = myBrands.find((b) => b.id === effectiveBrandId)?.name || ''

  useEffect(() => {
    const anchorBrandId = myBrands[0]?.id
    if (!anchorBrandId) {
      setCompanyId(null)
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
      if (!cancelled) setCompanyId(cid)
    })()
    return () => {
      cancelled = true
    }
  }, [myBrands, supabase])

  const loadLowStockCounts = useCallback(async () => {
    const anchorBrandId = myBrands[0]?.id
    if (!anchorBrandId) {
      setCompanyBrandIds([])
      setLowStockCounts({})
      return
    }
    const { data: brandRow } = await supabase.from('brands').select('company_id').eq('id', anchorBrandId).maybeSingle()
    const cid = brandRow?.company_id ? String(brandRow.company_id) : null
    let ids = myBrands.map((b) => b.id)
    if (cid) {
      const { data: companyBrands } = await supabase.from('brands').select('id').eq('company_id', cid)
      const cbIds = (companyBrands || []).map((b: { id: string }) => String(b.id))
      if (cbIds.length > 0) ids = cbIds
    }
    setCompanyBrandIds(ids)
    if (ids.length === 0) {
      setLowStockCounts({})
      return
    }
    const { data: invRows } = await supabase
      .from('brand_inventory')
      .select('brand_id, total_stock, safety_stock')
      .in('brand_id', ids)
    const counts: Record<string, number> = {}
    for (const r of (invRows || []) as { brand_id: string; total_stock: number; safety_stock: number }[]) {
      const bid = String(r.brand_id)
      const total = Math.trunc(Number(r.total_stock) || 0)
      const safety = Math.trunc(Number(r.safety_stock) || 0)
      if (safety > 0 && total <= safety) counts[bid] = (counts[bid] || 0) + 1
    }
    setLowStockCounts(counts)
  }, [myBrands, supabase])

  useEffect(() => {
    void loadLowStockCounts()
  }, [loadLowStockCounts])

  return (
    <div>
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

      {sub === 'events' && (
        !companyId ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>불러오는 중…</div>
        ) : (
          <BrandHqCampaignSection companyId={companyId} staffId={staffId} isCEO={isCEO} />
        )
      )}

      {sub === 'stock' && (
        <>
          <TabBrandSelector
            myBrands={myBrands}
            storageKey="brand-tab-selection"
            onSelect={setSelectedBrandId}
            lowStockCounts={lowStockCounts}
            showAllOption
          />
          {!selectedBrandId ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
          ) : (
            <BrandInventoryMarketing
              brandId={effectiveBrandId}
              brandName={brandName}
              companyBrandIds={companyBrandIds}
              initialViewMode={initialViewModeHint as 'expiry' | 'normal' | 'bundle' | undefined}
            />
          )}
        </>
      )}
    </div>
  )
}