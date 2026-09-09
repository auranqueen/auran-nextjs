'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'
const ACCENT = '#7B5EA7'

export default function BrandsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [brands, setBrands] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('brands').select('id, name, brand_name_kr, logo_url, origin_country').then(({ data }) => {
      setBrands(data ?? [])
    })
  }, [])

  const filtered = brands.filter(b => {
    const nm = (b.brand_name_kr || b.name || '').toLowerCase()
    return !search || nm.includes(search.toLowerCase()) || (b.name || '').toLowerCase().includes(search.toLowerCase())
  })

  return (
<div style={{ minHeight: '100vh', background: BG, color: '#fff' }}>
<div style={{ background: BG, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
<div onClick={() => router.back()} style={{ fontSize: 20, color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>←</div>
<div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>브랜드관</div>
</div>
<div style={{ background: BG, padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
<div style={{ fontSize: 15, color: '#fff', marginBottom: 2, textAlign: 'center' }}>살롱에서 검증된 프리미엄 에스테틱 브랜드</div>
<div style={{ fontSize: 11, color: ACCENT, marginBottom: 12, textAlign: 'center' }}>20년 경력 원장님의 큐레이션</div>
<div style={{ display: 'flex', alignItems: 'center', gap: 8, background: CARD_BG, borderRadius: 10, padding: '8px 12px', border: CARD_BORDER }}>
<span style={{ fontSize: 14, color: TEXT_MUTED }}>🔍</span>
<input value={search} onChange={e => setSearch(e.target.value)} placeholder="브랜드명을 입력하세요" style={{ border: 'none', background: 'none', fontSize: 12, color: 'rgba(255,255,255,0.85)', outline: 'none', width: '100%' }} />
</div>
</div>
<div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {filtered.map(b => (
<div key={b.id} onClick={() => router.push(`/products?brand=${b.id}`)} style={{ background: CARD_BG, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: CARD_BORDER, display: 'flex', flexDirection: 'column' }}>
<div style={{ width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: 10 }}>
              {b.logo_url
                ? <img src={b.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt={b.name} />
                : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: TEXT_DIM }}>NO</div><div style={{ fontSize: 9, color: TEXT_DIM }}>LOGO</div></div>
              }
</div>
<div style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{b.brand_name_kr || b.name}</div>
</div>
        ))}
</div>
</div>
  )
}
