'use client'
import { useBrandCart } from '@/context/BrandCartContext'
import { useRouter } from 'next/navigation'
interface Props {
  product: {
    brand_product_id: string
    brand_id: string
    salon_id: string
    salon_name?: string
    name: string
    price: number
    thumb_img: string | null
    customer_toast_rate: number
  }
}
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
export default function ProductDetailActions({ product }: Props) {
  const { addItem } = useBrandCart()
  const router = useRouter()
  const handleAddToCart = () => {
    addItem(product)
    router.push(`/salons/${product.salon_id}/cart`)
  }
  const handleBuyNow = () => {
    addItem(product)
    router.push(`/salons/${product.salon_id}/checkout`)
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={handleAddToCart}
        style={{ flex: 1, border: `1px solid ${BORDER}`, background: 'transparent', color: '#fff', borderRadius: 12, padding: 13, fontSize: 14 }}
      >
        장바구니 담기
      </button>
      <button
        onClick={handleBuyNow}
        style={{ flex: 1, border: 'none', background: PURPLE, color: '#fff', borderRadius: 12, padding: 13, fontSize: 14 }}
      >
        바로 구매하기
      </button>
    </div>
  )
}
