'use client'
/**
 * LOCKED — 디자인/프롭 시그니처 변경 시 전역 검색 후 연관 페이지 동시 점검.
 * 래퍼: @/components/ProductThumbnail
 */
import { useState } from 'react'
import { normalizeProductThumbUrl } from '@/lib/productImage'

type Props = {
  src?: string | null
  alt: string
  size?: number
  fill?: boolean
  className?: string
  style?: React.CSSProperties
  objectFit?: 'cover' | 'contain'
}

export default function ProductThumbnail({
  src,
  alt,
  size = 80,
  fill,
  className,
  style,
  objectFit = 'cover',
}: Props) {
  const [error, setError] = useState(false)
  const normalized = normalizeProductThumbUrl(src)
  const imgSrc = error || !normalized ? null : normalized

  const placeholder = (
    <div
      style={{
        ...(fill
          ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%' }
          : { width: size, height: size }),
        borderRadius: 8,
        background: 'rgba(31, 41, 55, 0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fill ? 40 : size >= 72 ? 28 : 20,
        ...(style || {}),
      }}
      className={className}
    >
      🧴
    </div>
  )

  if (!imgSrc) return placeholder

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit,
          borderRadius: 8,
          ...(style || {}),
        }}
        onError={() => setError(true)}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit,
        borderRadius: 8,
        display: 'block',
        ...(style || {}),
      }}
      onError={() => setError(true)}
    />
  )
}
