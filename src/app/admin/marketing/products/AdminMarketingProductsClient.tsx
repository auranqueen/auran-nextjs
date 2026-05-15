'use client'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  tag: string | null
  description: string | null
  retail_price: number
  sale_price: number
  is_active: boolean
  routine_category: string | null
  status: string | null
  brand_id: string | null
  ingredient: string | null
  ingredient_analyzed?: boolean | null
  brands?: { name: string } | null
  thumb_img?: string | null
  storage_thumb_url?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  active: '판매중',
  hidden: '숨김',
  pending: '미매핑',
}

export default function AdminMarketingProductsClient() {
  const supabase = createClient()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('전체')
  const [tab, setTab] = useState('전체')
  const [brands, setBrands] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, brands(name)')
      .order('created_at', { ascending: false })
    setProducts(data ?? [])
    const brandList = Array.from(new Set((data ?? []).map((p: Product) => p.brands?.name).filter(Boolean))) as string[]
    setBrands(brandList)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = products.filter(p => {
    const bname = p.brands?.name ?? ''
    const matchBrand = brand === '전체' || bname === brand
    const matchTab =
      tab === '전체' ||
      (tab === '판매중' && p.is_active && p.status === 'active') ||
      (tab === '미매핑' && (!p.routine_category || p.status === 'pending')) ||
      (tab === '숨김' && (!p.is_active || p.status === 'hidden')) ||
      (tab === 'AI분석완료' && (p as any).ai_tag_status === 'approved')
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || bname.toLowerCase().includes(q) || (p.tag ?? '').toLowerCase().includes(q)
    return matchBrand && matchTab && matchSearch
  })

  const counts = {
    전체: products.length,
    판매중: products.filter(p => p.is_active && p.status === 'active').length,
    미매핑: products.filter(p => !p.routine_category || p.status === 'pending').length,
    숨김: products.filter(p => !p.is_active || p.status === 'hidden').length,
    AI완료: products.filter(p => p.ingredient && p.ingredient.length > 10).length,
    'AI분석완료': products.filter(p => (p as any).ai_tag_status === 'approved').length,
  }

  const toggleActive = async (p: Product) => {
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    await load()
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('products').delete().eq('id', id)
    await load()
  }

  const getStatusClass = (p: Product) => {
    if (!p.is_active || p.status === 'hidden') return 'hidden'
    if (!p.routine_category || p.status === 'pending') return 'unmapped'
    return 'active'
  }

  const getStatusLabel = (p: Product) => {
    if (!p.is_active || p.status === 'hidden') return '숨김'
    if (!p.routine_category || p.status === 'pending') return '미매핑'
    return '판매중'
  }

  const s: Record<string, React.CSSProperties> = {
    wrap: { padding: '20px', fontFamily: 'inherit', color: 'var(--color-text-primary, #111)' },
    top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    h2: { fontSize: 16, fontWeight: 500 },
    btnNew: { padding: '8px 16px', borderRadius: 8, background: '#7B5EA7', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
    stats: { display: 'flex', gap: 16, marginBottom: 14 },
    stat: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
    statVal: { color: '#fff', fontWeight: 500 },
    searchWrap: { position: 'relative', marginBottom: 12 },
    searchInput: { width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', fontSize: 13, color: '#fff', outline: 'none' },
    searchIcon: { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'rgba(255,255,255,0.3)' },
    brandChips: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10, scrollbarWidth: 'none' as const },
    chipBase: { padding: '5px 12px', borderRadius: 20, border: '0.5px solid rgba(255,255,255,0.12)', fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', flexShrink: 0 },
    chipOn: { padding: '5px 12px', borderRadius: 20, border: '0.5px solid rgba(123,94,167,0.5)', fontSize: 11, color: '#c4a7e7', whiteSpace: 'nowrap', cursor: 'pointer', background: 'rgba(123,94,167,0.15)', flexShrink: 0 },
    tabs: { display: 'flex', gap: 4, marginBottom: 14 },
    tabBase: { padding: '5px 13px', borderRadius: 20, border: '0.5px solid rgba(255,255,255,0.1)', fontSize: 11, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', background: 'transparent' },
    tabOn: { padding: '5px 13px', borderRadius: 20, border: '0.5px solid rgba(123,94,167,0.4)', fontSize: 11, color: '#c4a7e7', cursor: 'pointer', background: 'rgba(123,94,167,0.12)' },
    tabWarn: { padding: '5px 13px', borderRadius: 20, border: '0.5px solid rgba(201,169,110,0.25)', fontSize: 11, color: '#C9A96E', cursor: 'pointer', background: 'transparent' },
    tabWarnOn: { padding: '5px 13px', borderRadius: 20, border: '0.5px solid rgba(201,169,110,0.4)', fontSize: 11, color: '#C9A96E', cursor: 'pointer', background: 'rgba(201,169,110,0.1)' },
    resultInfo: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 },
    card: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, background: 'rgba(255,255,255,0.02)', marginBottom: 7, cursor: 'pointer' },
    imgBox: { width: 46, height: 46, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18, color: 'rgba(255,255,255,0.25)' },
    info: { flex: 1, minWidth: 0 },
    name: { fontSize: 12, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 },
    meta: { display: 'flex', gap: 6, alignItems: 'center' },
    brandTxt: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
    catTag: { fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '0.5px solid rgba(255,255,255,0.08)' },
    aiDotDone: { width: 6, height: 6, borderRadius: '50%', background: '#7B5EA7', flexShrink: 0 },
    aiDotTodo: { width: 6, height: 6, borderRadius: '50%', background: '#C9A96E', flexShrink: 0 },
    right: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
    priceBox: { textAlign: 'right' as const },
    priceVal: { fontSize: 12, color: '#fff', fontWeight: 500 },
    priceOrig: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' },
    actBtn: { width: 27, height: 27, borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
    actBtnDel: { width: 27, height: 27, borderRadius: 7, border: '0.5px solid rgba(224,80,80,0.2)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#E24B4A' },
  }

  const statusStyle = (cls: string): React.CSSProperties => {
    if (cls === 'active') return { fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(29,158,117,0.1)', color: '#1D9E75', border: '0.5px solid rgba(29,158,117,0.2)' }
    if (cls === 'unmapped') return { fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(201,169,110,0.1)', color: '#C9A96E', border: '0.5px solid rgba(201,169,110,0.25)' }
    return { fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '0.5px solid rgba(255,255,255,0.1)' }
  }

  return (
    <div style={s.wrap}>
      <div style={s.top}>
        <h2 style={s.h2}>제품 관리</h2>
        <button style={s.btnNew} onClick={() => router.push('/admin/products/edit')}>
          + 새 제품 등록
        </button>
      </div>

      <div style={s.stats}>
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} style={s.stat}>
            {k} <span style={s.statVal}>{v}</span>
          </div>
        ))}
      </div>

      <div style={s.searchWrap}>
        <span style={s.searchIcon}>🔍</span>
        <input
          style={s.searchInput}
          placeholder="제품명, 브랜드, 키워드 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={s.brandChips}>
        {['전체', ...brands].map(b => (
          <span key={b} style={brand === b ? s.chipOn : s.chipBase} onClick={() => setBrand(b)}>
            {b}
          </span>
        ))}
      </div>

      <div style={s.tabs}>
        {(['전체', '판매중', '미매핑', '숨김', 'AI분석완료'] as const).map(t => (
          <span key={t} style={t === '미매핑' ? (tab === t ? s.tabWarnOn : s.tabWarn) : tab === t ? s.tabOn : s.tabBase} onClick={() => setTab(t)}>
            {t} {counts[t as keyof typeof counts]}
          </span>
        ))}
      </div>

      <div style={s.resultInfo}>{filtered.length}개 제품</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>제품이 없어요</div>
      ) : (
        filtered.map(p => {
          const sc = getStatusClass(p)
          return (
            <div key={p.id} style={s.card}>
              <div style={s.imgBox}>
                {(p as any).thumb_img || (p as any).storage_thumb_url
                  ? <img src={(p as any).storage_thumb_url || (p as any).thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                  : <span>🧴</span>
                }
              </div>
              <div style={s.info}>
                <div style={s.name}>{p.name}</div>
                <div style={s.meta}>
                  <span style={s.brandTxt}>{p.brands?.name ?? '-'}</span>
                  {p.routine_category && <span style={s.catTag}>{p.routine_category}</span>}
                  {p.ingredient && p.ingredient.trim() ? (
                    p.ingredient_analyzed === true ? (
                      <div style={s.aiDotDone} title="AI 분석 완료" />
                    ) : (
                      <div style={s.aiDotTodo} title="전성분 있음 / 미분석" />
                    )
                  ) : null}
                </div>
              </div>
              <div style={s.right}>
                <div style={s.priceBox}>
                  {p.retail_price > 0 && p.retail_price !== p.sale_price && <div style={s.priceOrig}>{p.retail_price.toLocaleString()}</div>}
                  <div style={s.priceVal}>{p.sale_price.toLocaleString()}원</div>
                </div>
                <span style={statusStyle(sc)}>{getStatusLabel(p)}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    style={s.actBtn}
                    onClick={e => {
                      e.stopPropagation()
                      router.push(`/admin/products/edit?id=${p.id}`)
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    style={s.actBtn}
                    onClick={e => {
                      e.stopPropagation()
                      void toggleActive(p)
                    }}
                  >
                    {p.is_active ? '🙈' : '👁️'}
                  </button>
                  <button
                    style={s.actBtnDel}
                    onClick={e => {
                      e.stopPropagation()
                      void deleteProduct(p.id)
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
