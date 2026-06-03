import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'

export async function PATCH(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { id, tracking_no, courier, delivery_type } = await req.json()
    if (!id || !courier) {
      return Response.json({ error: 'missing fields' }, { status: 400 })
    }
    const { error } = await supabase
      .from('membership_gifts')
      .update({
        shipping_status: 'shipped',
        delivery_type: delivery_type || 'courier',
        tracking_no: tracking_no || null,
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
        body: delivery_type === 'direct' ? '직접 전달됐어요 💜' : delivery_type === 'quick' ? `퀵으로 출발했어요 🛵 · ${courier}` : `${courier} ${tracking_no} · 출발했어요 📦`,
        is_read: false,
      } as any)
    }
    try {
      const { data: giftRow } = await supabase
        .from('membership_gifts')
        .select('shipping_phone, shipping_name, claimed_by')
        .eq('id', id)
        .maybeSingle()
      const phone = (giftRow as any)?.shipping_phone
      const name = (giftRow as any)?.shipping_name || '고객'
      if (phone) {
        const alimMsg = delivery_type === 'direct'
          ? `[ORÆN PRIVÉ] ${name}님, 리추얼이 직접 전달됐어요 💜\n소중히 사용해주세요!`
          : delivery_type === 'quick'
          ? `[ORÆN PRIVÉ] ${name}님, 리추얼이 퀵으로 출발했어요 🛵\n업체: ${courier}\n곧 도착할 예정이에요 💜`
          : `[ORÆN PRIVÉ] ${name}님, 리추얼이 출발했어요 📦\n${courier} ${tracking_no}\n배송 조회 후 수령해주세요 💜`
        await sendPpurioAlimtalk({ phone, message: alimMsg, title: 'ORÆN PRIVÉ 발송 안내' }).catch(() => {})
      }
    } catch (_) {}
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
