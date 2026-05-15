'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
<div style={{ minHeight: '100vh', background: '#faf9f6' }}>
<div style={{ background: '#faf9f6', padding: '14px 16px', borderBottom: '1px solid #ede8f0', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
<div onClick={() => router.back()} style={{ fontSize: 20, color: '#333', cursor: 'pointer' }}>←</div>
<div style={{ fontSize: 14, color: '#111' }}>브랜드관</div>
</div>
<div style={{ background: '#faf9f6', padding: '14px 16px 12px', borderBottom: '1px solid #ede8f0' }}>
<div style={{ fontSize: 15, color: '#111', marginBottom: 2, textAlign: 'center' }}>살롱에서 검증된 프리미엄 에스테틱 브랜드</div>
<div style={{ fontSize: 11, color: '#9b8ec4', marginBottom: 12, textAlign: 'center' }}>20년 경력 원장님의 큐레이션</div>
<div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f3fc', borderRadius: 10, padding: '8px 12px', border: '1px solid #ece8f8' }}>
<span style={{ fontSize: 14, color: '#9b8ec4' }}>🔍</span>
<input value={search} onChange={e => setSearch(e.target.value)} placeholder="브랜드명을 입력하세요" style={{ border: 'none', background: 'none', fontSize: 12, color: '#333', outline: 'none', width: '100%' }} />
</div>
</div>
<div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {filtered.map(b => (
<div key={b.id} onClick={() => router.push(`/products?brand=${b.id}`)} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #ede8f0', display: 'flex', flexDirection: 'column' }}>
<div style={{ width: '100%', aspectRatio: '1', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0', padding: 10 }}>
              {b.logo_url
                ? <img src={b.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt={b.name} />
                : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: '#ccc' }}>NO</div><div style={{ fontSize: 9, color: '#ccc' }}>LOGO</div></div>
              }
</div>
<div style={{ padding: '8px 6px', textAlign: 'center', fontSize: 12, color: '#2a1f35' }}>{b.brand_name_kr || b.name}</div>
</div>
        ))}
</div>
</div>
  )
}