'use client'
import { useState, useMemo } from 'react'
import { useBrandCart } from '@/context/BrandCartContext'
import { useRouter } from 'next/navigation'
export default function BrandCartPage() {
  const { items, updateQuantity, removeItem } = useBrandCart()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set(items.map(i => i.brand_product_id)))
  const bySalon = useMemo(() => {
    const map: Record<string, { salon_name: string; items: typeof items }> = {}
    for (const item of items) {
      if (!map[item.salon_id]) map[item.salon_id] = { salon_name: item.salon_name || '살롱', items: [] }
      map[item.salon_id].items.push(item)
    }
    return map
  }, [items])
  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleSalon = (salonId: string) => {
    const salonItemIds = bySalon[salonId].items.map(i => i.brand_product_id)
    const allSelected = salonItemIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      salonItemIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }
  const selectedItems = items.filter(i => selected.has(i.brand_product_id))
  const selectedTotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const goCheckout = () => {
    if (selectedItems.length === 0) return
    sessionStorage.setItem('auran_brand_checkout_selection', JSON.stringify(Array.from(selected)))
    router.push('/salons/checkout')
  }
  if (items.length === 0) {
    return <div>장바구니가 비어있어요</div>
  }
  return (
    <div>
      {Object.entries(bySalon).map(([salonId, group]) => {
        const salonItemIds = group.items.map(i => i.brand_product_id)
        const allSelected = salonItemIds.every(id => selected.has(id))
        return (
          <div key={salonId} style={{ marginBottom: 20 }}>
            <div>
              <input type="checkbox" checked={allSelected} onChange={() => toggleSalon(salonId)} />
              <span>{group.salon_name}</span>
            </div>
            {group.items.map(item => (
              <div key={item.brand_product_id}>
                <input
                  type="checkbox"
                  checked={selected.has(item.brand_product_id)}
                  onChange={() => toggleItem(item.brand_product_id)}
                />
                <span>{item.name}</span>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateQuantity(item.brand_product_id, Number(e.target.value))}
                />
                <span>{(item.price * item.quantity).toLocaleString()}원</span>
                <button onClick={() => removeItem(item.brand_product_id)}>삭제</button>
              </div>
            ))}
          </div>
        )
      })}
      <div>선택 {selectedItems.length}개 · 합계 {selectedTotal.toLocaleString()}원</div>
      <button onClick={goCheckout} disabled={selectedItems.length === 0}>
        선택상품 결제하기
      </button>
    </div>
  )
}
