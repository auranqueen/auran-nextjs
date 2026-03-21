import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { broadcastCartCountRefresh } from '@/lib/cartEvents'

export type CartLine = {
  id: string
  product_id: string
  name: string
  price: number
  thumb_img: string | null
  brand_name: string
  quantity: number
}

type CartState = {
  items: CartLine[]
  bump: number
  selectedIds: Record<string, boolean>
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
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      bump: 0,
      selectedIds: {},

      setSelected: (id, v) =>
        set((s) => ({
          selectedIds: { ...s.selectedIds, [id]: v },
        })),

      setAllSelected: (v) =>
        set((s) => {
          const next: Record<string, boolean> = {}
          for (const it of s.items) next[it.id] = v
          return { selectedIds: next }
        }),

      toggleSelect: (id) =>
        set((s) => {
          const cur = s.selectedIds[id] !== false
          return { selectedIds: { ...s.selectedIds, [id]: !cur } }
        }),

      addItem: (p) => {
        const qty = Math.max(1, Math.min(99, Math.floor(p.quantity ?? 1)))
        const items = get().items
        const existing = items.find((i) => i.product_id === p.product_id)
        if (existing) {
          set({
            items: items.map((i) =>
              i.product_id === p.product_id ? { ...i, quantity: Math.min(99, i.quantity + qty) } : i
            ),
            bump: get().bump + 1,
          })
          broadcastCartCountRefresh()
          return { wasNewLine: false }
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
        set({
          items: [...items, line],
          selectedIds: { ...get().selectedIds, [line.id]: true },
          bump: get().bump + 1,
        })
        broadcastCartCountRefresh()
        return { wasNewLine: true }
      },

      setQuantity: (lineId, q) => {
        const n = Math.max(1, Math.min(99, Math.floor(q)))
        set((s) => ({
          items: s.items.map((i) => (i.id === lineId ? { ...i, quantity: n } : i)),
        }))
        broadcastCartCountRefresh()
      },

      removeLine: (lineId) => {
        set((s) => {
          const { [lineId]: _, ...rest } = s.selectedIds
          return {
            items: s.items.filter((i) => i.id !== lineId),
            selectedIds: rest,
          }
        })
        broadcastCartCountRefresh()
      },

      clear: () => {
        set({ items: [], selectedIds: {} })
        broadcastCartCountRefresh()
      },

      totalQuantity: () => get().items.reduce((a, i) => a + i.quantity, 0),

      totalForIds: (ids) => {
        const setIds = new Set(ids)
        return get()
          .items.filter((i) => setIds.has(i.id))
          .reduce((s, i) => s + i.price * i.quantity, 0)
      },

      selectedLines: () => {
        const sel = get().selectedIds
        return get().items.filter((i) => sel[i.id] !== false)
      },
    }),
    {
      name: 'auran_cart',
      partialize: (s) => ({ items: s.items, selectedIds: s.selectedIds }),
    }
  )
)
