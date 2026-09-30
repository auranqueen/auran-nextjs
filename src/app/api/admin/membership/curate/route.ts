import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { curateBundle } from '@/lib/membership/curate'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'
import { getRitualShipmentMessage } from '@/lib/membershipMessage'

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

function toScheduledIso(dateStr: string): string {
  const d = String(dateStr || '').slice(0, 10)
  if (!d) return ''
  return new Date(`${d}T12:00:00`).toISOString()
}

function cycleScheduledDateStr(startedAt: string | null | undefined, cycleNo: number): string | null {
  if (!startedAt || cycleNo < 1) return null
  const raw = String(startedAt)
  const base = new Date(raw.length >= 10 ? `${raw.slice(0, 10)}T12:00:00` : raw)
  if (Number.isNaN(base.getTime())) return null
  const d = new Date(base)
  d.setDate(d.getDate() + (cycleNo - 1) * 30)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const admin = await adminUser(supabase)
  if (!admin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const type = req.nextUrl.searchParams.get('type')
  const client = tryCreateServiceClient() || supabase

  // type=shipments&ids=id1,id2,...
  if (type === 'shipments') {
    const idsRaw = req.nextUrl.searchParams.get('ids') || ''
    const ids = idsRaw.split(',').filter(Boolean)
    if (!ids.length) return NextResponse.json({ ok: true, data: [] })
    const { data, error } = await client
      .from('membership_shipments')
      .select('id, user_membership_id, cycle_no, status, shipped_at, scheduled_at')
      .in('user_membership_id', ids)
      .order('cycle_no', { ascending: true })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  // type=tomorrow&date=YYYY-MM-DD
  if (type === 'tomorrow') {
    const dateStr = req.nextUrl.searchParams.get('date') || ''
    if (!dateStr) return NextResponse.json({ ok: true, names: [] })
    const dayStart = `${dateStr}T00:00:00.000Z`
    const dayAfterDate = new Date(dateStr)
    dayAfterDate.setDate(dayAfterDate.getDate() + 1)
    const dayEnd = dayAfterDate.toISOString().slice(0, 10) + 'T00:00:00.000Z'
    const [{ data: dueRows }, { data: firstDue }] = await Promise.all([
      client.from('membership_shipments').select('id, scheduled_at, user_membership_id, users(name)').gte('scheduled_at', dayStart).lt('scheduled_at', dayEnd),
      client.from('user_memberships').select('id, next_shipment_date, shipments_total, shipments_remaining, users(name)').eq('status', 'active').eq('next_shipment_date', dateStr).gt('shipments_remaining', 0),
    ])
    const names: string[] = []
    const seen = new Set<string>()
    for (const row of dueRows || []) {
      const name = (Array.isArray((row as any).users) ? (row as any).users[0] : (row as any).users)?.name || '회원'
      const key = `s:${(row as any).user_membership_id}:${name}`
      if (!seen.has(key)) { seen.add(key); names.push(name) }
    }
    for (const row of firstDue || []) {
      const completed = ((row as any).shipments_total || 0) - ((row as any).shipments_remaining || 0)
      if (completed > 0) continue
      const name = (Array.isArray((row as any).users) ? (row as any).users[0] : (row as any).users)?.name || '회원'
      const key = `m:${(row as any).id}:${name}`
      if (!seen.has(key)) { seen.add(key); names.push(name) }
    }
    return NextResponse.json({ ok: true, names })
  }

  // type=templates
  if (type === 'templates') {
    const { data, error } = await client
      .from('bundle_templates')
      .select('id,theme_name,target_phase,product_ids,usage_guide,owner_tip,is_active,display_order,target_gender')
      .order('display_order', { ascending: true })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  // type=product_search&q=...
  if (type === 'product_search') {
    const q = req.nextUrl.searchParams.get('q') || ''
    if (q.length < 2) return NextResponse.json({ ok: true, data: [] })
    const { data, error } = await client.from('products').select('id,name').ilike('name', `%${q}%`).limit(8)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  if (type !== 'history') {
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
  }

  const { data, error } = await client
    .from('membership_shipments')
    .select('id, cycle_no, status, shipped_at, delivery_type, courier, tracking_no, users(name), bundle_templates(theme_name)')
    .eq('status', '발송완료')
    .order('shipped_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const rows = (data || []) as { shipped_at?: string | null }[]
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthCount = rows.filter((r) => String(r.shipped_at || '').slice(0, 7) === monthKey).length

  return NextResponse.json({
    ok: true,
    total: rows.length,
    month_count: monthCount,
    rows,
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin = await adminUser(supabase)
  if (!admin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const client = tryCreateServiceClient() || supabase

  const actionRaw = String(body?.action || '')
  if (actionRaw === 'save_tpl') {
    const tplId = String(body?.id || '')
    if (!tplId) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    const { error } = await client.from('bundle_templates').update({
      theme_name: body.theme_name,
      target_phase: body.target_phase ?? null,
      product_ids: body.product_ids ?? [],
      usage_guide: body.usage_guide ?? null,
      owner_tip: body.owner_tip ?? null,
      is_active: body.is_active ?? true,
      target_gender: body.target_gender || 'all',
    }).eq('id', tplId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (actionRaw === 'add_tpl') {
    const { count } = await client.from('bundle_templates').select('id', { count: 'exact', head: true })
    const { data, error } = await client.from('bundle_templates').insert({ theme_name: '새 리추얼', product_ids: [], is_active: true, display_order: (count ?? 0) + 1 } as any).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }
  if (actionRaw === 'delete_tpl') {
    const tplId = String(body?.id || '')
    if (!tplId) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    const { error } = await client.from('bundle_templates').delete().eq('id', tplId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const membershipId = String(body?.user_membership_id || '')
  const templateId = String(body?.bundle_template_id || '')
  const action = actionRaw === 'ship' ? 'ship' : 'preview'
  const nextShipmentDate = body?.next_shipment_date ? String(body.next_shipment_date).slice(0, 10) : null
  const scheduledDatesRaw = Array.isArray(body?.scheduled_dates) ? body.scheduled_dates : []
  const deliveryType = body?.delivery_type ? String(body.delivery_type) : 'courier'
  const courierName = body?.courier ? String(body.courier) : 'CJ대한통운'
  const trackingNo = body?.tracking_no ? String(body.tracking_no) : null
  const quickCompany = body?.quick_company ? String(body.quick_company) : null
  if (!membershipId || !templateId) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const { data: um } = await client
    .from('user_memberships')
    .select('id,user_id,shipments_total,shipments_remaining,started_at')
    .eq('id', membershipId)
    .maybeSingle()
  if (!um) return NextResponse.json({ ok: false, error: 'membership_not_found' }, { status: 404 })

  let userConcerns: string[] = []
  let userSkinType = ''
  let userGender = ''
  const { data: urow } = await client.from('users').select('auth_id').eq('id', um.user_id).maybeSingle()
  if ((urow as any)?.auth_id) {
    const { data: prof } = await client
      .from('profiles')
      .select('skin_concerns,skin_type,gender')
      .eq('auth_id', (urow as any).auth_id)
      .maybeSingle()
    userConcerns = Array.isArray((prof as any)?.skin_concerns) ? (prof as any).skin_concerns : []
    userSkinType = (prof as any)?.skin_type || ''
    userGender = String((prof as any)?.gender || '')
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
  const shippedAt = new Date()
  const remaining = (um.shipments_remaining ?? 1) - 1
  const startedAt = (um as { started_at?: string | null }).started_at
  const overrideMap = new Map<number, string>()
  for (const item of scheduledDatesRaw) {
    const cn = Number((item as { cycle_no?: number })?.cycle_no)
    const dateStr = String((item as { date?: string; scheduled_at?: string })?.date || (item as { scheduled_at?: string })?.scheduled_at || '').slice(0, 10)
    if (cn && dateStr) overrideMap.set(cn, dateStr)
  }
  const nextCycle = cycleNo + 1
  const nextDateStr = remaining > 0
    ? (nextShipmentDate || overrideMap.get(nextCycle) || cycleScheduledDateStr(startedAt, nextCycle))
    : null
  const nextScheduledIso = nextDateStr ? toScheduledIso(nextDateStr) : null
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
    shipped_at: shippedAt.toISOString(),
    delivery_type: deliveryType,
    courier: deliveryType === 'courier' ? courierName : deliveryType === 'quick' ? quickCompany : '직접전달',
    tracking_no: deliveryType === 'courier' ? trackingNo : null,
  } as any).select('id').single()
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  const totalCycles = um.shipments_total ?? 6
  for (let cn = cycleNo + 1; cn <= totalCycles; cn++) {
    const dateStr = overrideMap.get(cn) || cycleScheduledDateStr(startedAt, cn)
    if (!dateStr) continue
    const schedIso = toScheduledIso(dateStr)
    const { data: exRow } = await client
      .from('membership_shipments')
      .select('id, status')
      .eq('user_membership_id', um.id)
      .eq('cycle_no', cn)
      .maybeSingle()
    if ((exRow as { status?: string })?.status === '발송완료') continue
    if ((exRow as { id?: string })?.id) {
      await client
        .from('membership_shipments')
        .update({ scheduled_at: schedIso, status: '예정' } as Record<string, unknown>)
        .eq('id', (exRow as { id: string }).id)
    } else {
      await client.from('membership_shipments').insert({
        user_membership_id: um.id,
        user_id: um.user_id,
        cycle_no: cn,
        status: '예정',
        scheduled_at: schedIso,
      } as Record<string, unknown>)
    }
  }

  await client
    .from('user_memberships')
    .update({
      shipments_remaining: remaining,
      next_shipment_date: nextDateStr,
      scheduled_at: nextScheduledIso,
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
      let ritualTrack = 'general'
      if (userGender === 'male') {
        ritualTrack = 'male'
      } else if ((urow as any)?.auth_id) {
        const { data: hcRitual } = await client3.from('hormone_cycle').select('track').eq('auth_id', (urow as any).auth_id).maybeSingle()
        if ((hcRitual as any)?.track) ritualTrack = String((hcRitual as any).track)
      }
      const ritualMsg = await getRitualShipmentMessage(
        ritualTrack,
        cycleNo,
        scored.map((p: any) => ({ name: String(p.name || '') })),
      )
      await client3.from('consultation_messages').insert({
        channel_id: chId2,
        sender_id: um.user_id,
        message: ritualMsg,
        message_kind: 'text',
        is_from_customer: false,
      } as any)
      await client3.from('chat_channels').update({ last_message: `${cycleNo}회차 리추얼이 출발했어요 💜`, last_message_at: new Date().toISOString(), unread_count: 1, preview_text: `${cycleNo}회차 리추얼이 출발했어요 💜` }).eq('id', chId2)
    }
  } catch (_) {}

  const { data: freshShipments } = await client
    .from('membership_shipments')
    .select('id, user_membership_id, cycle_no, status, shipped_at, scheduled_at')
    .eq('user_membership_id', um.id)
    .order('cycle_no', { ascending: true })

  return NextResponse.json({
    ok: true,
    shipped: true,
    cycle_no: cycleNo,
    remaining,
    next_shipment_date: nextDateStr,
    scheduled_at: nextScheduledIso,
    shipments: freshShipments || [],
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const admin = await adminUser(supabase)
  if (!admin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action === 'update_schedule' ? 'update_schedule' : 'update_schedule'
  if (action !== 'update_schedule') {
    return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
  }

  const membershipId = String(body?.user_membership_id || '')
  const cycleNo = Number(body?.cycle_no)
  const dateStr = body?.scheduled_at ? String(body.scheduled_at).slice(0, 10) : ''
  if (!membershipId || !cycleNo || !dateStr) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const client = tryCreateServiceClient() || supabase
  const { data: um } = await client
    .from('user_memberships')
    .select('id,user_id,shipments_total,shipments_remaining')
    .eq('id', membershipId)
    .maybeSingle()
  if (!um) return NextResponse.json({ ok: false, error: 'membership_not_found' }, { status: 404 })

  const completed = (um.shipments_total ?? 6) - (um.shipments_remaining ?? 0)
  if (cycleNo <= completed) {
    return NextResponse.json({ ok: false, error: 'cycle_already_shipped' }, { status: 400 })
  }

  const schedIso = toScheduledIso(dateStr)
  const { data: exRow } = await client
    .from('membership_shipments')
    .select('id, status')
    .eq('user_membership_id', membershipId)
    .eq('cycle_no', cycleNo)
    .maybeSingle()
  if ((exRow as { status?: string })?.status === '발송완료') {
    return NextResponse.json({ ok: false, error: 'cycle_already_shipped' }, { status: 400 })
  }
  if ((exRow as { id?: string })?.id) {
    const { error: updErr } = await client
      .from('membership_shipments')
      .update({ scheduled_at: schedIso, status: '예정' } as Record<string, unknown>)
      .eq('id', (exRow as { id: string }).id)
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 })
  } else {
    const { error: insErr } = await client.from('membership_shipments').insert({
      user_membership_id: um.id,
      user_id: um.user_id,
      cycle_no: cycleNo,
      status: '예정',
      scheduled_at: schedIso,
    } as Record<string, unknown>)
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: schedRows } = await client
    .from('membership_shipments')
    .select('cycle_no, scheduled_at, status')
    .eq('user_membership_id', membershipId)
    .neq('status', '발송완료')
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })

  const upcoming = (schedRows || []).filter((r) => {
    const d = String((r as { scheduled_at?: string }).scheduled_at || '').slice(0, 10)
    return d >= todayStr && Number((r as { cycle_no?: number }).cycle_no) > completed
  })
  const nextDateStr = upcoming.length
    ? String((upcoming[0] as { scheduled_at: string }).scheduled_at).slice(0, 10)
    : dateStr
  const nextScheduledIso = toScheduledIso(nextDateStr)

  await client
    .from('user_memberships')
    .update({ next_shipment_date: nextDateStr, scheduled_at: nextScheduledIso })
    .eq('id', membershipId)

  const { data: freshShipments2 } = await client
    .from('membership_shipments')
    .select('id, user_membership_id, cycle_no, status, shipped_at, scheduled_at')
    .eq('user_membership_id', membershipId)
    .order('cycle_no', { ascending: true })

  return NextResponse.json({
    ok: true,
    cycle_no: cycleNo,
    scheduled_at: schedIso,
    next_shipment_date: nextDateStr,
    shipments: freshShipments2 || [],
  })
}
