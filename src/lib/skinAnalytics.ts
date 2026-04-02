import type { SupabaseClient } from '@supabase/supabase-js'

/** 비로그인 시 호출해도 no-op */
export async function logUserBehavior(
  sb: SupabaseClient,
  authId: string | null | undefined,
  action_type: string,
  target_id?: string | null,
  metadata?: Record<string, unknown>
) {
  if (!authId) return
  try {
    await sb.from('user_behavior_logs').insert({
      auth_id: authId,
      action_type,
      target_id: target_id ?? null,
      metadata: metadata && Object.keys(metadata).length > 0 ? metadata : {},
    } as any)
  } catch {
    /* ignore */
  }
}

export async function upsertSkinCycleDaily(
  sb: SupabaseClient,
  authId: string,
  row: {
    record_date: string
    cycle_day: number
    hormone_stage: string
    checkin_condition: string
    recommended_products: string[]
  }
) {
  if (!authId) return
  try {
    await sb
      .from('skin_cycle_analysis')
      .upsert(
        {
          auth_id: authId,
          record_date: row.record_date,
          cycle_day: row.cycle_day,
          hormone_stage: row.hormone_stage,
          checkin_condition: row.checkin_condition,
          recommended_products: row.recommended_products,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'auth_id,record_date' }
      )
  } catch {
    /* ignore */
  }
}

export async function appendSkinCyclePurchased(
  sb: SupabaseClient,
  authId: string,
  recordDate: string,
  productIds: string[]
) {
  if (!authId || !productIds.length) return
  try {
    const { data } = await sb
      .from('skin_cycle_analysis')
      .select('purchased_products')
      .eq('auth_id', authId)
      .eq('record_date', recordDate)
      .maybeSingle()
    const prev = Array.isArray((data as any)?.purchased_products)
      ? (data as any).purchased_products.map((x: any) => String(x))
      : []
    const merged = Array.from(new Set([...prev, ...productIds.map(String)]))
    await sb
      .from('skin_cycle_analysis')
      .update({ purchased_products: merged, updated_at: new Date().toISOString() } as any)
      .eq('auth_id', authId)
      .eq('record_date', recordDate)
  } catch {
    /* ignore */
  }
}

/** App 라우트 pathname → page_view 메타.page */
export function pathnameToPageViewKey(pathname: string): string | null {
  const p = pathname || ''
  if (p === '/' || p === '') return 'home'
  if (p === '/products' || p.startsWith('/products?')) return 'product_list'
  if (/^\/products\/[^/]+/.test(p)) return 'product_detail'
  if (p === '/my' || p.startsWith('/my/')) return 'my'
  if (p === '/community' || p.startsWith('/community/')) return 'community'
  if (p.startsWith('/dashboard/customer/community')) return 'community'
  if (p.startsWith('/brands/')) return 'product_list'
  return null
}
