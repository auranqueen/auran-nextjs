/** DB may use `discontinued`; UI may show as HIDDEN */
export type ProductStatus = 'pending' | 'active' | 'discontinued' | 'deleted' | 'hidden'

export interface Product {
  id: string
  name: string
  brand_id: string
  brands?: { id: string; name: string } | { id: string; name: string }[]
  thumb_img: string | null
  thumb_images?: string[] | null
  video_url?: string | null
  detail_content?: string | null
  detail_images?: string[] | null
  detail_imgs?: string[] | null
  retail_price: number
  /** 세일가 — DB에 따라 flash_sale_price 등과 매핑 */
  sale_price?: number | null
  flash_sale_price?: number | null
  is_timesale?: boolean
  is_flash_sale?: boolean
  timesale_starts_at?: string | null
  timesale_ends_at?: string | null
  flash_sale_start?: string | null
  flash_sale_end?: string | null
  status: ProductStatus | string
  earn_points_percent?: number
  earn_points?: number
  share_points?: number
  review_points_text?: number
  review_points_photo?: number
  review_points_video?: number
  description?: string | null
  created_at?: string
  category?: string | null
  [key: string]: unknown
}

export interface CartItem {
  product_id: string
  name: string
  price: number
  thumb_img: string | null
  quantity: number
  brand_name?: string
}

export interface UserCoupon {
  id: string
  user_id: string
  coupon_id: string
  issued_at: string
  used_at: string | null
  expired_at: string | null
  coupons: {
    id: string
    name: string
    code: string
    type: 'amount' | 'rate' | string
    discount_amount: number | null
    discount_rate: number | null
    min_order: number
  }
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}
