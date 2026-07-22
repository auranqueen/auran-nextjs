'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import TabBrandSelector from './TabBrandSelector'

const BrandTabOwners = dynamic(() => import('../tabs/BrandTabOwners'), { ssr: false })

type BrandOption = { id: string; name: string }

interface Props {
  myBrands: BrandOption[]
  authId: string | null
}

export default function OwnersBrandWrapper({ myBrands, authId }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandName = myBrands.find((b) => b.id === selectedBrandId)?.name || ''

  return (
    <div>
      <TabBrandSelector myBrands={myBrands} storageKey="owners-brand" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          브랜드 선택 중…
        </div>
      ) : (
        <BrandTabOwners brandId={selectedBrandId} brandName={brandName} authId={authId} />
      )}
    </div>
  )
}
