'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'

type Props = {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  style?: React.CSSProperties
  priority?: boolean
}

/** 고객·목록용: 원격 도메인 차단 회피를 위해 네이티브 img 기반 ProductThumbnail 사용 */
export default function ProductThumbImage({ src, alt, width, height, fill, style }: Props) {
  const w = width || height || 72
  if (fill) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...(style || {}) }}>
        <ProductThumbnail src={src} alt={alt} fill objectFit="cover" />
      </div>
    )
  }
  return <ProductThumbnail src={src} alt={alt} size={w} style={style} objectFit="cover" />
}
