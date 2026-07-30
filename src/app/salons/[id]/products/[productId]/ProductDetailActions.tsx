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
  campaign?: {
    campaign_type: 'bundle' | 'gift' | 'discount'
    buy_qty: number | null
    bonus_qty: number | null
    gift_product_id: string | null
    gift_product_name: string | null
    gift_product_thumb: string | null
  } | null
}
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
export default function ProductDetailActions({ product, campaign }: Props) {
  const { addItem } = useBrandCart()
  const router = useRouter()
  const applyCampaignToCart = () => {
    if (campaign?.campaign_type === 'bundle' && campaign.buy_qty) {
      const qty = campaign.buy_qty + (campaign.bonus_qty || 0)
      addItem(product, qty)
    } else if (campaign?.campaign_type === 'gift' && campaign.gift_product_id) {
      addItem(product, 1)
      addItem(
        {
          brand_product_id: campaign.gift_product_id,
          brand_id: product.brand_id,
          salon_id: product.salon_id,
          salon_name: product.salon_name,
          name: `${campaign.gift_product_name || '증정품'} (증정)`,
          price: 0,
          thumb_img: campaign.gift_product_thumb,
          customer_toast_rate: 0,
        },
        1,
      )
    } else {
      addItem(product)
    }
  }
  const handleAddToCart = () => {
    applyCampaignToCart()
    router.push(`/salons/${product.salon_id}/cart`)
  }
  const handleBuyNow = () => {
    applyCampaignToCart()
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
