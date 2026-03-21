import type { SupabaseClient } from '@supabase/supabase-js'
import type { IssueBulkRow } from '@/lib/admin/issueCouponsBulk'

export async function insertCouponCampaignRecord(
  svc: SupabaseClient,
  params: {
    coupon_id: string
    campaign_name: string
    issued_by: string
    results: IssueBulkRow[]
    target_count: number
  }
) {
  const success_count = params.results.filter((r) => r.status === 'success').length
  const duplicate_count = params.results.filter((r) => r.status === 'already_issued').length
  const failed_count = params.results.filter((r) => r.status === 'error' || r.status === 'user_not_found').length

  const { error } = await svc.from('coupon_campaigns').insert({
    coupon_id: params.coupon_id,
    campaign_name: params.campaign_name,
    target_count: params.target_count,
    success_count,
    duplicate_count,
    failed_count,
    results: params.results as unknown as Record<string, unknown>,
    issued_by: params.issued_by,
    issued_at: new Date().toISOString(),
  } as any)

  if (error) console.warn('[coupon_campaigns]', error.message)
}
