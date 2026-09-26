import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { action, query, page, pageSize, filters } = body

  if (action === 'searchUsers') {
    const { data, error } = await svc
      .from('users')
      .select('id, auth_id, name')
      .ilike('name', `%${query}%`)
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data || [] })
  }

  if (action === 'load') {
    const { nameIds, sourceType, dateFrom, dateTo } = filters || {}
    const size = Number(pageSize) || 50
    const pageIdx = Number(page) || 0

    // 현재 로그인 관리자 users.id (조정 버튼용)
    const { data: adminRow } = await svc
      .from('users')
      .select('id, role')
      .eq('auth_id', user.id)
      .maybeSingle()
    const adminId = adminRow?.id || null

    let listQ = svc
      .from('toast_transactions')
      .select(
        'id, user_id, amount, transaction_type, source_type, source_id, reference_id, created_at, note, admin_id, status, balance_after, users!toast_transactions_user_id_fkey(name, origin_track)',
        { count: 'exact' }
      )
    if (dateFrom) listQ = listQ.gte('created_at', dateFrom)
    if (dateTo) listQ = listQ.lte('created_at', dateTo)
    if (sourceType) listQ = listQ.eq('source_type', sourceType)
    if (nameIds?.length) listQ = listQ.in('user_id', nameIds)

    const rangeFrom = pageIdx * size
    const rangeTo = rangeFrom + size - 1
    const { data: txList, count, error: listErr } = await listQ
      .order('created_at', { ascending: false })
      .range(rangeFrom, rangeTo)
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    let sumQ = svc.from('toast_transactions').select('amount, user_id')
    if (dateFrom) sumQ = sumQ.gte('created_at', dateFrom)
    if (dateTo) sumQ = sumQ.lte('created_at', dateTo)
    if (sourceType) sumQ = sumQ.eq('source_type', sourceType)
    if (nameIds?.length) sumQ = sumQ.in('user_id', nameIds)
    const { data: sumRows, error: sumErr } = await sumQ.limit(10000)
    if (sumErr) return NextResponse.json({ error: sumErr.message }, { status: 500 })
    const total = ((sumRows as { amount?: number | null }[]) || []).reduce(
      (acc, r) => acc + (Number(r.amount) || 0),
      0
    )

    // join에 이름이 없는 user_id 보정
    const pickName = (users: any) => {
      if (!users) return null
      if (Array.isArray(users)) return users[0] || null
      return users
    }
    const list = (txList || []) as any[]
    const missing = new Set<string>()
    list.forEach((r) => {
      if (!pickName(r.users)?.name && r.user_id) missing.add(String(r.user_id))
    })
    const nameByUserId: Record<string, string> = {}
    if (missing.size) {
      const ids = Array.from(missing)
      const { data: byId } = await svc.from('users').select('id, auth_id, name, origin_track').in('id', ids)
      ;((byId as { id: string; name?: string | null }[]) || []).forEach((u) => {
        if (u.id && u.name) nameByUserId[String(u.id)] = String(u.name)
      })
      const left = ids.filter((id) => !nameByUserId[id])
      if (left.length) {
        const { data: byAuth } = await svc.from('users').select('id, auth_id, name, origin_track').in('auth_id', left)
        ;((byAuth as { auth_id: string; name?: string | null }[]) || []).forEach((u) => {
          if (u.auth_id && u.name) nameByUserId[String(u.auth_id)] = String(u.name)
        })
      }
    }

    return NextResponse.json({
      items: list,
      count: count || 0,
      total,
      adminId,
      nameByUserId,
    })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
