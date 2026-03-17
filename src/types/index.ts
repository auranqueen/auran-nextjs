// src/types/index.ts
// ============================================================
// AURAN Platform - TypeScript Types
// ============================================================

export type UserRole = 'customer' | 'partner' | 'owner' | 'brand' | 'admin'
export type OrderStatus = '주문확인' | '발송준비' | '배송중' | '배송완료' | '취소' | '환불'
export type SettlementStatus = '정산대기' | '정산완료' | '보류'
export type RefundStatus = '요청' | '승인' | '완료' | '거절'
export type ReviewStatus = '대기' | '게시' | '숨김' | '삭제'
export type PlanType = 'basic' | 'pro' | 'premium'
export type StoreGrade = 'none' | 'basic' | 'silver' | 'gold'
export type PartnerGrade = 'rookie' | 'silver' | 'gold' | 'platinum'

// ── 사용자
export interface User {
  id: string
  auth_id: string
  email: string
  name: string
  phone?: string
  birthday?: string
  age_group?: string
  role: UserRole
  provider: string
  status: string
  avatar_url?: string
  // 고객
  skin_type?: string
  skin_concerns?: string[]
  // 파트너
  partner_grade?: PartnerGrade
  commission_rate?: number
  referral_code?: string
  referred_by?: string
  // 원장님
  salon_name?: string
  salon_area?: string
  plan?: PlanType
  store_grade?: StoreGrade
  store_commission?: number
  plan_expires_at?: string
  auto_renew?: boolean
  // 브랜드사
  brand_name?: string
  brand_origin?: string
  brand_status?: string
  supply_rate?: number
  biz_no?: string
  // 지갑
  points: number
  charge_balance: number
  total_orders?: number
  invite_count?: number
  created_at: string
  updated_at: string
  last_login_at?: string
}

// ── 브랜드
export interface Brand {
  id: string
  user_id: string
  name: string
  origin?: string
  description?: string
  logo_url?: string
  supply_rate: number
  min_order: number
  contact?: string
  biz_no?: string
  status: string
  approved_at?: string
  created_at: string
}

// ── 제품
export interface Product {
  id: string
  brand_id: string
  brand?: Brand
  name: string
  description?: string
  ingredient?: string
  detail_html?: string
  retail_price: number
  supply_price: number
  stock: number
  thumb_img?: string
  detail_imgs?: string[]
  icon?: string
  tag?: string
  category?: string
  skin_types?: string[]
  age_groups?: string[]
  quiz_match?: string[]
  status: string
  sales_count: number
  review_count: number
  avg_rating: number
  created_at: string
}

// ── 주문
export interface Order {
  id: string
  order_no: string
  customer_id: string
  customer?: User
  status: OrderStatus
  total_amount: number
  point_used: number
  charge_used: number
  coupon_discount: number
  final_amount: number
  earn_points: number
  points_awarded: boolean
  tracking_no?: string
  courier?: string
  recipient_name?: string
  recipient_phone?: string
  address?: string
  partner_id?: string
  partner_commission?: number
  owner_id?: string
  owner_commission?: number
  ordered_at: string
  shipped_at?: string
  delivered_at?: string
  ship_notified: boolean
  delivery_notified: boolean
  items?: OrderItem[]
}

// ── 주문 아이템
export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product?: Product
  brand_id?: string
  brand?: Brand
  product_name: string
  product_price: number
  quantity: number
  subtotal: number
}

// ── 환불
export interface Refund {
  id: string
  order_id: string
  order?: Order
  customer_id: string
  customer?: User
  amount: number
  reason?: string
  status: RefundStatus
  is_partial: boolean
  partial_items?: any
  approved_by?: string
  approved_at?: string
  memo?: string
  created_at: string
}

// ── 정산
export interface Settlement {
  id: string
  target_id: string
  target?: User
  target_role: UserRole
  target_name?: string
  amount: number
  platform_fee: number
  net_amount: number
  period_start: string
  period_end: string
  status: SettlementStatus
  order_ids?: string[]
  approved_by?: string
  approved_at?: string
  paid_at?: string
  memo?: string
  created_at: string
}

// ── 쿠폰
export interface Coupon {
  id: string
  code: string
  name: string
  type: 'rate' | 'amount'
  discount_rate?: number
  discount_amount?: number
  min_order: number
  max_discount?: number
  start_at?: string
  end_at?: string
  usage_limit?: number
  used_count: number
  brand_ids?: string[]
  product_ids?: string[]
  is_active: boolean
  created_at: string
}

// ── 리뷰
export interface Review {
  id: string
  author_id: string
  author?: User
  review_type: 'product' | 'salon' | 'owner'
  target_id: string
  rating: number
  content?: string
  images?: string[]
  status: ReviewStatus
  report_count: number
  order_id?: string
  created_at: string
}

// ── 커뮤니티 포스트
export interface Post {
  id: string
  author_id: string
  author?: User
  category: string
  title: string
  content: string
  images?: string[]
  video_url?: string
  skin_type?: string
  like_count: number
  comment_count: number
  view_count: number
  report_count: number
  is_hidden: boolean
  created_at: string
}

// ── 알림
export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body?: string
  icon?: string
  is_read: boolean
  data?: any
  created_at: string
}

// ── 포인트 내역
export interface PointHistory {
  id: string
  user_id: string
  type: 'earn' | 'use' | 'expire' | 'admin'
  amount: number
  balance: number
  description?: string
  icon?: string
  order_id?: string
  created_at: string
}

// ── 충전 플랜
export interface ChargePlan {
  id: string
  label: string
  amount: number
  bonus: number
  pct: number
  is_popular: boolean
  is_active: boolean
  sort_order: number
}

// ── 초대 링크
export interface InviteLink {
  id: string
  created_by?: string
  role: UserRole
  code: string
  note?: string
  url: string
  used_count: number
  is_active: boolean
  created_at: string
}

// ── 살롱
export interface Salon {
  id: string
  owner_id: string
  owner?: User
  name: string
  description?: string
  area?: string
  address?: string
  phone?: string
  banner_url?: string
  services?: any[]
  open_hours?: any
  status: string
  review_count: number
  avg_rating: number
  monthly_sales: number
  created_at: string
}

// ── 납품 프로모션
export interface SupplyPromo {
  id: string
  brand_id: string
  brand?: Brand
  product_id?: string
  product_name?: string
  promo_type: 'bundle' | 'qty_price' | 'discount'
  title: string
  condition?: string
  bonus?: string
  qty?: number
  bonus_qty?: number
  total_price?: number
  discount_pct?: number
  start_date?: string
  end_date?: string
  status: string
  created_at: string
}

// ── API 응답 래퍼
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// ── 페이지네이션
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// ── 어드민 대시보드 통계
export interface DashboardStats {
  totalMembers: number
  totalRevenue: number
  totalOrders: number
  totalReviews: number
  totalPosts: number
  pendingShipments: number
  pendingBrandApprovals: number
  pendingProductApprovals: number
  pendingSettlements: number
  pendingRefunds: number
  monthlyRevenue: number
  monthlyOrders: number
  monthlyGrowthRate: number
  customerCount: number
  partnerCount: number
  ownerCount: number
  brandCount: number
}

// ── 유입 분석
export interface TrafficStats {
  source: string
  signups: number
  purchases: number
  revenue: number
}

// ── 피부 분석 통계
export interface SkinStats {
  skinType: string
  count: number
  percentage: number
}
