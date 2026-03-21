'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { nanoid } from 'nanoid'
import { broadcastCartCountRefresh } from '@/lib/cartEvents'
import type { CartItem } from '@/types'

export type CartLine = CartItem & { id: string }

const STORAGE_KEY = 'auran_cart'

type PersistShape = {
  state: {
    items: CartLine[]
    selectedIds: Record<string, boolean>
    bump: number
  }
  version: number
}

function parsePersisted(raw: string | null): {
  items: CartLine[]
  selectedIds: Record<string, boolean>
  bump: number
} | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as PersistShape | { items?: CartLine[] }
    if (p && typeof p === 'object' && 'state' in p && p.state?.items) {
      return {
        items: p.state.items,
        selectedIds: p.state.selectedIds || {},
        bump: Number(p.state.bump || 0),
      }
    }
  } catch {}
  return null
}

type CartContextType = {
  items: CartLine[]
  selectedIds: Record<string, boolean>
  bump: number
  count: number
  total: number
  setSelected: (id: string, v: boolean) => void
  setAllSelected: (v: boolean) => void
  toggleSelect: (id: string) => void
  addItem: (p: {
    product_id: string
    name: string
    price: number
    thumb_img: string | null
    brand_name: string
    quantity?: number
  }) => { wasNewLine: boolean }
  setQuantity: (lineId: string, q: number) => void
  removeLine: (lineId: string) => void
  clear: () => void
  totalQuantity: () => number
  totalForIds: (ids: string[]) => number
  selectedLines: () => CartLine[]
  /** ProductActionBar 등 — 기존 시그니처 유지 */
  addToCart: (p: {
    product_id: string
    name: string
    price: number
    thumb_img: string
    quantity: number
  }) => void
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([])
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [bump, setBump] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = parsePersisted(localStorage.getItem(STORAGE_KEY))
    if (saved) {
      setItems(saved.items)
      setSelectedIds(saved.selectedIds)
      setBump(saved.bump)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    const payload: PersistShape = {
      state: { items, selectedIds, bump },
      version: 0,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [items, selectedIds, bump, hydrated])

  const setSelected = useCallback((id: string, v: boolean) => {
    setSelectedIds(prev => ({ ...prev, [id]: v }))
  }, [])

  const setAllSelected = useCallback((v: boolean) => {
    setItems(s => {
      const next: Record<string, boolean> = {}
      for (const it of s) next[it.id] = v
      setSelectedIds(next)
      return s
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const cur = prev[id] !== false
      return { ...prev, [id]: !cur }
    })
  }, [])

  const addItem = useCallback(
    (p: {
      product_id: string
      name: string
      price: number
      thumb_img: string | null
      brand_name: string
      quantity?: number
    }) => {
      const qty = Math.max(1, Math.min(99, Math.floor(p.quantity ?? 1)))
      let wasNewLine = true
      setItems(prev => {
        const existing = prev.find(i => i.product_id === p.product_id)
        if (existing) {
          wasNewLine = false
          const next = prev.map(i =>
            i.product_id === p.product_id
              ? { ...i, quantity: Math.min(99, i.quantity + qty) }
              : i
          )
          broadcastCartCountRefresh()
          setBump(b => b + 1)
          return next
        }
        const line: CartLine = {
          id: nanoid(),
          product_id: p.product_id,
          name: p.name,
          price: p.price,
          thumb_img: p.thumb_img,
          brand_name: p.brand_name,
          quantity: qty,
        }
        setSelectedIds(sel => ({ ...sel, [line.id]: true }))
        broadcastCartCountRefresh()
        setBump(b => b + 1)
        return [...prev, line]
      })
      return { wasNewLine }
    },
    []
  )

  const setQuantity = useCallback((lineId: string, q: number) => {
    const n = Math.max(1, Math.min(99, Math.floor(q)))
    setItems(prev => prev.map(i => (i.id === lineId ? { ...i, quantity: n } : i)))
    broadcastCartCountRefresh()
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setItems(prev => prev.filter(i => i.id !== lineId))
    setSelectedIds(prev => {
      const { [lineId]: _, ...rest } = prev
      return rest
    })
    broadcastCartCountRefresh()
  }, [])

  const clear = useCallback(() => {
    setItems([])
    setSelectedIds({})
    broadcastCartCountRefresh()
  }, [])

  const totalQuantity = useCallback(() => items.reduce((a, i) => a + i.quantity, 0), [items])

  const totalForIds = useCallback(
    (ids: string[]) => {
      const setIds = new Set(ids)
      return items.filter(i => setIds.has(i.id)).reduce((s, i) => s + i.price * i.quantity, 0)
    },
    [items]
  )

  const selectedLines = useCallback(
    () => items.filter(i => selectedIds[i.id] !== false),
    [items, selectedIds]
  )

  const addToCart = useCallback(
    (p: { product_id: string; name: string; price: number; thumb_img: string; quantity: number }) => {
      addItem({
        product_id: p.product_id,
        name: p.name,
        price: p.price,
        thumb_img: p.thumb_img || null,
        brand_name: '',
        quantity: p.quantity,
      })
    },
    [addItem]
  )

  const count = useMemo(() => items.reduce((a, i) => a + i.quantity, 0), [items])
  const total = useMemo(() => items.reduce((a, i) => a + i.price * i.quantity, 0), [items])

  const value = useMemo<CartContextType>(
    () => ({
      items,
      selectedIds,
      bump,
      count,
      total,
      setSelected,
      setAllSelected,
      toggleSelect,
      addItem,
      setQuantity,
      removeLine,
      clear,
      totalQuantity,
      totalForIds,
      selectedLines,
      addToCart,
    }),
    [
      items,
      selectedIds,
      bump,
      count,
      total,
      setSelected,
      setAllSelected,
      toggleSelect,
      addItem,
      setQuantity,
      removeLine,
      clear,
      totalQuantity,
      totalForIds,
      selectedLines,
      addToCart,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('CartProvider가 필요합니다 (root layout에 CartProvider를 추가하세요)')
  return ctx
}
