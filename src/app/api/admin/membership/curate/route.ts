import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { curateBundle } from '@/lib/membership/curate'

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
  const { error: insErr } = await client.from('membership_shipments').insert({
    user_membership_id: um.id,
    user_id: um.user_id,
    cycle_no: cycleNo,
    bundle_template_id: (tpl as any).id,
    curated_product_ids: scored.map((s) => s.id),
    status: '발송완료',
    shipped_at: new Date().toISOString(),
  } as any)
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

  return NextResponse.json({ ok: true, shipped: true, cycle_no: cycleNo, remaining })
}
