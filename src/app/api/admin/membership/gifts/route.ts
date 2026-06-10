import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'

export async function PATCH(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { id, tracking_no, courier, delivery_type, gift_type_id } = await req.json()
    if (!id || !courier) {
      return Response.json({ error: 'missing fields' }, { status: 400 })
    }
    let giftTypeName = '선물'
    if (gift_type_id) {
      const { data: gtRow } = await supabase.from('gift_types').select('name').eq('id', gift_type_id).maybeSingle()
      if ((gtRow as any)?.name) giftTypeName = String((gtRow as any).name)
    }
    const { error } = await supabase
      .from('membership_gifts')
      .update({
        shipping_status: 'shipped',
        delivery_type: delivery_type || 'courier',
        tracking_no: tracking_no || null,
        courier,
        shipped_at: new Date().toISOString(),
        ...(gift_type_id ? { gift_type_id } : {}),
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
          ? `[ORÆN PRIVÉ] ${name}님, ${giftTypeName} 선물이 직접 전달됐어요 💜\n소중히 사용해주세요!`
          : delivery_type === 'quick'
          ? `[ORÆN PRIVÉ] ${name}님, ${giftTypeName} 선물이 퀵으로 출발했어요 🛵\n업체: ${courier}\n곧 도착할 예정이에요 💜`
          : `[ORÆN PRIVÉ] ${name}님, ${giftTypeName} 선물이 출발했어요 📦\n${courier} ${tracking_no}\n배송 조회 후 수령해주세요 💜`
        await sendPpurioAlimtalk({ phone, message: alimMsg, title: 'ORÆN PRIVÉ 발송 안내' }).catch(() => {})
      }
    } catch (_) {}
    try {
      const { data: giftRow2 } = await supabase.from('membership_gifts').select('claimed_by, shipping_name').eq('id', id).maybeSingle()
      const claimedBy = (giftRow2 as any)?.claimed_by
      const shipName = (giftRow2 as any)?.shipping_name || '고객'
      if (claimedBy) {
        const { data: chRow3 } = await supabase.from('chat_channels').select('id').eq('user_id', claimedBy).eq('channel_type', 'owner').maybeSingle()
        let chId3: string | null = (chRow3 as any)?.id || null
        if (!chId3) {
          const { data: newCh3 } = await supabase.from('chat_channels').insert({ user_id: claimedBy, channel_type: 'owner', title: '원장님 상담', preview_text: '선물이 출발했어요 💜', unread_count: 1, is_online: false } as any).select('id').maybeSingle()
          chId3 = (newCh3 as any)?.id || null
        }
        if (chId3) {
          const delivMsg = delivery_type === 'direct'
            ? `${shipName}님, ${giftTypeName} 선물이 직접 전달됐어요 💜\n소중히 사용해주세요!`
            : delivery_type === 'quick'
            ? `${shipName}님, ${giftTypeName} 선물이 퀵으로 출발했어요 🛵\n업체: ${courier}\n곧 도착할 예정이에요 💜`
            : `${shipName}님, ${giftTypeName} 선물이 출발했어요 💜\n${courier} ${tracking_no}\n배송 조회 후 수령해주세요 💜`
          const previewLine = `${giftTypeName} 선물이 출발했어요 💜`
          await supabase.from('consultation_messages').insert({ channel_id: chId3, sender_id: claimedBy, message: delivMsg, message_kind: 'text', is_from_customer: false } as any)
          await supabase.from('chat_channels').update({ last_message: previewLine, last_message_at: new Date().toISOString(), unread_count: 1, preview_text: previewLine }).eq('id', chId3)
        }
      }
    } catch (_) {}
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
