'use client'

import { useState } from 'react'
import { normalizeProductThumbUrl } from '@/lib/productImage'

type Props = {
  src?: string | null
  alt: string
  /** 고정 크기(px). fill이 아닐 때 사용 */
  size?: number
  /** 부모가 position:relative + 명시적 크기일 때 채움 */
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
