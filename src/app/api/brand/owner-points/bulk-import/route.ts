import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { normalizeStoreNameKey, type OwnerPointCsvRow } from '@/lib/csv/parseCsv'

type Body = {
  brand_id?: string
  rows?: OwnerPointCsvRow[]
  dry_run?: boolean
  import_batch_id?: string
}

type OwnerCandidate = {
  profile_id: string
  user_id: string
  full_name: string
  store_name: string
}

type RowReport = {
  line: number
  store_name: string
  amount: number
  memo: string | null
  status: 'success' | 'failed' | 'conflict'
  profile_id?: string
  owner_name?: string
  matched_store_name?: string
  candidates?: Array<{ profile_id: string; full_name: string; store_name: string }>
  error?: string
}

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

async function loadCompanyOwnerMap(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>,
  companyId: string,
): Promise<Map<string, OwnerCandidate[]>> {
  const { data: companyBrands } = await admin
    .from('brands')
    .select('id')
    .eq('company_id', companyId)

  const brandIds = (companyBrands || []).map((b) => b.id).filter(Boolean)
  if (!brandIds.length) return new Map()

  const { data: links } = await admin
    .from('brand_owner_links')
    .select('owner_id')
    .in('brand_id', brandIds)
    .eq('status', 'active')

  const userIds = Array.from(new Set((links || []).map((l) => l.owner_id).filter(Boolean)))
  if (!userIds.length) return new Map()

  const { data: users } = await admin
    .from('users')
    .select('id, auth_id')
    .in('id', userIds)
    .eq('origin_track', 'A')
    .eq('role', 'owner')

  const trackAUsers = (users || []).filter((u) => u.auth_id)
  const authIds = trackAUsers.map((u) => u.auth_id as string)
  if (!authIds.length) return new Map()

  const authToUserId = new Map(trackAUsers.map((u) => [u.auth_id as string, u.id as string]))

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, auth_id, full_name, owner_store_name')
    .in('auth_id', authIds)

  const map = new Map<string, OwnerCandidate[]>()

  for (const p of profiles || []) {
    const authId = p.auth_id as string | null
    const profileId = p.id as string
    const userId = authId ? authToUserId.get(authId) : undefined
    if (!userId) continue

    const store_name = String(p.owner_store_name || '').trim()
    const key = normalizeStoreNameKey(store_name)
    if (!key) continue

    const candidate: OwnerCandidate = {
      profile_id: profileId,
      user_id: userId,
      full_name: String(p.full_name || '이름 없음'),
      store_name,
    }

    const list = map.get(key) || []
    if (!list.some((x) => x.profile_id === profileId)) {
      list.push(candidate)
      map.set(key, list)
    }
  }

  return map
}

function classifyRows(
  rows: OwnerPointCsvRow[],
  ownerMap: Map<string, OwnerCandidate[]>,
): RowReport[] {
  return rows.map((row) => {
    const base = {
      line: row.line,
      store_name: row.store_name,
      amount: row.amount,
      memo: row.memo,
    }

    if (!row.store_name.trim()) {
      return { ...base, status: 'failed' as const, error: '매장명이 비어 있습니다.' }
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      return { ...base, status: 'failed' as const, error: '금액은 1 이상의 정수여야 합니다.' }
    }

    const key = normalizeStoreNameKey(row.store_name)
    const candidates = ownerMap.get(key) || []

    if (candidates.length === 0) {
      return { ...base, status: 'failed' as const, error: '매칭되는 원장이 없습니다.' }
    }

    if (candidates.length > 1) {
      return {
        ...base,
        status: 'conflict' as const,
        error: '동일 매장명 원장이 2명 이상입니다.',
        candidates: candidates.map((c) => ({
          profile_id: c.profile_id,
          full_name: c.full_name,
          store_name: c.store_name,
        })),
      }
    }

    const matched = candidates[0]
    return {
      ...base,
      status: 'success' as const,
      profile_id: matched.profile_id,
      owner_name: matched.full_name,
      matched_store_name: matched.store_name,
    }
  })
}

