import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

async function requireAdminViaService() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, user: null }

  const svc = tryCreateServiceClient()
  if (!svc) {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, user }
    return { ok: false as const, status: 500, user }
  }
  const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  const role = (u as { role?: string } | null)?.role || null
  if (role === 'admin' || role === 'master') return { ok: true as const, status: 200, user }

  const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  const pRole = (p as { role?: string } | null)?.role || null
  if (pRole === 'admin') return { ok: true as const, status: 200, user }

  return { ok: false as const, status: 403, user }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminViaService()
  if (!admin.ok) return NextResponse.json({ ok: false, reason: 'not_admin' }, { status: admin.status })

  const body = await req.json().catch(() => ({}))
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id : ''
  if (!brandId) return NextResponse.json({ ok: false, error: 'missing_brand_id' }, { status: 400 })

  const svc = tryCreateServiceClient()
  const db = svc || createClient()

  const { data: brand, error: bErr } = await db
    .from('brands')
    .select('id,name,user_id')
    .eq('id', brandId)
    .maybeSingle()

  if (bErr) return NextResponse.json({ ok: false, error: bErr.message }, { status: 500 })
  if (!brand) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const uid = (brand as { user_id?: string | null }).user_id
  let toEmail = ''
  if (uid) {
    const { data: urow } = await db.from('users').select('email').eq('id', uid).maybeSingle()
    toEmail = String((urow as { email?: string } | null)?.email || '').trim()
  }

  const key = process.env.RESEND_API_KEY
  if (!key || !toEmail) {
    return NextResponse.json({ ok: true, emailSent: false, skipped: !key ? 'no_resend_key' : 'no_recipient_email' })
  }

  const brandName = String((brand as { name?: string }).name || '브랜드')
  const html = `
    <p>안녕하세요,</p>
    <p>${brandName} 브랜드의 AURAN 입점 신청이 승인되었습니다.</p>
    <p>브랜드 대시보드에서 제품 등록 및 납품가 입력을 진행해 주세요.</p>
    <p><a href="https://auran.kr/dashboard/brand">대시보드 열기</a></p>
    <p style="color:#666;font-size:12px;margin-top:24px">AURAN</p>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'AURAN <onboarding@resend.dev>',
      to: [toEmail],
      subject: '[AURAN] 브랜드 입점이 승인되었습니다',
      html,
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    return NextResponse.json({ ok: false, error: 'email_send_failed', detail: t.slice(0, 200) }, { status: 502 })
  }

  return NextResponse.json({ ok: true, emailSent: true })
}
