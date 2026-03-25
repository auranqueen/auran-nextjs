'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CONCERN_OPTIONS = ['수분부족', '미백·톤업', '모공·각질', '민감·진정', '안티에이징', '자외선차단']

export default function SkinConcernsAdminPage() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('products').select('id, name, skin_concerns').order('name').then(({ data }) => {
      if (data) setProducts(data)
    })
  }, [])

  const toggleConcern = async (productId: string, concern: string, current: string[]) => {
    setSaving(productId)
    const updated = current?.includes(concern)
      ? current.filter(c => c !== concern)
      : [...(current || []), concern]

    await supabase.from('products').update({ skin_concerns: updated }).eq('id', productId)
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, skin_concerns: updated } : p))
    setSaving(null)
  }

  const runAutoTag = async () => {
    if (!confirm('전체 제품 AI 자동 태깅을 실행할까요?')) return
    const res = await fetch('/api/admin/products/skin-concerns', { method: 'POST' })
    const data = await res.json()
    alert(`완료! ${data.updated}개 제품 태깅됨`)
    window.location.reload()
  }

  const filtered = products.filter(p => p.name?.includes(search))

  return (
    <div style={{ padding: 24, background: '#0D0B09', minHeight: '100vh', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#C9A96E', fontSize: 20 }}>피부고민 태깅 관리</h1>
        <button onClick={runAutoTag} style={{
          background: '#C9A96E', color: '#000', border: 'none',
          padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700
        }}>
          🤖 AI 자동 태깅 실행
        </button>
      </div>

      <input
        placeholder="제품명 검색..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: 14
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(product => (
          <div key={product.id} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: 16
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{product.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CONCERN_OPTIONS.map(concern => (
                <button
                  key={concern}
                  onClick={() => toggleConcern(product.id, concern, product.skin_concerns || [])}
                  disabled={saving === product.id}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                    background: product.skin_concerns?.includes(concern)
                      ? '#C9A96E' : 'rgba(255,255,255,0.05)',
                    color: product.skin_concerns?.includes(concern) ? '#000' : 'rgba(255,255,255,0.5)',
                    border: product.skin_concerns?.includes(concern)
                      ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    fontWeight: product.skin_concerns?.includes(concern) ? 700 : 400
                  }}
                >
                  {concern}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

