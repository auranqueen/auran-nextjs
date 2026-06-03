import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/app/admin/_auth'
import { addToPurchaseAmount, autoUpgradeGrade } from '@/lib/gradeUtils'

export async function GET(req: Request) {
  try {
    const supabase = createClient()
    await requireAdmin(supabase)
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    if (!q || q.length < 2) return Response.json({ users: [] })
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'customer')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10)
    return Response.json({ users: data || [] })
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
    const claimToken = (gift as any)?.claim_token
    await supabase.from('notifications').insert({
      user_id,
      type: 'promo',
      title: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
      body: '배송지를 등록해주세요. 첫 리추얼을 보내드릴게요!',
      link_url: claimToken ? `/membership/claim/${claimToken}` : '/my/gifts',
      is_read: false,
    } as any)
    try {
      const { data: planRow } = await supabase
        .from('membership_plans')
        .select('price')
        .eq('id', plan_id)
        .maybeSingle()
      if (planRow?.price && shipments_total) {
        await addToPurchaseAmount(user_id, planRow.price * shipments_total, supabase)
      }
      await autoUpgradeGrade(user_id, supabase)
    } catch (_) {}
    return Response.json({ ok: true, membership_id: mem.id })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
