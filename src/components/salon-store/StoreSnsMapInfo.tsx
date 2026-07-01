'use client'

type SnsLinks = { instagram?: string; kakao?: string; youtube?: string } | null | undefined

type Props = {
  mapUrl?: string | null
  snsLinks?: SnsLinks
}

export default function StoreSnsMapInfo({ mapUrl, snsLinks }: Props) {
  const sns = snsLinks && typeof snsLinks === 'object' ? snsLinks : {}
  const hasMap = Boolean(mapUrl && String(mapUrl).trim())
  const hasSns = Boolean(sns.instagram || sns.kakao || sns.youtube)
  if (!hasMap && !hasSns) return null

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        {hasMap ? (
          <a href={String(mapUrl)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7B5EA7', textDecoration: 'none' }}>
            📍 찾아가기
          </a>
        ) : null}
        {sns.instagram ? (
          <a href={String(sns.instagram)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
            Instagram
          </a>
        ) : null}
        {sns.kakao ? (
          <a href={String(sns.kakao)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
            Kakao
          </a>
        ) : null}
        {sns.youtube ? (
          <a href={String(sns.youtube)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
            YouTube
          </a>
        ) : null}
      </div>
    </div>
  )
}
