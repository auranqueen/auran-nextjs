'use client'

interface Props {
  name?: string | null
}

export default function BrandNameBadge({ name }: Props) {
  const label = String(name || '').trim() || '브랜드'
  return (
    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', flexShrink: 0 }}>
      {label}
    </span>
  )
}