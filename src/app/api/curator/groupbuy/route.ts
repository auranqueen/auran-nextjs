import { NextResponse } from 'next/server'
import { requireCurator } from '../_auth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const dateOrNull = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v : null)

const STATUSES = ['pending', 'approved', 'rejected'] as const

export async function GET(req: Request) {
  const auth = await requireCurator()
  if ('res' in auth) return auth.res

  // [ANCHOR: groupbuy-status-counts]
  if (new URL(req.url).searchParams.get('type') === 'status') {
    const results = await Promise.all(
      STATUSES.map(status =>
        auth.svc
          .from('group_buy_requests')
          .select('id', { count: 'exact', head: true })
          .eq('requester_id', auth.userId)
          .eq('status', status),
      ),
    )
    const failed = results.find(r => r.error)
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
    const [pending, approved, rejected] = results.map(r => r.count ?? 0)
    return NextResponse.json({ pending, approved, rejected })
  }

  const { data, error } = await auth.svc
    .from('products')
    .select('id, name, retail_price, thumb_img')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await requireCurator()
  if ('res' in auth) return auth.res
  const { svc, userId } = auth

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const productId = typeof body.product_id === 'string' ? body.product_id.trim() : ''
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: 'invalid_product' }, { status: 400 })

  const startAt = dateOrNull(body.desired_start_at)
  const endAt = dateOrNull(body.desired_end_at)
  if (startAt && endAt && endAt < startAt) return NextResponse.json({ error: 'invalid_period' }, { status: 400 })

  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim().slice(0, 2000) : null

  const { data: product } = await svc.from('products').select('id').eq('id', productId).eq('is_active', true).maybeSingle()
  if (!product) return NextResponse.json({ error: 'invalid_product' }, { status: 404 })

  // [ANCHOR: groupbuy-duplicate-check]
  const { data: dup } = await svc
    .from('group_buy_requests')
    .select('id')
    .eq('requester_id', userId)
    .eq('product_id', productId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (dup) return NextResponse.json({ error: 'already_requested' }, { status: 409 })

  const { error } = await svc.from('group_buy_requests').insert({
    requester_id: userId,
    product_id: productId,
    message,
    desired_start_at: startAt,
    desired_end_at: endAt,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
