import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { assertStaffPermission } from '@/lib/brand/assertStaffPermission'

async function assertCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  companyId: string,
) {
  const { data: companyBrands } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
  const brandIds = (companyBrands || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) return { allowed: false, brandIds: [] as string[] }
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return { allowed: true, brandIds }
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return { allowed: Boolean(owned?.id), brandIds }
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const staffId = typeof body?.staff_id === 'string' ? body.staff_id.trim() : ''
  const category = typeof body?.category === 'string' ? body.category.trim() : ''
  const source = typeof body?.source === 'string' ? body.source.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const bodyHtml = typeof body?.body_html === 'string' ? body.body_html : ''
  const assetUrl =
    typeof body?.asset_url === 'string' && body.asset_url.trim() ? body.asset_url.trim() : null

  if (!companyId) return NextResponse.json({ ok: false, error: 'missing_company' }, { status: 400 })
  if (!title) return NextResponse.json({ ok: false, error: 'title_required' }, { status: 400 })
  if (!['treatment', 'material'].includes(category)) {
    return NextResponse.json({ ok: false, error: 'invalid_category' }, { status: 400 })
  }
  if (!['general', 'arete'].includes(source)) {
    return NextResponse.json({ ok: false, error: 'invalid_source' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const staffAllowed = await assertStaffPermission(supabase, staffId || null, companyId, 'marketing_create')
  if (!staffAllowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_permission' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: item, error } = await db
    .from('brand_archive_items')
    .insert({
      company_id: companyId,
      category,
      source,
      title,
      body_html: bodyHtml || '',
      asset_url: assetUrl,
      created_by_staff_id: staffId || null,
    })
    .select('*')
    .single()

  if (error || !item) {
    return NextResponse.json({ ok: false, error: error?.message || 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, item })
}