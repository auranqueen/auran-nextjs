import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import { addToPurchaseAmount, autoUpgradeGrade } from '@/lib/gradeUtils'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    if (!q || q.length < 2) return Response.json({ users: [] })
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, user_memberships(status, shipments_remaining, shipments_total)')
      .eq('role', 'customer')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10)
    const users = (data || []).map((row) => {
      const memberships = Array.isArray((row as { user_memberships?: unknown }).user_memberships)
        ? (row as { user_memberships: { status?: string; shipments_remaining?: number; shipments_total?: number }[] }).user_memberships
        : (row as { user_memberships?: { status?: string; shipments_remaining?: number; shipments_total?: number } | null }).user_memberships
          ? [(row as { user_memberships: { status?: string; shipments_remaining?: number; shipments_total?: number } }).user_memberships]
          : []
      const membership = memberships.find((m) => m.status === 'active') || memberships[0]
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        ...(membership ? {
          status: membership.status,
          shipments_remaining: membership.shipments_remaining,
          shipments_total: membership.shipments_total,
        } : {}),
      }
    })
    return Response.json({ users })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { user_id, plan_id, shipments_total, next_shipment_date, memo, user_name } = await req.json()
    if (!user_id || !plan_id || !shipments_total || !next_shipment_date) {
      return Response.json({ error: 'missing fields' }, { status: 400 })
    }
    if (user_name) {
      await supabase.from('users').update({ name: user_name }).eq('id', user_id)
    }
    const { data: mem, error: memErr } = await supabase
      .from('user_memberships')
      .insert({
        user_id,
        plan_id,
        status: 'active',
        shipments_total,
        shipments_remaining: shipments_total,
        next_shipment_date,
        source_type: 'manual',
      })
      .select('id')
      .single()
    if (memErr || !mem) return Response.json({ error: memErr?.message || 'membership insert failed' }, { status: 500 })
    const { data: gift } = await supabase
      .from('membership_gifts')
      .insert({
        plan_id,
        gifted_by: user_id,
        amount: 0,
        status: 'paid',
        source_type: 'manual',
        claimed_by: user_id,
        message: memo || null,
        sender_name: '어드민 수동 등록',
        shipping_status: 'pending',
      } as any)
      .select('id, claim_token')
      .single()
    // 배송지 등록 여부 확인
    const { data: addrRow } = await supabase
      .from('shipping_addresses')
      .select('id')
      .eq('user_id', user_id)
      .eq('is_default', true)
      .maybeSingle()
    const hasAddress = !!addrRow
    const notifyBody = hasAddress
      ? `첫 배송일은 ${next_shipment_date}입니다. 오랜이 정성껏 준비할게요 💜`
      : `배송지를 등록해주세요. 첫 리추얼을 보내드릴게요!`
    const notifyLink = hasAddress ? '/my' : '/my/addresses'
    await supabase.from('notifications').insert({
      user_id,
      type: 'promo',
      title: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
      body: notifyBody,
      link_url: notifyLink,
      is_read: false,
    } as any)
    // 알림톡 발송
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('phone, name')
        .eq('id', user_id)
        .maybeSingle()
      if ((userRow as any)?.phone) {
        const name = (userRow as any)?.name || '고객'
        const msg = hasAddress
          ? `[ORÆN PRIVÉ] ${name}님, 멤버십이 시작됐어요 💜\n\n첫 배송일: ${next_shipment_date}\n오랜이 정성껏 리추얼을 준비할게요.`
          : `[ORÆN PRIVÉ] ${name}님, 멤버십이 시작됐어요 💜\n\n배송지를 등록해주세요:\nhttps://auran.kr/my/addresses`
        await sendPpurioAlimtalk({
          phone: (userRow as any).phone,
          message: msg,
          title: 'ORÆN PRIVÉ 멤버십 시작',
        }).catch(() => {})
      }
      // 상담톡 안내 메시지 발송
      const { data: channelRow } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('user_id', user_id)
        .eq('channel_type', 'owner')
        .maybeSingle()
      let channelId = (channelRow as any)?.id
      if (!channelId) {
        const { data: newCh } = await supabase
          .from('chat_channels')
          .insert({
            user_id,
            channel_type: 'owner',
            title: '원장님 상담',
            preview_text: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
            unread_count: 1,
            is_online: false,
          } as any)
          .select('id')
          .maybeSingle()
        channelId = (newCh as any)?.id
      }
      if (channelId) {
        const chatMsg = hasAddress
          ? `안녕하세요 💜 ORÆN PRIVÉ 멤버십이 시작됐어요!\n\n첫 배송일은 ${next_shipment_date}입니다.\n오랜이 정성껏 리추얼을 준비할게요.\n\n궁금한 점은 언제든 말씀해주세요 🌙`
          : `안녕하세요 💜 ORÆN PRIVÉ 멤버십이 시작됐어요!\n\n배송지를 등록해주세요:\nauran.kr/my/addresses\n\n등록 완료 후 첫 리추얼을 보내드릴게요 🌙`
        await supabase.from('consultation_messages').insert({
          channel_id: channelId,
          sender_id: user_id,
          message: chatMsg,
          message_kind: 'text',
          is_from_customer: false,
        } as any)
        await supabase
          .from('chat_channels')
          .update({
            last_message: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
            last_message_at: new Date().toISOString(),
            unread_count: 1,
            preview_text: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
          })
          .eq('id', channelId)
      }
    } catch (_) {}
    try {
      const { data: planRow } = await supabase
        .from('membership_plans')
        .select('price')
        .eq('id', plan_id)
        .maybeSingle()
      if (planRow?.price && shipments_total) {
        await addToPurchaseAmount(user_id, planRow.price, supabase)
      }
      await autoUpgradeGrade(user_id, supabase)
    } catch (_) {}
    return Response.json({ ok: true, membership_id: mem.id })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
