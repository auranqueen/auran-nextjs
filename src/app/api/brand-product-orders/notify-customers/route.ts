import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const { data: salon } = await service.from('salons').select('id, name').eq('owner_id', me.id).maybeSingle()
  if (!salon) return NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 404 })
  const { data: subscribers } = await service
    .from('brand_product_salon_subscribers')
    .select('customer_id')
    .eq('salon_id', salon.id)
  const customerIds = Array.from(new Set((subscribers || []).map(s => s.customer_id)))
  const cooldownStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentNotif } = await service
    .from('notifications')
    .select('id')
    .eq('link_url', `/salons/${salon.id}/products`)
    .eq('type', 'promo')
    .gte('created_at', cooldownStart)
    .limit(1)
    .maybeSingle()
  if (recentNotif) {
    return NextResponse.json({ ok: false, error: 'cooldown_active' }, { status: 429 })
  }
  if (customerIds.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 })
  }
  const { error } = await service.from('notifications').insert(
    customerIds.map(customerId => ({
      user_id: customerId,
      type: 'promo',
      title: `${salon.name} 새 추천 제품이 떴어요`,
      body: '스토어알림받기 설정한 분들께 보내드려요',
      link_url: `/salons/${salon.id}/products`,
      is_read: false,
    }))
  )
  if (error) return NextResponse.json({ ok: false, error: 'notify_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, notified: customerIds.length })
}
