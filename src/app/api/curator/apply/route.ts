import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['스킨케어', '메이크업', '피부관리', '바디케어', '네일헤어', '에스테틱']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const optUrl = (v: unknown) => {
  const s = str(v, 500)
  return s && /^https?:\/\//i.test(s) ? s : null
}

async function getAuth() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'not_logged_in' }, { status: 401 }) }
  const svc = tryCreateAdminClient()
  if (!svc) return { res: NextResponse.json({ error: 'service_unavailable' }, { status: 500 }) }
  return { svc, user }
}

// [ANCHOR: curator-apply-status]
export async function GET() {
  const auth = await getAuth()
  if ('res' in auth) return auth.res
  const { svc, user } = auth

  const { data, error } = await svc
    .from('curator_applications')
    .select('id, status, admin_note, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ application: data ?? null, email: user.email ?? '' })
}

// [ANCHOR: curator-apply-submit]
export async function POST(req: Request) {
  const auth = await getAuth()
  if ('res' in auth) return auth.res
  const { svc, user } = auth

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  const display_name = str(body.display_name, 50)
  const email = str(body.email, 200)
  const instagram = str(body.instagram, 100).replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '') || null
  const channel_url = optUrl(body.channel_url)
  const categories = Array.isArray(body.categories)
    ? Array.from(new Set(body.categories.filter((c): c is string => typeof c === 'string' && CATEGORIES.includes(c))))
    : []
  const intro = str(body.intro, 2000)
  const portfolio_url = optUrl(body.portfolio_url)
  const bank_holder = str(body.bank_holder, 50)
  const bank_name = str(body.bank_name, 50)
  const bank_account = str(body.bank_account, 40).replace(/[^0-9-]/g, '')
  const rrn_front = str(body.rrn_front, 6)
  const rrn_back_first = str(body.rrn_back_first, 1)

  if (!display_name) return NextResponse.json({ error: 'display_name_required' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  if (categories.length === 0) return NextResponse.json({ error: 'categories_required' }, { status: 400 })
  if (intro.length < 30) return NextResponse.json({ error: 'intro_too_short' }, { status: 400 })
  if (!bank_holder || !bank_name || bank_account.replace(/-/g, '').length < 8) {
    return NextResponse.json({ error: 'invalid_bank' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(rrn_front) || !/^[1-8]$/.test(rrn_back_first)) {
    return NextResponse.json({ error: 'invalid_rrn' }, { status: 400 })
  }
  if (body.agree_terms !== true || body.agree_privacy !== true || body.agree_condition !== true) {
    return NextResponse.json({ error: 'agreements_required' }, { status: 400 })
  }

  // [ANCHOR: curator-apply-duplicate-check]
  const { count, error: dupErr } = await svc
    .from('curator_applications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['pending', 'approved'])
  if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 })
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'already_applied' }, { status: 409 })

  const { error } = await svc.from('curator_applications').insert({
    user_id: user.id,
    display_name,
    email,
    instagram,
    channel_url,
    categories,
    intro,
    portfolio_url,
    bank_holder,
    bank_name,
    bank_account,
    rrn_front,
    rrn_back_first,
    status: 'pending',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
