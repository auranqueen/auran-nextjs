'use client'
// ===== [또또복권 관리] gift_items 등록/수정/삭제 =====
// 오랜 또또(general) / 르노벨 골든또또(renobel) 상품 풀 관리
// 재고 설정 + 활성화 여부 + 제품 연결
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const RENOBEL_BRAND_ID = '90175aa9-70c8-4568-865a-195f11bd7859'

// 또또 티어 옵션
const GENERAL_TIERS = [
  { value: '200000', label: '통합 20만↑' },
  { value: '300000', label: '통합 30만↑' },
  { value: '500000', label: '통합 50만↑' },
  { value: '1000000', label: '통합 100만↑' },
]
const RENOBEL_TIERS = [
  { value: '700000', label: '르노벨 70만↑' },
  { value: '1200000', label: '르노벨 120만↑' },
  { value: '2000000', label: '르노벨 200만↑' },
]

export default function TotoAdminPage() {
  const supabase = createClient()

  const [tab, setTab] = useState<'general' | 'renobel'>('general')
  const [giftItems, setGiftItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // 신규 등록 폼
  const [form, setForm] = useState({
    product_id: '',
    brand_type: 'general' as 'general' | 'renobel',
    tier: '200000',
    stock: 10,
  })

  // [제품 검색바] 검색어 + 드롭다운 열림 상태
  const [productSearch, setProductSearch] = useState('')
  const [showProductList, setShowProductList] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // gift_items 목록
      const { data: items } = await supabase
        .from('gift_items')
        .select('*, product:products(id, name, thumb_img, brand_id)')
        .order('created_at', { ascending: false })
      setGiftItems(items || [])

      // 제품 목록 (등록용 셀렉트박스)
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, brand_id, thumb_img')
        .eq('is_active', true)
        .order('name')
      setProducts(prods || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 탭 변경 시 폼 brand_type + tier 초기화
  const handleTabChange = (t: 'general' | 'renobel') => {
    setTab(t)
    setForm(f => ({
      ...f,
      brand_type: t,
      tier: t === 'renobel' ? '700000' : '200000',
      product_id: '',
    }))
  }

  // 등록
  const handleAdd = async () => {
    if (!form.product_id) return showToast('제품을 선택해주세요')
    setSaving(true)
    try {
      const { error } = await supabase.from('gift_items').insert({
        product_id: form.product_id,
        brand_type: form.brand_type,
        tier: form.tier,
        stock: form.stock,
        is_active: true,
      })
      if (error) throw error
      showToast('등록됐어요 💜')
      setForm(f => ({ ...f, product_id: '', stock: 10 }))
      await loadData()
    } catch {
      showToast('등록 실패. 다시 시도해주세요')
    } finally {
      setSaving(false)
    }
  }

  // 재고 수정
  const handleStockUpdate = async (id: string, stock: number) => {
    await supabase.from('gift_items').update({ stock }).eq('id', id)
    setGiftItems(prev => prev.map(g => g.id === id ? { ...g, stock } : g))
  }

  // 활성화 토글
  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from('gift_items').update({ is_active: !current }).eq('id', id)
    setGiftItems(prev => prev.map(g => g.id === id ? { ...g, is_active: !current } : g))
    showToast(!current ? '활성화됐어요' : '비활성화됐어요')
  }

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('gift_items').delete().eq('id', id)
    setGiftItems(prev => prev.filter(g => g.id !== id))
    showToast('삭제됐어요')
  }

  const filtered = giftItems.filter(g => g.brand_type === tab)
  const tiers = tab === 'renobel' ? RENOBEL_TIERS : GENERAL_TIERS

  // [또또복권 제품 필터] 탭 구분 없이 전체 제품 노출
  // 르노벨 탭에서도 전 제품 선택 가능
  const filteredProducts = products

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#7B5EA7', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 13, zIndex: 9999,
        }}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ fontSize: 18, color: 'var(--color-text-primary)', marginBottom: 4 }}>
        또또복권 관리 🎴
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
        오랜 또또 / 르노벨 골든또또 상품 풀 등록 및 재고 관리
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['general', 'renobel'] as const).map(t => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: tab === t ? 'none' : '0.5px solid var(--color-border-secondary)',
              background: tab === t ? '#7B5EA7' : 'transparent',
              color: tab === t ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            {t === 'general' ? '오랜 또또 💜' : '르노벨 골든또또 ✦'}
          </button>
        ))}
      </div>

      {/* 신규 등록 폼 */}
      <div style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 14, padding: '16px', marginBottom: 20,
        border: '0.5px solid var(--color-border-tertiary)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 12 }}>
          새 상품 등록
        </div>

        {/* 제품 선택 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
            제품 선택
          </div>
          {/* ===== [제품 검색바] select → 검색 입력 + 목록 드롭다운 ===== */}
          {/* 흰 배경 + 검은 글씨로 다크모드 가독성 해결 */}
          <div style={{ position: 'relative' }}>
            <input
              type='text'
              value={productSearch}
              onChange={e => {
                setProductSearch(e.target.value)
                setShowProductList(true)
                // 검색어 바뀌면 선택 초기화
                setForm(f => ({ ...f, product_id: '' }))
              }}
              onFocus={() => setShowProductList(true)}
              placeholder='제품명 검색...'
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                border: '0.5px solid var(--color-border-secondary)',
                background: '#fff',
                color: '#111',
              }}
            />
            {/* 선택된 제품 표시 */}
            {form.product_id && (
              <div style={{
                position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 11, color: '#7B5EA7',
              }}>
                ✓ 선택됨
              </div>
            )}
            {/* 검색 결과 드롭다운 */}
            {showProductList && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, right: 0,
                background: '#fff', border: '0.5px solid #ddd',
                borderRadius: 10, zIndex: 100,
                maxHeight: 220, overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                {filteredProducts
                  .filter(p => productSearch === '' || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .slice(0, 30)
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setForm(f => ({ ...f, product_id: p.id }))
                        setProductSearch(p.name)
                        setShowProductList(false)
                      }}
                      style={{
                        padding: '10px 12px',
                        fontSize: 13,
                        color: '#111',
                        cursor: 'pointer',
                        borderBottom: '0.5px solid #f0f0f0',
                        background: form.product_id === p.id ? '#f5f0ff' : '#fff',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f0ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = form.product_id === p.id ? '#f5f0ff' : '#fff')}
                    >
                      {p.name}
                    </div>
                  ))
                }
                {filteredProducts.filter(p =>
                  productSearch === '' || p.name.toLowerCase().includes(productSearch.toLowerCase())
                ).length === 0 && (
                  <div style={{ padding: '12px', fontSize: 12, color: '#999', textAlign: 'center' }}>
                    검색 결과가 없어요
                  </div>
                )}
              </div>
            )}
          </div>
          {/* 드롭다운 외부 클릭 시 닫기 */}
          {showProductList && (
            <div
              onClick={() => setShowProductList(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            />
          )}
        </div>

        {/* 티어 + 재고 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
              티어
            </div>
            {/* ===== [티어 선택] select → 버튼 그룹 (다크모드 가독성) ===== */}
            {/* 앞으로 select 대신 버튼 그룹 사용 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tiers.map(t => (
                <button
                  key={t.value}
                  onClick={() => setForm(f => ({ ...f, tier: t.value }))}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: form.tier === t.value
                      ? 'none'
                      : '0.5px solid var(--color-border-secondary)',
                    background: form.tier === t.value ? '#7B5EA7' : '#fff',
                    color: form.tier === t.value ? '#fff' : '#333',
                    fontWeight: form.tier === t.value ? 500 : 400,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
              재고
            </div>
            <input
              type='number'
              min={0}
              value={form.stock}
              onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
                border: '0.5px solid var(--color-border-secondary)',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={saving || !form.product_id}
          style={{
            width: '100%', padding: '11px', borderRadius: 10, border: 'none',
            background: saving || !form.product_id ? 'var(--color-border-secondary)' : '#7B5EA7',
            color: '#fff', fontSize: 13, cursor: saving || !form.product_id ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '등록 중...' : '등록하기'}
        </button>
      </div>

      {/* 등록된 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0', fontSize: 13 }}>
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px 0', fontSize: 13 }}>
          등록된 상품이 없어요. 위에서 추가해보세요 💜
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => {
            const tierLabel = [...GENERAL_TIERS, ...RENOBEL_TIERS].find(t => t.value === item.tier)?.label || item.tier
            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--color-background-primary)',
                  borderRadius: 12, padding: '14px 16px',
                  border: `0.5px solid ${item.is_active ? 'var(--color-border-secondary)' : 'var(--color-border-tertiary)'}`,
                  opacity: item.is_active ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {item.product?.thumb_img && (
                    <img
                      src={item.product.thumb_img}
                      alt=''
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 3 }}>
                      {item.product?.name || '제품 없음'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {tierLabel}
                    </div>
                  </div>
                  {/* 활성화 토글 */}
                  <button
                    onClick={() => handleToggleActive(item.id, item.is_active)}
                    style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                      border: 'none',
                      background: item.is_active ? '#7B5EA7' : 'var(--color-border-secondary)',
                      color: item.is_active ? '#fff' : 'var(--color-text-secondary)',
                    }}
                  >
                    {item.is_active ? '활성' : '비활성'}
                  </button>
                </div>

                {/* 재고 인라인 수정 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>재고</div>
                  <input
                    type='number'
                    min={0}
                    value={item.stock}
                    onChange={e => handleStockUpdate(item.id, Number(e.target.value))}
                    style={{
                      width: 70, padding: '4px 8px', borderRadius: 8, fontSize: 12,
                      border: '0.5px solid var(--color-border-secondary)',
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text-primary)',
                    }}
                  />
                  <div style={{ fontSize: 11, color: item.stock === 0 ? '#ff4444' : 'var(--color-text-secondary)' }}>
                    {item.stock === 0 ? '⚠️ 재고 없음' : '개'}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      marginLeft: 'auto', fontSize: 11, padding: '4px 12px',
                      borderRadius: 20, cursor: 'pointer',
                      border: '0.5px solid var(--color-border-tertiary)',
                      background: 'transparent', color: 'var(--color-text-secondary)',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
