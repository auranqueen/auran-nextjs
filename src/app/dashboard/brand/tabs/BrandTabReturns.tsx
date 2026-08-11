'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
const BrandReturnsList = dynamic(() => import('./BrandReturnsList'), { ssr: false })
const BrandReturnsReceive = dynamic(() => import('./BrandReturnsReceive'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'list', label: '신청 목록', icon: '📋' },
  { key: 'receive', label: '수령 처리', icon: '📦' },
] as const
type SubTab = typeof SUBTABS[number]['key']
interface Props {
  myBrands: { id: string; name: string }[]
  brandId: string | null
}
export default function BrandTabReturns({ brandId }: Props) {
  const supabase = createClient()
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [sub, setSub] = useState<SubTab>('list')
  useEffect(() => {
    if (!brandId) { setCompanyBrandIds([]); return }
    let cancelled = false
    void (async () => {
      const ids = await resolveCompanyBrandIds(supabase, brandId)
      if (!cancelled) setCompanyBrandIds(ids)
    })()
    return () => { cancelled = true }
  }, [brandId, supabase])
  if (!companyBrandIds.length) {
    return <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>불러오는 중…</div>
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
        {SUBTABS.map(t => (
          <button key={t.key} type="button" onClick={() => setSub(t.key)}
            style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, border: 'none', background: 'transparent', color: sub === t.key ? '#c4a7e7' : SUB, borderBottom: sub === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {sub === 'list' && <BrandReturnsList brandId={brandId} companyBrandIds={companyBrandIds} />}
      {sub === 'receive' && <BrandReturnsReceive brandId={brandId} companyBrandIds={companyBrandIds} />}
    </div>
  )
}
