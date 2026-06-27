'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
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
  brandId: string | null
  brandName: string
}
export default function BrandTabReport({ brandId, brandName }: Props) {
  const [sub, setSub] = useState<SubTab>('compare')
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
      {sub === 'compare' && <BrandReportCompare brandId={brandId} />}
      {sub === 'staff' && <BrandReportStaff brandId={brandId} />}
      {sub === 'hq' && <BrandReportHQ brandId={brandId} />}
      {sub === 'logistics' && <BrandReportLogistics brandId={brandId} />}
      {sub === 'mismatch' && <BrandReportMismatch brandId={brandId} />}
    </div>
  )
}
