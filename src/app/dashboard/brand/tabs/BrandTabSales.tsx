'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
const BrandTabOrders = dynamic(() => import('./BrandTabOrders'), { ssr: false })
const BrandTabReturns = dynamic(() => import('./BrandTabReturns'), { ssr: false })
const BrandTabSample = dynamic(() => import('./BrandTabSample'), { ssr: false })
const PURPLE = '#7B5EA7'
const SUB = 'rgba(255,255,255,0.3)'
const SUBTABS = [
  { key: 'orders', label: '발주 관리' },
  { key: 'returns', label: '반품 관리' },
  { key: 'sample', label: '샘플 발송' },
] as const
type SubTab = typeof SUBTABS[number]['key']
type Props = {
  myBrands: { id: string; name: string }[]
  initialSub?: string
  brandId: string | null
}
export default function BrandTabSales({ myBrands, initialSub, brandId }: Props) {
  const [sub, setSub] = useState<SubTab>((initialSub as SubTab) ?? 'orders')
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {SUBTABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: sub === t.key ? `2px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.15)',
              background: sub === t.key ? '#c4a7e7' : 'transparent',
              color: sub === t.key ? '#1a1520' : SUB,
              fontSize: 13,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'orders' && <BrandTabOrders myBrands={myBrands} />}
      {sub === 'returns' && <BrandTabReturns myBrands={myBrands} brandId={brandId} />}
      {sub === 'sample' && <BrandTabSample myBrands={myBrands} brandId={brandId} />}
    </div>
  )
}
