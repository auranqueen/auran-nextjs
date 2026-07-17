'use client'
import { useBrandCart } from '@/context/BrandCartContext'
import { useRouter } from 'next/navigation'
interface Props {
  product: {
    brand_product_id: string
    brand_id: string
    salon_id: string
    name: string
    price: number
    thumb_img: string | null
    customer_toast_rate: number
  }
}
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
      <button onClick={handleAddToCart}>장바구니 담기</button>
      <button onClick={handleBuyNow}>바로 구매하기</button>
    </div>
  )
}
