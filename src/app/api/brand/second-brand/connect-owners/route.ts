import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { connectTrackAOwnersToSecondBrand } from '@/lib/brand/connectTrackAOwnersToSecondBrand'

type Body = {
  hub_brand_id?: string
  second_brand_id?: string
  second_brand_name?: string
}

async function assertBrandMembership(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  brandId: string,
) {
  const { data: member } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .eq('brand_id', brandId)
    .maybeSingle()

  if (member?.brand_id) return true

  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userPk)
    .maybeSingle()

  return Boolean(owned?.id)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body
  const hubBrandId = typeof body.hub_brand_id === 'string' ? body.hub_brand_id.trim() : ''
  const secondBrandId = typeof body.second_brand_id === 'string' ? body.second_brand_id.trim() : ''
  const secondBrandName = typeof body.second_brand_name === 'string' ? body.second_brand_name.trim() : ''

  if (!hubBrandId || !secondBrandId || !secondBrandName) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const [hubOk, secondOk] = await Promise.all([
    assertBrandMembership(supabase, me.id, hubBrandId),
    assertBrandMembership(supabase, me.id, secondBrandId),
  ])

  if (!hubOk || !secondOk) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  }

  try {
    const result = await connectTrackAOwnersToSecondBrand(svc, {
      hubBrandId,
      secondBrandName,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'connect_failed' },
      { status: 500 },
    )
  }
}
