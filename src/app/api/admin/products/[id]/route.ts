import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminApi() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const, db: null as ReturnType<typeof tryCreateAdminClient> }

  const svc = tryCreateAdminClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as { role?: string } | null)?.role === 'admin') return { ok: true as const, db: svc }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as { role?: string } | null)?.role === 'admin') return { ok: true as const, db: svc }
  }
  if (user.email === 'admin@auran.kr') return { ok: true as const, db: svc || supabase }
  return { ok: false as const, status: 403 as const, db: null }
}

const PATCHABLE = new Set([
  'name',
  'retail_price',
  'description',
  'brand_id',
  'thumb_img',
  'storage_thumb_url',
  'thumb_images',
  'video_url',
  'detail_content',
  'detail_images',
  'detail_imgs',
  'status',
  'earn_points',
  'earn_points_percent',
  'share_points',
  'review_points_text',
  'review_points_photo',
  'review_points_video',
  'is_flash_sale',
  'is_timesale',
  'flash_sale_price',
  'flash_sale_start',
  'flash_sale_end',
  'timesale_starts_at',
  'timesale_ends_at',
  'sale_price',
])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi()
  if (!auth.ok || !auth.db) return json({ ok: false, error: 'forbidden' }, auth.status)

  const id = params.id
  if (!id) return json({ ok: false, error: 'missing_id' }, 400)

  const raw = await req.json().catch(() => ({}))
  const body: Record<string, unknown> = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (PATCHABLE.has(k)) body[k] = v
    }
  }
  if (Object.keys(body).length === 0) return json({ ok: false, error: 'no_allowed_fields' }, 400)

  const { data, error } = await auth.db.from('products').update(body).eq('id', id).select('*, brands(id, name)').maybeSingle()

  if (error) return json({ ok: false, error: error.message }, 500)
  return json({ ok: true, product: data })
}
