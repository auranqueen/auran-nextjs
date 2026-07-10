import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function normEmail(raw: string) {
  const t = raw.trim()
  return t.includes('@') ? t : `${t}@auran.kr`
}

function genReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

async function resolveReferrerId(svc: NonNullable<ReturnType<typeof tryCreateServiceClient>>, ref: string) {
  const code = ref.trim()
  if (!code) return null

  const { data: linkRow } = await svc
    .from('invite_links')
    .select('created_by')
    .eq('code', code)
    .maybeSingle()
  if (linkRow?.created_by) return String(linkRow.created_by)

  const { data: refUser } = await svc
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()
  return refUser?.id ? String(refUser.id) : null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const emailRaw = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const storeName = typeof body?.storeName === 'string' ? body.storeName.trim() : ''
  const area = typeof body?.area === 'string' ? body.area.trim() : ''
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  const addressDetail = typeof body?.addressDetail === 'string' ? body.addressDetail.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const ref = typeof body?.ref === 'string' ? body.ref.trim() : ''
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id.trim() : ''

  if (!emailRaw) {
    return NextResponse.json({ ok: false, error: 'missing_email', stage: 'validate' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ ok: false, error: 'invalid_password', stage: 'validate' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: 'missing_name', stage: 'validate' }, { status: 400 })
  }
  if (!storeName) {
    return NextResponse.json({ ok: false, error: 'missing_store_name', stage: 'validate' }, { status: 400 })
  }
  if (!address) {
    return NextResponse.json({ ok: false, error: 'missing_address', stage: 'validate' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return NextResponse.json(
      { ok: false, error: 'service_client_unavailable', stage: 'service_client' },
      { status: 500 },
    )
  }

  const email = normEmail(emailRaw)
  const fullAddress = [address, addressDetail].filter(Boolean).join(' ') || null
  let authUserId: string | null = null
  let publicUserId: string | null = null

  const rollbackAuth = async () => {
    if (!authUserId) return
    try {
      await svc.auth.admin.deleteUser(authUserId)
    } catch {
      /* ignore */
    }
    authUserId = null
  }

  const rollbackUsers = async () => {
    if (!publicUserId) return
    try {
      await svc.from('users').delete().eq('id', publicUserId)
    } catch {
      /* ignore */
    }
    publicUserId = null
  }

  const { data: authData, error: authError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'owner' },
  })

  if (authError || !authData.user?.id) {
    return NextResponse.json(
      { ok: false, error: authError?.message || 'auth_create_failed', stage: 'auth_create' },
      { status: 500 },
    )
  }
  authUserId = authData.user.id

  let referredBy: string | null = null
  if (ref) {
    try {
      referredBy = await resolveReferrerId(svc, ref)
    } catch {
      referredBy = null
    }
  }

  const { data: userRow, error: userError } = await svc
    .from('users')
    .insert({
      auth_id: authUserId,
      email,
      name,
      role: 'owner',
      status: 'pending',
      referred_by: referredBy,
      referral_code: genReferralCode(),
      provider: 'email',
      points: 0,
      charge_balance: 0,
    })
    .select('id')
    .single()

  if (userError || !userRow?.id) {
    await rollbackAuth()
    return NextResponse.json(
      { ok: false, error: userError?.message || 'users_insert_failed', stage: 'users' },
      { status: 500 },
    )
  }
  publicUserId = String(userRow.id)

  let profileWarning: string | undefined
  const nowIso = new Date().toISOString()
  const { error: profileError } = await svc.from('profiles').upsert(
    {
      auth_id: authUserId,
      email,
      full_name: name,
      role: 'owner',
      owner_store_name: storeName,
      has_offline_store: true,
    },
    { onConflict: 'auth_id' },
  )
  if (profileError) {
    profileWarning = profileError.message
  }

  const { error: salonError } = await svc.from('salons').insert({
    owner_id: publicUserId,
    name: storeName,
    area: area || null,
    address: fullAddress,
    phone: phone || null,
    status: 'pending',
  })

  if (salonError) {
    await rollbackUsers()
    await rollbackAuth()
    return NextResponse.json(
      { ok: false, error: salonError.message, stage: 'salons' },
      { status: 500 },
    )
  }

  let brandLinkWarning: string | undefined
  if (brandId) {
    const { data: brandRow, error: brandFetchError } = await svc
      .from('brands')
      .select('id, auto_approve_owner_invite')
      .eq('id', brandId)
      .maybeSingle()

    if (brandFetchError) {
      brandLinkWarning = brandFetchError.message
    } else if (!brandRow?.id) {
      brandLinkWarning = 'brand_not_found'
    } else {
      const autoApprove = Boolean((brandRow as { auto_approve_owner_invite?: boolean | null }).auto_approve_owner_invite)
      const linkPayload: Record<string, unknown> = {
        brand_id: brandId,
        owner_id: publicUserId,
        status: autoApprove ? 'active' : 'pending',
      }
      if (autoApprove) {
        linkPayload.approved_at = nowIso
      }

      const { error: linkError } = await svc.from('brand_owner_links').insert(linkPayload as any)
      if (linkError) {
        brandLinkWarning = linkError.message
      }
    }
  }

  return NextResponse.json({
    ok: true,
    session_created: false,
    ...(profileWarning ? { profile_warning: profileWarning } : {}),
    ...(brandLinkWarning ? { brand_link_warning: brandLinkWarning } : {}),
  })
}
