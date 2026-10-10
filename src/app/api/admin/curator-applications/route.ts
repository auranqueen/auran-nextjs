import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function requireAdminApi() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const svc = tryCreateAdminClient()
  if (!svc) return { res: NextResponse.json({ error: 'service_unavailable' }, { status: 500 }) }

  const appRole = (user.app_metadata as { role?: string } | undefined)?.role
  if (appRole === 'super_admin') return { svc }
  const [{ data: u }, { data: p }] = await Promise.all([
    svc.from('users').select('role').eq('auth_id', user.id).maybeSingle(),
    svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle(),
  ])
  const ur = (u as unknown as { role?: string | null } | null)?.role
  const pr = (p as unknown as { role?: string | null } | null)?.role
  if (ur !== 'admin' && pr !== 'admin') return { res: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  return { svc }
}

// [ANCHOR: admin-curator-applications-list]
export async function GET() {
  const auth = await requireAdminApi()
  if ('res' in auth) return auth.res

  const { data, error } = await auth.svc
    .from('curator_applications')
    .select('id, user_id, display_name, email, instagram, channel_url, categories, intro, portfolio_url, bank_holder, bank_name, bank_account, status, admin_note, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

// [ANCHOR: admin-curator-applications-review]
export async function POST(req: Request) {
  const auth = await requireAdminApi()
  if ('res' in auth) return auth.res
  const { svc } = auth

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown; note?: unknown }
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : ''
  const now = new Date().toISOString()

  const { data: updated, error: upErr } = await svc
    .from('curator_applications')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      admin_note: note || null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, user_id')
    .maybeSingle()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'not_pending' }, { status: 409 })

  if (action === 'approve') {
    const userId = String((updated as unknown as { user_id: string }).user_id)
    const { data: prof } = await svc.from('profiles').select('roles').eq('auth_id', userId).maybeSingle()
    const roles = (prof as unknown as { roles?: unknown } | null)?.roles
    const patch: Record<string, unknown> = { active_role: 'curator' }
    if (Array.isArray(roles) && !roles.includes('curator')) patch.roles = [...roles, 'curator']

    const { data: profRow, error: profErr } = await svc
      .from('profiles')
      .update(patch)
      .eq('auth_id', userId)
      .select('auth_id')
      .maybeSingle()
    if (profErr || !profRow) {
      await svc.from('curator_applications').update({ status: 'pending', admin_note: null, updated_at: now }).eq('id', id)
      return NextResponse.json({ error: profErr?.message || 'profile_not_found' }, { status: profErr ? 500 : 404 })
    }
  }

  return NextResponse.json({ ok: true })
}
