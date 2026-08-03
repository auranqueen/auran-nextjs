'use client'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import TabBrandSelector from '../components/TabBrandSelector'
const BrandInventoryStock = dynamic(() => import('./BrandInventoryStock'), { ssr: false })
const BrandInventoryLots = dynamic(() => import('./BrandInventoryLots'), { ssr: false })
const BrandInventoryScan = dynamic(() => import('./BrandInventoryScan'), { ssr: false })
const BrandInventoryQR = dynamic(() => import('./BrandInventoryQR'), { ssr: false })
const BrandInventoryClose = dynamic(() => import('./BrandInventoryClose'), { ssr: false })
const BrandInventoryEmergency = dynamic(() => import('./BrandInventoryEmergency'), { ssr: false })
const BrandInventoryMarketing = dynamic(() => import('./BrandInventoryMarketing'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'stock', label: '재고현황', icon: '📦' },
  { key: 'lots', label: '로트관리', icon: '🏷️' },
  { key: 'scan', label: '스캔입출고', icon: '📲' },
  { key: 'qr', label: 'QR발행', icon: '🔲' },
  { key: 'close', label: '월마감', icon: '📅' },
  { key: 'emergency', label: '비상출고', icon: '🚨' },
  { key: 'marketing', label: '마케팅자료', icon: '📣' },
] as const
type SubTab = typeof SUBTABS[number]['key']
interface Props {
  myBrands: { id: string; name: string; slug?: string | null }[]
  authId: string | null
  loginRole?: string
}
export default function BrandTabInventory({ myBrands, authId, loginRole = 'director' }: Props) {
  const supabase = createClient()
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [logiOpening, setLogiOpening] = useState(false)
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [lowStockCounts, setLowStockCounts] = useState<Record<string, number>>({})
  const brandId = selectedBrandId
  const effectiveBrandId = brandId === 'all' ? null : brandId
  const brandName = myBrands.find((b) => b.id === effectiveBrandId)?.name || ''
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
    for (const r of (invRows || []) as any[]) {
      const bid = String(r.brand_id)
      const total = Math.trunc(Number(r.total_stock) || 0)
      const safety = Math.trunc(Number(r.safety_stock) || 0)
      if (safety > 0 && total <= safety) counts[bid] = (counts[bid] || 0) + 1
    }
    setLowStockCounts(counts)
  }, [myBrands])
  useEffect(() => {
    void loadLowStockCounts()
  }, [loadLowStockCounts])
  const openLogiHub = async () => {
    if (!effectiveBrandId || logiOpening) return
    setLogiOpening(true)
    try {
      let slug = myBrands.find((b) => b.id === effectiveBrandId)?.slug
      if (!slug) {
        const { data } = await supabase
          .from('brands')
          .select('slug')
          .eq('id', effectiveBrandId)
          .maybeSingle()
        slug = data?.slug != null ? String(data.slug) : null
      }
      const href = slug
        ? `/dashboard/logi?slug=${encodeURIComponent(slug)}`
        : '/dashboard/logi'
      window.open(href, '_blank', 'noopener,noreferrer')
    } finally {
      setLogiOpening(false)
    }
  }
  const [sub, setSub] = useState<SubTab>('stock')
  return (
    <div>
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
      <>
      {sub === 'stock' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => { void openLogiHub() }}
            disabled={logiOpening || !effectiveBrandId}
            style={{
              padding: '7px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid rgba(123,94,167,0.55)',
              background: 'rgba(123,94,167,0.18)',
              color: '#e9e4f1',
              cursor: logiOpening || !effectiveBrandId ? 'not-allowed' : 'pointer',
              opacity: logiOpening || !effectiveBrandId ? 0.5 : 1,
              whiteSpace: 'nowrap' as const,
            }}
          >
            🚚 물류허브 열기{!effectiveBrandId ? '(브랜드 선택 필요)' : ''}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto' as const, marginBottom: 14, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        {SUBTABS.map(t => (
          <button key={t.key} type="button" onClick={() => setSub(t.key)}
            style={{ flexShrink: 0, padding: '8px 12px', fontSize: 12, border: 'none', background: 'transparent', color: sub === t.key ? '#c4a7e7' : SUB, borderBottom: sub === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {sub === 'stock' && <BrandInventoryStock brandId={brandId} companyBrandIds={companyBrandIds} brandName={brandId === 'all' ? '전체' : brandName} authId={authId} />}
      {sub === 'lots' && <BrandInventoryLots brandId={effectiveBrandId} />}
      {sub === 'scan' && <BrandInventoryScan brandId={effectiveBrandId} brandName={brandName} />}
      {sub === 'qr' && <BrandInventoryQR brandId={effectiveBrandId} brandName={brandName} />}
      {sub === 'close' && <BrandInventoryClose brandId={effectiveBrandId} />}
      {sub === 'emergency' && <BrandInventoryEmergency brandId={effectiveBrandId} brandName={brandName} />}
      {sub === 'marketing' && <BrandInventoryMarketing brandId={effectiveBrandId} brandName={brandName} />}
      </>
      )}
    </div>
  )
}
