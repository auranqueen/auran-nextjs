'use client'
import BrandLiveSection from '@/components/brand/BrandLiveSection'

interface Props {
  myBrands: { id: string; name: string }[]
  brandId: string | null
}

export default function BrandTabLive(props: Props) {
  return <BrandLiveSection {...props} />
}
