'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { normalizeProductThumbUrl } from '@/lib/productImage'

const PLACEHOLDER = '/images/product-placeholder.png'

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

export default function ProductThumbImage({ src, alt, width, height, fill, sizes, style, priority }: Props) {
  const normalized = normalizeProductThumbUrl(src)
  const [stage, setStage] = useState<'remote' | 'placeholder' | 'emoji'>(() => (normalized ? 'remote' : 'emoji'))

  useEffect(() => {
    setStage(normalized ? 'remote' : 'emoji')
  }, [normalized])

  const onError = useCallback(() => {
    setStage((s) => (s === 'remote' ? 'placeholder' : 'emoji'))
  }, [])

  if (stage === 'emoji' || !normalized) {
    return (
      <div
        style={{
          width: fill ? '100%' : width,
          height: fill ? '100%' : height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.22)',
          ...(style || {}),
        }}
      >
        <span style={{ fontSize: fill ? 'min(28vw, 64px)' : 28, opacity: 0.45, lineHeight: 1 }}>🧴</span>
      </div>
    )
  }

  const url = stage === 'remote' ? normalized : PLACEHOLDER

  if (fill) {
    return (
      <Image
        src={url}
        alt={alt}
        fill
        sizes={sizes || '(max-width: 480px) 120px, 120px'}
        style={{ objectFit: 'cover', ...(style || {}) }}
        onError={onError}
        priority={priority}
      />
    )
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={width || 72}
      height={height || 72}
      style={{ objectFit: 'cover', display: 'block', ...(style || {}) }}
      onError={onError}
      priority={priority}
    />
  )
}
