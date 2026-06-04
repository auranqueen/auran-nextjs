import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { curateBundle } from '@/lib/membership/curate'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'

async function adminUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const appRole = (user.app_metadata as { role?: string } | undefined)?.role
  if (appRole === 'super_admin') return user
  const { data: u } = await supabase.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  if ((u as any)?.role === 'admin') return user
  const { data: p } = await supabase.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((p as any)?.role === 'admin') return user
  return null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin = await adminUser(supabase)
  if (!admin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const membershipId = String(body?.user_membership_id || '')
  const templateId = String(body?.bundle_template_id || '')
  const action = body?.action === 'ship' ? 'ship' : 'preview'
  const shipDate = body?.ship_date ? String(body.ship_date) : null
  const deliveryType = body?.delivery_type ? String(body.delivery_type) : 'courier'
  const courierName = body?.courier ? String(body.courier) : 'CJ대한통운'
  const trackingNo = body?.tracking_no ? String(body.tracking_no) : null
  const quickCompany = body?.quick_company ? String(body.quick_company) : null
  if (!membershipId || !templateId) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const client = tryCreateServiceClient() || supabase

  const { data: um } = await client
    .from('user_memberships')
    .select('id,user_id,shipments_total,shipments_remaining')
    .eq('id', membershipId)
    .maybeSingle()
  if (!um) return NextResponse.json({ ok: false, error: 'membership_not_found' }, { status: 404 })

  let userConcerns: string[] = []
  let userSkinType = ''
  const { data: urow } = await client.from('users').select('auth_id').eq('id', um.user_id).maybeSingle()
  if ((urow as any)?.auth_id) {
    const { data: prof } = await client
      .from('profiles')
      .select('skin_concerns,skin_type')
      .eq('auth_id', (urow as any).auth_id)
      .maybeSingle()
    userConcerns = Array.isArray((prof as any)?.skin_concerns) ? (prof as any).skin_concerns : []
    userSkinType = (prof as any)?.skin_type || ''
  }

  const { data: tpl } = await client
    .from('bundle_templates')
    .select('id,theme_name,target_phase,product_ids')
    .eq('id', templateId)
    .maybeSingle()
  if (!tpl) return NextResponse.json({ ok: false, error: 'template_not_found' }, { status: 404 })

  const scored = await curateBundle(client, {
    bundleProductIds: ((tpl as any).product_ids ?? []) as string[],
    userConcerns,
    userSkinType,
    hormonePhase: (tpl as any).target_phase || '',
    topN: 6,
  })

  if (action === 'preview') {
    return NextResponse.json({ ok: true, theme: (tpl as any).theme_name, phase: (tpl as any).target_phase, products: scored })
  }

  if ((um.shipments_remaining ?? 0) <= 0) {
    return NextResponse.json({ ok: false, error: 'no_shipments_left' }, { status: 400 })
  }
  const cycleNo = (um.shipments_total ?? 6) - (um.shipments_remaining ?? 0) + 1
  const { data: shipment, error: insErr } = await client.from('membership_shipments').insert({
    user_membership_id: um.id,
    user_id: um.user_id,
    cycle_no: cycleNo,
    bundle_template_id: (tpl as any).id,
    curated_product_ids: scored.map((s) => s.id),
    care_card: {
      reasons: Object.fromEntries(scored.map((s: any) => [s.id, s._reasons || []])),
    },
    status: '발송완료',
    shipped_at: (shipDate ? new Date(shipDate) : new Date()).toISOString(),
    delivery_type: deliveryType,
    courier: deliveryType === 'courier' ? courierName : deliveryType === 'quick' ? quickCompany : '직접전달',
    tracking_no: deliveryType === 'courier' ? trackingNo : null,
  } as any).select('id').single()
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  const remaining = (um.shipments_remaining ?? 1) - 1
  const next = new Date()
  next.setMonth(next.getMonth() + 2)
  await client
    .from('user_memberships')
    .update({
      shipments_remaining: remaining,
      next_shipment_date: remaining > 0 ? next.toISOString().slice(0, 10) : null,
      status: remaining > 0 ? 'active' : 'expired',
    })
    .eq('id', um.id)

  try {
    const shipmentId = (shipment as any)?.id
    const productNames = scored.slice(0, 3).map((p: any) => p.name).join(', ') + (scored.length > 3 ? ' 외' : '')
    await client.from('notifications').insert({
      user_id: um.user_id,
      type: 'promo',
      title: `${cycleNo}회차 리추얼이 출발했어요 💜`,
      body: productNames,
      link_url: shipmentId ? `/my/rituals/${shipmentId}` : '/my',
      is_read: false,
    } as any)
    const { data: userRow } = await client.from('users').select('phone').eq('id', um.user_id).maybeSingle()
    if ((userRow as any)?.phone) {
      await sendPpurioAlimtalk({
        phone: (userRow as any).phone,
        message: `[ORÆN PRIVÉ] ${cycleNo}회차 리추얼이 출발했어요 💜\n\n${scored.map((p: any) => p.name).join('\n')}\n\n앱에서 사용법과 원장님 팁을 확인해보세요!`,
        title: 'ORÆN PRIVÉ 리추얼 발송',
      }).catch(() => {})
    }
  } catch (_) {}

  try {
    const client3 = tryCreateServiceClient() || supabase
    const { data: chRow2 } = await client3.from('chat_channels').select('id').eq('user_id', um.user_id).eq('channel_type', 'owner').maybeSingle()
    let chId2: string | null = (chRow2 as any)?.id || null
    if (!chId2) {
      const { data: newCh2 } = await client3.from('chat_channels').insert({ user_id: um.user_id, channel_type: 'owner', title: '원장님 상담', preview_text: `${cycleNo}회차 리추얼이 출발했어요 💜`, unread_count: 1, is_online: false } as any).select('id').maybeSingle()
      chId2 = (newCh2 as any)?.id || null
    }
    if (chId2) {
      const productList = scored.slice(0, 3).map((p: any) => `· ${p.name}`).join('\n')
      await client3.from('consultation_messages').insert({
        channel_id: chId2,
        sender_id: um.user_id,
        message: `${cycleNo}회차 리추얼이 출발했어요 💜\n\n${productList}${scored.length > 3 ? '\n· 외 ' + (scored.length - 3) + '개' : ''}\n\n사용법과 원장님 팁은 앱에서 확인해보세요!\nauran.kr/my/rituals`,
        message_kind: 'text',
        is_from_customer: false,
      } as any)
      await client3.from('chat_channels').update({ last_message: `${cycleNo}회차 리추얼이 출발했어요 💜`, last_message_at: new Date().toISOString(), unread_count: 1, preview_text: `${cycleNo}회차 리추얼이 출발했어요 💜` }).eq('id', chId2)
    }
  } catch (_) {}

  return NextResponse.json({ ok: true, shipped: true, cycle_no: cycleNo, remaining })
}
