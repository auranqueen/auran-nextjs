'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
export interface BrandCartItem {
  brand_product_id: string
  brand_id: string
  salon_id: string
  salon_name?: string
  name: string
  price: number
  thumb_img: string | null
  quantity: number
  customer_toast_rate: number
  /** 오렌씬 유입 추적 (optional) */
  scene_post_id?: string | null
}
interface BrandCartContextType {
  items: BrandCartItem[]
  addItem: (item: Omit<BrandCartItem, 'quantity'>, qty?: number) => void
  removeItem: (brandProductId: string) => void
  updateQuantity: (brandProductId: string, qty: number) => void
  clearCart: () => void
  subtotal: number
  itemCount: number
}
const BrandCartContext = createContext<BrandCartContextType | null>(null)
const STORAGE_KEY = 'auran_brand_cart'
export function BrandCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<BrandCartItem[]>([])
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setItems(JSON.parse(saved))
    } catch {}
  }, [])
  const persist = useCallback((next: BrandCartItem[]) => {
    setItems(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }, [])
  const addItem = useCallback((item: Omit<BrandCartItem, 'quantity'>, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.brand_product_id === item.brand_product_id)
      const next = existing
        ? prev.map(i =>
            i.brand_product_id === item.brand_product_id
              ? {
                  ...i,
                  quantity: i.quantity + qty,
                  // 새 유입 소스가 있으면 덮어씀 (오렌씬 CTA 재유입)
                  scene_post_id: item.scene_post_id ?? i.scene_post_id ?? null,
                }
              : i,
          )
        : [...prev, { ...item, quantity: qty }]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])
  const removeItem = useCallback((brandProductId: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.brand_product_id !== brandProductId)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])
  const updateQuantity = useCallback((brandProductId: string, qty: number) => {
    setItems(prev => {
      const next = qty <= 0
        ? prev.filter(i => i.brand_product_id !== brandProductId)
        : prev.map(i => i.brand_product_id === brandProductId ? { ...i, quantity: qty } : i)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])
  const clearCart = useCallback(() => persist([]), [persist])
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const itemCount = items.reduce((s, i) => s + i.quantity, 0)
  return (
    <BrandCartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, subtotal, itemCount }}>
      {children}
    </BrandCartContext.Provider>
  )
}
export function useBrandCart() {
  const ctx = useContext(BrandCartContext)
  if (!ctx) throw new Error('useBrandCart must be used within BrandCartProvider')
  return ctx
}
