'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import TabBrandSelector from '../components/TabBrandSelector'
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
}
export default function BrandTabReturns({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const [sub, setSub] = useState<SubTab>('list')
  return (
    <div>
      <TabBrandSelector myBrands={myBrands} storageKey="returns-brand" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
      ) : (
      <>
      <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
        {SUBTABS.map(t => (
          <button key={t.key} type="button" onClick={() => setSub(t.key)}
            style={{ flexShrink: 0, padding: '8px 14px', fontSize: 12, border: 'none', background: 'transparent', color: sub === t.key ? '#c4a7e7' : SUB, borderBottom: sub === t.key ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {sub === 'list' && <BrandReturnsList brandId={brandId} />}
      {sub === 'receive' && <BrandReturnsReceive brandId={brandId} />}
      </>
      )}
    </div>
  )
}
