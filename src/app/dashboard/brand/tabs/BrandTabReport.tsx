'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
const BrandReportCompare = dynamic(() => import('./BrandReportCompare'), { ssr: false })
const BrandReportStaff = dynamic(() => import('./BrandReportStaff'), { ssr: false })
const BrandReportHQ = dynamic(() => import('./BrandReportHQ'), { ssr: false })
const BrandReportLogistics = dynamic(() => import('./BrandReportLogistics'), { ssr: false })
const BrandReportMismatch = dynamic(() => import('./BrandReportMismatch'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'compare', label: '실시간 대조', icon: '⚖️' },
  { key: 'hq', label: '본사 기록', icon: '🏢' },
  { key: 'logistics', label: '물류 기록', icon: '🚛' },
  { key: 'staff', label: '담당자별', icon: '👤' },
  { key: 'mismatch', label: '불일치 감지', icon: '🔍' },
] as const
type SubTab = typeof SUBTABS[number]['key']
interface Props {
  myBrands: { id: string; name: string }[]
  brandId: string | null
}
export default function BrandTabReport({ myBrands, brandId }: Props) {
  const supabase = createClient()
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [brandNames, setBrandNames] = useState<Record<string, string>>({})
  const [sub, setSub] = useState<SubTab>('compare')
  useEffect(() => {
    if (!brandId) {
      setCompanyBrandIds([])
      setBrandNames({})
      return
    }
    let cancelled = false
    void (async () => {
      const ids = await resolveCompanyBrandIds(supabase, brandId)
      const { data: rows } = await supabase.from('brands').select('id, name').in('id', ids)
      const map: Record<string, string> = {}
      for (const r of rows || []) {
        map[String((r as { id: string }).id)] = String((r as { name?: string }).name || '')
      }
      for (const b of myBrands) {
        if (!map[b.id]) map[b.id] = b.name
      }
      if (!cancelled) {
        setCompanyBrandIds(ids)
        setBrandNames(map)
      }
    })()
    return () => { cancelled = true }
  }, [brandId, supabase, myBrands])
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto' as const, marginBottom: 14, borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        {SUBTABS.map(t => (
          <button key={t.key} type="button" onClick={() => setSub(t.key)}
            style={{ flexShrink: 0, padding: '8px 12px', fontSize: 12, border: 'none', background: 'transparent', color: sub === t.key ? '#c4a7e7' : SUB, borderBottom: sub === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {companyBrandIds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : (
        <>
          {sub === 'compare' && <BrandReportCompare companyBrandIds={companyBrandIds} brandNames={brandNames} />}
          {sub === 'staff' && <BrandReportStaff companyBrandIds={companyBrandIds} brandNames={brandNames} />}
          {sub === 'hq' && <BrandReportHQ companyBrandIds={companyBrandIds} brandNames={brandNames} />}
          {sub === 'logistics' && <BrandReportLogistics companyBrandIds={companyBrandIds} brandNames={brandNames} />}
          {sub === 'mismatch' && <BrandReportMismatch companyBrandIds={companyBrandIds} brandNames={brandNames} />}
        </>
      )}
    </div>
  )
}
