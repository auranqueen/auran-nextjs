/** POST /api/admin/coupons/issue · POST /api/admin/coupons (action: issue) 응답 */

export type AdminCouponIssuedPayload = {
  id: string
  user_id: string
  coupon_id: string
  issued_at: string
}

export type AdminCouponIssueSuccess = {
  ok?: boolean
  success: true
  issued: AdminCouponIssuedPayload
}

export type AdminCouponIssueErrorCode =
  | 'already_issued'
  | 'user_not_found'
  | 'service_role_unconfigured'
  | 'issue_limit_reached'
  | 'coupon_not_found'
  | 'missing_fields'
  | string

export type AdminCouponIssueError = {
  ok?: boolean
  success: false
  error: AdminCouponIssueErrorCode
  message?: string
}