async function applySuccessRow(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>,
  params: {
    companyId: string
    brandId: string
    createdBy: string
    importBatchId: string
    row: RowReport
  },
): Promise<'inserted' | 'skipped' | 'failed'> {
  const { companyId, brandId, createdBy, importBatchId, row } = params
  if (row.status !== 'success' || !row.profile_id) return 'failed'

  const idempotencyKey = `manual_init:${companyId}:${row.profile_id}:${importBatchId}:${row.line}`

  const { data: existing } = await admin
    .from('brand_owner_point_ledger')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing?.id) return 'skipped'

  const { data: balanceRow } = await admin
    .from('brand_owner_point_balance')
    .select('balance')
    .eq('company_id', companyId)
    .eq('owner_id', row.profile_id)
    .maybeSingle()

  const prevBalance = Math.trunc(Number(balanceRow?.balance) || 0)
  const nextBalance = prevBalance + row.amount

  const { error: ledgerError } = await admin.from('brand_owner_point_ledger').insert({
    company_id: companyId,
    owner_id: row.profile_id,
    amount: row.amount,
    type: 'manual_init',
    memo: row.memo,
    reference_type: 'manual',
    idempotency_key: idempotencyKey,
    brand_id: brandId,
    created_by: createdBy,
  })

  if (ledgerError) {
    if (ledgerError.code === '23505') return 'skipped'
    throw new Error(ledgerError.message)
  }

  const { error: balanceError } = await admin.from('brand_owner_point_balance').upsert(
    {
      company_id: companyId,
      owner_id: row.profile_id,
      balance: nextBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,owner_id' },
  )

  if (balanceError) {
    throw new Error(balanceError.message)
  }

  return 'inserted'
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body
  const brandId = typeof body.brand_id === 'string' ? body.brand_id.trim() : ''
  const rows = Array.isArray(body.rows) ? body.rows : []
  const dryRun = body.dry_run !== false
  const importBatchId = typeof body.import_batch_id === 'string' && body.import_batch_id.trim()
    ? body.import_batch_id.trim()
    : crypto.randomUUID()

  if (!brandId) {
    return NextResponse.json({ ok: false, error: 'missing_brand_id' }, { status: 400 })
  }
  if (!rows.length) {
    return NextResponse.json({ ok: false, error: 'missing_rows' }, { status: 400 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const allowed = await assertBrandAccess(supabase, me.id, brandId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_brand' }, { status: 403 })
  }

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id, company_id')
    .eq('id', brandId)
    .maybeSingle()

  if (!brandRow?.id) {
    return NextResponse.json({ ok: false, error: 'brand_not_found' }, { status: 404 })
  }
  if (!brandRow.company_id) {
    return NextResponse.json({ ok: false, error: 'missing_company_id' }, { status: 400 })
  }

  const admin = tryCreateAdminClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'service_role_unavailable' }, { status: 500 })
  }

  const ownerMap = await loadCompanyOwnerMap(admin, brandRow.company_id)
  const report = classifyRows(rows, ownerMap)

  const summary = {
    total: report.length,
    success: report.filter((r) => r.status === 'success').length,
    failed: report.filter((r) => r.status === 'failed').length,
    conflict: report.filter((r) => r.status === 'conflict').length,
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      import_batch_id: importBatchId,
      company_id: brandRow.company_id,
      summary,
      rows: report,
    })
  }

  let inserted = 0
  let skipped = 0
  let applyFailed = 0

  for (const row of report) {
    if (row.status !== 'success') continue
    try {
      const result = await applySuccessRow(admin, {
        companyId: brandRow.company_id,
        brandId: brandRow.id,
        createdBy: me.id,
        importBatchId,
        row,
      })
      if (result === 'inserted') inserted++
      else if (result === 'skipped') skipped++
      else applyFailed++
    } catch (e) {
      applyFailed++
      row.status = 'failed'
      row.error = e instanceof Error ? e.message : '적용 실패'
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: false,
    import_batch_id: importBatchId,
    company_id: brandRow.company_id,
    summary: {
      ...summary,
      inserted,
      skipped,
      apply_failed: applyFailed,
    },
    rows: report,
  })
}
