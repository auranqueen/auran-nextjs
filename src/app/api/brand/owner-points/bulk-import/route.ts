import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { parseCsv, pickColumn } from '@/lib/csv/parseCsv'

type Body = {
  brand_id?: string
  csv?: string
  dry_run?: boolean
}

type RowResult =
  | { line: number; status: 'ok'; owner_id: string; amount: number }
  | { line: number; status: 'skipped'; reason: string; owner_id?: string }
  | { line: number; status: 'error'; reason: string }

const PROFILE_ID_KEYS = ['owner_profile_id', 'profile_id', 'owner_id']
const AMOUNT_KEYS = ['amount', 'balance', 't', 'points', 'point']
const MEMO_KEYS = ['memo', 'note', 'description', 'remark']

async function assertBrandAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  brandId: string,
) {
  const { data: member } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .eq('brand_id', brandId)
    .maybeSingle()
  if (member?.brand_id) return true

  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userPk)
    .maybeSingle()
  return Boolean(owned?.id)
}

function parseAmount(raw: string): number | null {
  const n = Math.trunc(Number(String(raw).replace(/,/g, '').trim()))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body
  const brandId = typeof body.brand_id === 'string' ? body.brand_id.trim() : ''
  const csvText = typeof body.csv === 'string' ? body.csv : ''
  const dryRun = body.dry_run === true

  if (!brandId || !csvText.trim()) {
    return NextResponse.json({ ok: false, error: 'brand_id_and_csv_required' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_missing' }, { status: 400 })

  const isAdmin = me.role === 'admin'
  if (!isAdmin && me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  if (!isAdmin) {
    const ok = await assertBrandAccess(supabase, me.id, brandId)
    if (!ok) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id, company_id')
    .eq('id', brandId)
    .maybeSingle()

  const companyId = brandRow?.company_id ? String(brandRow.company_id) : ''
  if (!companyId) {
    return NextResponse.json(
      { ok: false, error: 'company_id_not_configured', hint: '093 backfill 후 brands.company_id를 설정하세요.' },
      { status: 400 },
    )
  }

  const parsed = parseCsv(csvText)
  if (!parsed.rows.length) {
    return NextResponse.json(
      { ok: false, error: 'invalid_csv', parse_errors: parsed.errors },
      { status: 400 },
    )
  }

  const svc = tryCreateAdminClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: activeLinks } = await svc
    .from('brand_owner_links')
    .select('owner_id')
    .eq('brand_id', brandId)
    .eq('status', 'active')

  const linkedUserIds = new Set((activeLinks || []).map((r: { owner_id: string }) => String(r.owner_id)))

  const profileIds = parsed.rows
    .map((row) => pickColumn(row, PROFILE_ID_KEYS))
    .filter((id) => isUuid(id))

  let profileToUser = new Map<string, string>()
  if (profileIds.length) {
    const uniqueIds = Array.from(new Set(profileIds))
    const { data: profiles } = await svc
      .from('profiles')
      .select('id, auth_id')
      .in('id', uniqueIds)
    const authIds = Array.from(
      new Set((profiles || []).map((p: { auth_id?: string | null }) => p?.auth_id).filter(Boolean) as string[]),
    )
    const { data: users } = authIds.length
      ? await svc.from('users').select('id, auth_id').in('auth_id', authIds)
      : { data: [] as { id: string; auth_id: string }[] }
    const authToUser = new Map((users || []).map((u: { id: string; auth_id: string }) => [u.auth_id, u.id]))
    for (const p of profiles || []) {
      if (!p?.id || !p?.auth_id) continue
      const uid = authToUser.get(p.auth_id)
      if (uid) profileToUser.set(String(p.id), String(uid))
    }
  }

  const results: RowResult[] = []
  let imported = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < parsed.rows.length; i++) {
    const line = i + 2
    const row = parsed.rows[i]
    const profileId = pickColumn(row, PROFILE_ID_KEYS)
    const amountRaw = pickColumn(row, AMOUNT_KEYS)
    const memo = pickColumn(row, MEMO_KEYS) || 'CSV 초기 적립'

    if (!profileId || !isUuid(profileId)) {
      failed++
      results.push({ line, status: 'error', reason: 'invalid_owner_profile_id' })
      continue
    }

    const amount = parseAmount(amountRaw)
    if (amount == null) {
      failed++
      results.push({ line, status: 'error', reason: 'invalid_amount' })
      continue
    }

    const userId = profileToUser.get(profileId)
    if (!userId) {
      failed++
      results.push({ line, status: 'error', reason: 'profile_or_user_not_found' })
      continue
    }

    if (!linkedUserIds.has(userId)) {
      failed++
      results.push({ line, status: 'error', reason: 'owner_not_linked_active' })
      continue
    }

    const idempotencyKey = `manual_init:${companyId}:${profileId}`

    const { data: existingLedger } = await svc
      .from('brand_owner_point_ledger')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingLedger?.id) {
      skipped++
      results.push({ line, status: 'skipped', reason: 'already_initialized', owner_id: profileId })
      continue
    }

    if (dryRun) {
      imported++
      results.push({ line, status: 'ok', owner_id: profileId, amount })
      continue
    }

    const { data: balRow } = await svc
      .from('brand_owner_point_balance')
      .select('balance')
      .eq('company_id', companyId)
      .eq('owner_id', profileId)
      .maybeSingle()

    const prevBalance = Math.trunc(Number((balRow as { balance?: number } | null)?.balance ?? 0))
    const newBalance = prevBalance + amount

    const { error: ledgerErr } = await svc.from('brand_owner_point_ledger').insert({
      company_id: companyId,
      owner_id: profileId,
      amount,
      type: 'manual_init',
      memo,
      reference_type: 'csv_bulk_import',
      reference_id: null,
      idempotency_key: idempotencyKey,
      brand_id: brandId,
      created_by: me.id,
    })

    if (ledgerErr) {
      if (ledgerErr.code === '23505') {
        skipped++
        results.push({ line, status: 'skipped', reason: 'duplicate_idempotency', owner_id: profileId })
        continue
      }
      failed++
      results.push({ line, status: 'error', reason: ledgerErr.message || 'ledger_insert_failed' })
      continue
    }

    const { error: balErr } = await svc.from('brand_owner_point_balance').upsert(
      {
        company_id: companyId,
        owner_id: profileId,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,owner_id' },
    )

    if (balErr) {
      failed++
      results.push({ line, status: 'error', reason: balErr.message || 'balance_upsert_failed' })
      continue
    }

    imported++
    results.push({ line, status: 'ok', owner_id: profileId, amount })
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    company_id: companyId,
    total_rows: parsed.rows.length,
    imported,
    skipped,
    failed,
    results,
  })
}
