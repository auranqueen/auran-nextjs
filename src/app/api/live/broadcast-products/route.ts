import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import {
  SHOWCASE_PLAN_SLUGS,
  getOwnerLayerPeriod,
  pickLayerActiveSub,
  resolveTrialStart,
} from '@/lib/subscription/storeTrial'

export const dynamic = 'force-dynamic'

const ID_RE = /^[1-9]\d*$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EDITABLE_STATUSES = ['upcoming', 'live']
const MAX_SORT_ORDER = 2147483647
const NO_STORE = { 'Cache-Control': 'no-store' }

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

type AdminClient = NonNullable<ReturnType<typeof tryCreateAdminClient>>

type ProductRef = {
  id: string
  name: string | null
  thumb_img: string | null
  consumer_price: number | null
  status: string | null
}

type OwnerContext = {
  svc: AdminClient
  authId: string
  broadcastId: string
  brandProductId: string
}

async function resolveOwnerBroadcast(body: Record<string, unknown>, tag: string): Promise<OwnerContext | NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('not_logged_in', 401)

  const { data: me } = await supabase.from('profiles').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') return fail('owner_only', 403)

  const broadcastId = String(body.broadcast_id ?? '').trim()
  const brandProductId = typeof body.brand_product_id === 'string' ? body.brand_product_id.trim() : ''
  if (!ID_RE.test(broadcastId)) return fail('invalid_broadcast_id', 400)
  if (!UUID_RE.test(brandProductId)) return fail('invalid_brand_product_id', 400)

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  const { data: broadcast, error } = await svc
    .from('oren_live_broadcasts')
    .select('id, status')
    .eq('id', broadcastId)
    .eq('owner_id', me.id)
    .maybeSingle()
  if (error) {
    console.error(`[live/broadcast-products] ${tag} broadcast query error`, error)
    return fail('internal_error', 500)
  }
  if (!broadcast) return fail('not_found', 404)
  if (!EDITABLE_STATUSES.includes(String(broadcast.status))) return fail('broadcast_not_editable', 409)

  return { svc, authId: user.id, broadcastId, brandProductId }
}

// [ANCHOR: live-broadcast-products-get]
export async function GET(req: NextRequest) {
  const broadcastId = req.nextUrl.searchParams.get('broadcast_id')
  if (!broadcastId) return fail('missing_broadcast_id', 400)
  if (!ID_RE.test(broadcastId)) return fail('invalid_broadcast_id', 400)

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  const empty = (salonId: string | null, locked = false) =>
    NextResponse.json({ ok: true, salon_id: salonId, locked, products: [] as const }, { headers: NO_STORE })

  const { data: broadcast, error: broadcastError } = await svc
    .from('oren_live_broadcasts')
    .select('owner_id')
    .eq('id', broadcastId)
    .maybeSingle()
  if (broadcastError) {
    console.error('[live/broadcast-products] get broadcast query error', broadcastError)
    return fail('internal_error', 500)
  }
  if (!broadcast?.owner_id) return empty(null)

  // 서버에서 방송 소유자 여부 판정 (클라이언트 플래그 신뢰 금지)
  let isOwner = false
  {
    const authClient = createClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (user) {
      const { data: me } = await authClient.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
      isOwner = !!me?.id && String(me.id) === String(broadcast.owner_id)
    }
  }

  const { data: profile, error: profileError } = await svc
    .from('profiles')
    .select('auth_id')
    .eq('id', broadcast.owner_id)
    .maybeSingle()
  if (profileError) {
    console.error('[live/broadcast-products] get profile query error', profileError)
    return fail('internal_error', 500)
  }
  if (!profile?.auth_id && !isOwner) return empty(null)

  let salonId: string | null = null
  let locked = false

  if (profile?.auth_id) {
    const { data: userRow, error: userError } = await svc
      .from('users')
      .select('id, created_at, store_trial_started_at')
      .eq('auth_id', profile.auth_id)
      .maybeSingle()
    if (userError) {
      console.error('[live/broadcast-products] get user query error', userError)
      return fail('internal_error', 500)
    }
    if (userRow?.id) {
      const { data: salon, error: salonError } = await svc
        .from('salons')
        .select('id')
        .eq('owner_id', userRow.id)
        .eq('status', 'active')
        .maybeSingle()
      if (salonError) {
        console.error('[live/broadcast-products] get salon query error', salonError)
        return fail('internal_error', 500)
      }
      if (salon?.id) salonId = String(salon.id)

      const trialStart = resolveTrialStart(
        (userRow as { store_trial_started_at?: string | null }).store_trial_started_at,
        (userRow as { created_at?: string | null }).created_at,
      )
      const { data: subRows } = await svc
        .from('owner_subscriptions')
        .select('plan, started_at, expires_at, status')
        .eq('owner_id', userRow.id)
        .eq('status', 'active')
        .in('plan', [...SHOWCASE_PLAN_SLUGS])
        .order('created_at', { ascending: false })

      const showcasePeriod = getOwnerLayerPeriod({
        trialStart,
        activeSubForLayer: pickLayerActiveSub((subRows as any[]) || [], 'showcase'),
      })
      locked = showcasePeriod.phase === 'expired'
    }
  }

  // 시청자·비로그인: 살롱 없거나 쇼케이스 잠금이면 빈 목록
  if (!isOwner) {
    if (!salonId) return empty(null)
    if (locked) return empty(salonId, true)
  }

  const { data, error } = await svc
    .from('oren_live_broadcast_products')
    .select('sort_order, brand_products(id, name, thumb_img, consumer_price, status)')
    .eq('broadcast_id', broadcastId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) {
    console.error('[live/broadcast-products] get query error', error)
    return fail('internal_error', 500)
  }

  const products = (data || []).flatMap((row) => {
    const r = row as { sort_order: number; brand_products: ProductRef | ProductRef[] | null }
    const p = Array.isArray(r.brand_products) ? r.brand_products[0] : r.brand_products
    if (!p?.id || p.status !== 'active') return []
    return [{
      id: String(p.id),
      name: String(p.name || ''),
      thumb_img: p.thumb_img ? String(p.thumb_img) : null,
      consumer_price: Number.isFinite(Number(p.consumer_price)) ? Number(p.consumer_price) : null,
      sort_order: Number(r.sort_order) || 0,
    }]
  })

  // 소유자: 잠금이어도 products 채움. 시청자: 여기까지 오면 잠금 아님 → locked false
  return NextResponse.json(
    { ok: true, salon_id: salonId, locked: isOwner ? locked : false, products },
    { headers: NO_STORE },
  )
}

