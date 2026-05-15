'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BrandsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [brands, setBrands] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'korean' | 'alpha'>('korean')
  const [alpha, setAlpha] = useState('전체')

  useEffect(() => {
    supabase.from('brands').select('id, name, brand_name_kr, logo_url, origin_country').then(({ data }) => {
      setBrands(data ?? [])
    })
  }, [])

  const ALPHA = ['전체','ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','기타']

  const getChosung = (str: string) => {
    if (!str) return '기타'
    const code = str.charCodeAt(0) - 0xAC00
    if (code < 0) return '기타'
    const chosungs = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
    return chosungs[Math.floor(code / 588)] || '기타'
  }

  const filtered = brands.filter(b => {
    const nm = (b.brand_name_kr || b.name || '').toLowerCase()
    const matchSearch = !search || nm.includes(search.toLowerCase()) || (b.name || '').toLowerCase().includes(search.toLowerCase())
    const matchAlpha = alpha === '전체' || getChosung(b.brand_name_kr || b.name || '') === alpha
    return matchSearch && matchAlpha
  }).sort((a, b) =>
    sort === 'korean'
      ? (a.brand_name_kr || a.name || '').localeCompare(b.brand_name_kr || b.name || '', 'ko')
      : (a.name || '').localeCompare(b.name || '', 'en')
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9f7ff' }}>
      <div style={{ background: '#fff', padding: '14px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <div onClick={() => router.back()} style={{ fontSize: 20, color: '#333', cursor: 'pointer' }}>←</div>
        <div style={{ fontSize: 14, color: '#111' }}>브랜드관</div>
      </div>
      <div style={{ background: '#fff', padding: '14px 16px 12px', borderBottom: '1px solid #f0eef8' }}>
        <div style={{ fontSize: 15, color: '#111', marginBottom: 2, textAlign: 'center' }}>에스테틱 명품 관리제품</div>
        <div style={{ fontSize: 11, color: '#9b8ec4', marginBottom: 12, textAlign: 'center' }}>공식스토어</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f3fc', borderRadius: 10, padding: '8px 12px', marginBottom: 11, border: '1px solid #ece8f8' }}>
          <span style={{ fontSize: 14, color: '#9b8ec4' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="브랜드명을 입력하세요" style={{ border: 'none', background: 'none', fontSize: 12, color: '#333', outline: 'none', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
          {(['korean','alpha'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 8, border: `1px solid ${sort===s?'#222':'#ddd'}`, background: sort===s?'#222':'#fff', color: sort===s?'#fff':'#888', cursor: 'pointer' }}>
              {s==='korean'?'가나다순':'알파벳순'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', rowGap: 4 }}>
          {ALPHA.map(a => (
            <button key={a} onClick={() => setAlpha(a)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: `1px solid ${alpha===a?'#222':'#ddd'}`, background: alpha===a?'#222':'#fff', color: alpha===a?'#fff':'#888', cursor: 'pointer' }}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {filtered.map(b => (
          <div key={b.id} onClick={() => router.push('/')} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: '100%', aspectRatio: '1', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0', padding: 10 }}>
              {b.logo_url
                ? <img src={b.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt={b.name} />
                : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 9, color: '#ccc' }}>NO</div><div style={{ fontSize: 9, color: '#ccc' }}>LOGO</div></div>
              }
            </div>
            <div style={{ padding: '8px 6px', textAlign: 'center', fontSize: 10, color: '#444' }}>{b.brand_name_kr || b.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
