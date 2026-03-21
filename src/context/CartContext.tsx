'use client'

import { useCartStore } from '@/stores/cartStore'

/**
 * 장바구니 액션용 훅 (zustand 단일 소스). Provider 불필요.
 * ProductActionBar 등에서 addToCart 시그니처를 고정하기 위해 둠.
 */
export function useCart() {
  const addItem = useCartStore(s => s.addItem)
  return {
    addToCart: (p: {
      product_id: string
      name: string
      price: number
      thumb_img: string
      quantity: number
    }) => {
      addItem({
        product_id: p.product_id,
        name: p.name,
        price: p.price,
        thumb_img: p.thumb_img || null,
        brand_name: '',
        quantity: p.quantity,
      })
    },
  }
}