// [ANCHOR: live-broadcast-products-post]
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const sortOrder = body?.sort_order == null ? 0 : Number(body.sort_order)
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > MAX_SORT_ORDER) return fail('invalid_sort_order', 400)

  const ctx = await resolveOwnerBroadcast(body || {}, 'post')
  if (ctx instanceof NextResponse) return ctx
  const { svc, authId, broadcastId, brandProductId } = ctx

  const { data: userRow, error: userError } = await svc.from('users').select('id').eq('auth_id', authId).maybeSingle()
  if (userError) {
    console.error('[live/broadcast-products] post user query error', userError)
    return fail('internal_error', 500)
  }
  if (!userRow?.id) return fail('product_not_allowed', 403)

  const { data: product, error: productError } = await svc
    .from('brand_products')
    .select('id, brand_id')
    .eq('id', brandProductId)
    .eq('status', 'active')
    .maybeSingle()
  if (productError) {
    console.error('[live/broadcast-products] post product query error', productError)
    return fail('internal_error', 500)
  }
  if (!product?.brand_id) return fail('product_not_allowed', 403)

  const { data: link, error: linkError } = await svc
    .from('brand_owner_links')
    .select('id')
    .eq('owner_id', userRow.id)
    .eq('brand_id', product.brand_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (linkError) {
    console.error('[live/broadcast-products] post link query error', linkError)
    return fail('internal_error', 500)
  }
  if (!link) return fail('product_not_allowed', 403)

  const { error: insertError } = await svc
    .from('oren_live_broadcast_products')
    .insert({ broadcast_id: Number(broadcastId), brand_product_id: brandProductId, sort_order: sortOrder })
  if (insertError) {
    if (insertError.code === '23505') return fail('already_exists', 409)
    console.error('[live/broadcast-products] insert error', insertError)
    return fail('internal_error', 500)
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

// [ANCHOR: live-broadcast-products-delete]
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const ctx = await resolveOwnerBroadcast(body || {}, 'delete')
  if (ctx instanceof NextResponse) return ctx
  const { svc, broadcastId, brandProductId } = ctx

  const { error } = await svc
    .from('oren_live_broadcast_products')
    .delete()
    .eq('broadcast_id', broadcastId)
    .eq('brand_product_id', brandProductId)
  if (error) {
    console.error('[live/broadcast-products] delete error', error)
    return fail('internal_error', 500)
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
