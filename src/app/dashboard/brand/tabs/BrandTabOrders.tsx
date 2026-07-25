'use client'
import { useEffect, useState } from 'react'
import BrandOrdersPromoSettings from '../components/BrandOrdersPromoSettings'
import BrandOrdersSummary from '../components/BrandOrdersSummary'
import BrandOrderBatchApproval from '../components/BrandOrderBatchApproval'
import BrandLogisticsClosingReview from '../components/BrandLogisticsClosingReview'
import type { CSSProperties } from 'react'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const SUB = 'rgba(255,255,255,0.3)'

interface Props {
  myBrands: { id: string; name: string }[]
}

export default function BrandTabOrders({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandName = myBrands.find((b) => b.id === selectedBrandId)?.name || ''

  const handleBrandChange = (id: string | null) => {
    setSelectedBrandId(id)
    if (typeof window === 'undefined') return
    if (id) localStorage.setItem('brand-tab-selection', id)
    else localStorage.removeItem('brand-tab-selection')
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('brand-tab-selection')
    if (saved && myBrands.some((b) => b.id === saved)) setSelectedBrandId(saved)
  }, [myBrands])

  return (
    <div>
      <BrandOrdersSummary
        myBrands={myBrands}
        selectedBrandId={selectedBrandId}
        onBrandChange={handleBrandChange}
      />
      {selectedBrandId ? (
        <BrandOrdersPromoSettings brandId={selectedBrandId} />
      ) : (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          프로모션 설정을 하려면 브랜드를 선택하세요
        </div>
      )}
      <BrandOrderBatchApproval
        brandId={selectedBrandId}
        brandIds={myBrands.map((b) => b.id)}
        brandName={brandName}
      />
      {selectedBrandId && (
        <>
          <BrandLogisticsClosingReview brandId={selectedBrandId} brandName={brandName} />
          <div style={CARD}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>👑 아레테클럽 포인트 현황</div>
            <div style={{ fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(201,169,110,0.04)', borderRadius: 7, border: '0.5px solid rgba(201,169,110,0.15)' }}>
              💡 아레테 포인트 + 발주 적립 포인트 → 시바산 제품 구매 시 통합 사용
            </div>
          </div>
        </>
      )}
    </div>
  )
}
