import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })

  const q = new URL(req.url).searchParams.get('q')?.trim() || ''

  const { data: links } = await service
    .from('brand_owner_links')
    .select('brand_id')
    .eq('owner_id', me.id)
    .eq('status', 'active')
  const brandIds = (links || []).map((l) => l.brand_id).filter(Boolean)
  if (!brandIds.length) return NextResponse.json({ ok: true, products: [] })

  let query = service
    .from('brand_products')
    .select('id, name, thumb_img, consumer_price')
    .in('brand_id', brandIds)
    .eq('status', 'active')

  if (q) {
    query = query.ilike('name', `%${q}%`).limit(50)
  } else {
    query = query.order('created_at', { ascending: false }).limit(30)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: 'search_failed' }, { status: 500 })

  const products = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    thumb_img: p.thumb_img,
    price: p.consumer_price,
  }))
  return NextResponse.json({ ok: true, products })
}
