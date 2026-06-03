import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'

export async function PATCH(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { id, tracking_no, courier } = await req.json()
    if (!id || !tracking_no || !courier) {
      return Response.json({ error: 'missing fields' }, { status: 400 })
    }
    const { error } = await supabase
      .from('membership_gifts')
      .update({
        shipping_status: 'shipped',
        tracking_no,
        courier,
        shipped_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    const { data: giftRow } = await supabase
      .from('membership_gifts')
      .select('claimed_by')
      .eq('id', id)
      .maybeSingle()
    if (giftRow?.claimed_by) {
      await supabase.from('notifications').insert({
        user_id: giftRow.claimed_by,
        type: 'promo',
        title: '선물이 발송됐어요 🚚',
        body: `${courier} ${tracking_no} · 배송이 시작됐어요 💜`,
        is_read: false,
      } as any)
    }
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
