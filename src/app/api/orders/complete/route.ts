import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

/**
 * 주문 행의 earn_points를 order_items + 상품 적립% 기준으로 다시 계산해 저장합니다.
 * (관리자 보정·마이그레이션 후 동기화용)
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: urow } = await supabase.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  const { data: prow } = await supabase.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  const isAdmin =
    (urow as { role?: string } | null)?.role === 'admin' ||
    (prow as { role?: string } | null)?.role === 'admin' ||
    user.email === 'admin@auran.kr'
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const orderId = typeof body?.order_id === 'string' ? body.order_id.trim() : ''
  if (!orderId) return NextResponse.json({ ok: false, error: 'order_id_required' }, { status: 400 })

  const client = tryCreateServiceClient() || supabase
  const { data: items, error: itemsErr } = await client
    .from('order_items')
    .select('product_id,subtotal')
    .eq('order_id', orderId)
  if (itemsErr) return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 })

  const pids = Array.from(
    new Set((items || []).map((i: { product_id: string }) => i.product_id).filter(Boolean) as string[])
  )
  const { data: prods, error: pErr } = await client.from('products').select('id,earn_points').in('id', pids)
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 })

  const pmap = new Map((prods || []).map((p: { id: string; earn_points: number | null }) => [p.id, p]))
  let total = 0
  for (const it of items || []) {
    const row = it as { product_id: string; subtotal: number }
    const p = pmap.get(row.product_id) as { earn_points?: number | null } | undefined
    const pct = Math.max(0, Math.min(100, Math.floor(Number(p?.earn_points ?? 0))))
    total += Math.floor(((Number(row.subtotal) || 0) * pct) / 100)
  }

  const { error: upErr } = await client.from('orders').update({ earn_points: total }).eq('id', orderId)
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, earn_points: total })
}
