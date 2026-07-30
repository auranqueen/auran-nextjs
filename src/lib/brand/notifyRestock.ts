import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 재입고 알림 — 증가 전 재고가 0 이하였을 때만 브랜드사 명의로 원장 전체에게 자동 알림.
 * (brand_messages 재사용, 안전재고 미달 알림과 동일 패턴)
 */
export async function notifyRestockIfNeeded(
  supabase: SupabaseClient,
  params: { brandId: string; productName: string; beforeStock: number },
) {
  if (params.beforeStock > 0) return
  await supabase.from('brand_messages').insert({
    brand_id: params.brandId,
    message_type: 'auto_order',
    target_type: 'all',
    title: `🎉 ${params.productName} 재입고 완료`,
    body: `${params.productName}이(가) 다시 입고됐어요! 지금 담아보세요.`,
    send_count: 1,
  })
}
