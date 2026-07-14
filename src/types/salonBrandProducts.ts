/** 살롱 스토어 전용 — 오렌몰 products 테이블과 무관한 shape */
export type SalonBrandProductItem = {
  id: string
  name: string
  thumb_img: string | null
  brand_id: string
  brand_name: string | null
  /** 소비자가(원). supply_price와 별개 — DB 컬럼 추가 전까지 null */
  consumer_price: number | null
}

export type SalonBrandProductsResponse = {
  salon_id: string
  locked: boolean
  lock_reason?: 'track_a_subscription' | 'showcase_subscription' | null
  products: SalonBrandProductItem[]
}
