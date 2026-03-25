/** benefit_settings 행 (key-value) */
export type BenefitSettingRow = {
  setting_key: string
  setting_value: number | string | null
}

/** profiles에서 혜택 계산에 사용하는 필드 */
export type ProfileBenefitFields = {
  point: number | null
  total_purchase_amount: number | null
  grade: string | null
}

/** grade_settings 행 */
export type GradeSettingRow = {
  id?: string
  grade_order: number
  min_amount: number
  invite_only?: boolean | null
  discount_rate: number | null
  [key: string]: unknown
}

/** product_benefit_overrides 행 */
export type ProductBenefitOverrideRow = {
  id?: string
  target_type: 'product' | 'brand' | string
  target_id: string
  is_sale_item?: boolean | null
  purchase_point_rate?: number | null
  review_photo_rate?: number | null
  review_video_rate?: number | null
  share_point_rate?: number | null
  exclude_share_point?: boolean | null
  [key: string]: unknown
}

export type CalculateBenefitsParams = {
  userId: string
  productId?: string
  brandId?: string
  price: number
  isSaleItem?: boolean
  supabase: any
}

export type CalculateBenefitsResult = {
  userGrade: GradeSettingRow | undefined
  discountRate: number
  discountAmount: number
  finalPrice: number
  purchasePointRate: number
  purchasePoints: number
  chargePointRate: number
  chargePoints: number
  reviewPhotoRate: number
  reviewPhotoPoints: number
  reviewVideoRate: number
  reviewVideoPoints: number
  sharePointRate: number
  sharePoints: number
  totalPoints: number
  isOnSale: boolean
}

function toNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}

export async function calculateBenefits({
  userId,
  productId,
  brandId,
  price,
  isSaleItem = false,
  supabase,
}: CalculateBenefitsParams): Promise<CalculateBenefitsResult> {
  // 1. benefit_settings에서 기본값 로드
  const { data: settings } = await supabase
    .from('benefit_settings')
    .select('setting_key, setting_value')

  const settingsMap: Record<string, number> = {}
  ;(settings as BenefitSettingRow[] | null | undefined)?.forEach((s) => {
    settingsMap[s.setting_key] = toNumber(s.setting_value, 0)
  })

  // 2. 유저 등급 로드 (profiles에서 grade 컬럼 또는 누적금액으로 계산)
  const { data: profile } = await supabase
    .from('profiles')
    .select('point, total_purchase_amount, grade')
    .eq('id', userId)
    .single()

  const p = profile as ProfileBenefitFields | null

  // 3. grade_settings에서 등급 혜택 로드
  const { data: gradeData } = await supabase
    .from('grade_settings')
    .select('*')
    .order('grade_order', { ascending: true })

  const grades = (gradeData as GradeSettingRow[] | null | undefined) ?? []

  // 유저 등급 매칭 (total_purchase_amount 기준)
  let userGrade: GradeSettingRow | undefined = grades[0] // 기본 PETAL
  if (p?.total_purchase_amount != null) {
    for (const g of grades) {
      if (!g.invite_only && p.total_purchase_amount >= g.min_amount) {
        userGrade = g
      }
    }
  }

  // 4. 제품/브랜드 오버라이드 확인
  let override: ProductBenefitOverrideRow | null = null
  if (productId) {
    const { data } = await supabase
      .from('product_benefit_overrides')
      .select('*')
      .eq('target_type', 'product')
      .eq('target_id', productId)
      .single()
    override = data as ProductBenefitOverrideRow | null
  }
  if (!override && brandId) {
    const { data } = await supabase
      .from('product_benefit_overrides')
      .select('*')
      .eq('target_type', 'brand')
      .eq('target_id', brandId)
      .single()
    override = data as ProductBenefitOverrideRow | null
  }

  // 5. 세일 상품 여부
  const isOnSale = isSaleItem || Boolean(override?.is_sale_item)

  // 6. 최종 혜택 계산
  const discountRate = toNumber(userGrade?.discount_rate, 0)
  const discountAmount = Math.floor((price * discountRate) / 100)
  const finalPrice = price - discountAmount

  const purchasePointRate = isOnSale
    ? 0
    : toNumber(
        override?.purchase_point_rate ??
          settingsMap['purchase_point_rate'] ??
          3,
        3
      )
  const purchasePoints = Math.floor((finalPrice * purchasePointRate) / 100)

  const chargePointRate = toNumber(
    settingsMap['charge_point_rate'] ?? 1,
    1
  )
  const chargePoints = Math.floor((finalPrice * chargePointRate) / 100)

  const reviewPhotoRate = toNumber(
    override?.review_photo_rate ??
      settingsMap['review_photo_rate'] ??
      3,
    3
  )
  const reviewPhotoPoints = Math.floor((finalPrice * reviewPhotoRate) / 100)

  const reviewVideoRate = toNumber(
    override?.review_video_rate ??
      settingsMap['review_video_rate'] ??
      5,
    5
  )
  const reviewVideoPoints = Math.floor((finalPrice * reviewVideoRate) / 100)

  const sharePointRate =
    isOnSale || override?.exclude_share_point
      ? 0
      : toNumber(
          override?.share_point_rate ?? settingsMap['share_point_rate'] ?? 5,
          5
        )
  const sharePoints = Math.floor((finalPrice * sharePointRate) / 100)

  return {
    userGrade,
    discountRate,
    discountAmount,
    finalPrice,
    purchasePointRate,
    purchasePoints,
    chargePointRate,
    chargePoints,
    reviewPhotoRate,
    reviewPhotoPoints,
    reviewVideoRate,
    reviewVideoPoints,
    sharePointRate,
    sharePoints,
    totalPoints: purchasePoints + chargePoints,
    isOnSale,
  }
}
