import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import {
  parseCsv,
  pickColumn,
  normalizeStoreNameKey,
  matchByStoreNameKey,
} from '@/lib/csv/parseCsv'

type Body = {
  brand_id?: string
  csv?: string
  dry_run?: boolean
}

type EligibleOwner = {
  profileId: string
  userId: string
  ownerStoreName: string
  ownerName: string
  storeKey: string
}

type RowResult = {
  line: number
  store_name: string
  amount?: number
  status: 'ok' | 'skipped' | 'no_match' | 'conflict' | 'error'
  reason?: string
  owner_id?: string
  matched_owner_name?: string
  matched_store_name?: string
  conflict_owners?: { profile_id: string; owner_store_name: string; owner_name: string }[]
}

const STORE_NAME_KEYS = [
  'store_name',
  'owner_store_name',
  'salon_name',
  'salon',
  '매장명',
  '살롱명',
  '상호',
  '상호명',
]
const AMOUNT_KEYS = ['amount', 'balance', 't', 'points', 'point', '금액', '적립금']
const MEMO_KEYS = ['memo', 'note', 'description', 'remark', '메모', '비고']

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

async function loadEligibleOwners(
  svc: NonNullable<ReturnType<typeof tryCreateAdminClient>>,
  brandId: string,
): Promise<{ index: Map<string, EligibleOwner[]>; eligibleCount: number }> {
  const { data: activeLinks } = await svc
    .from('brand_owner_links')
    .select('owner_id')
    .eq('brand_id', brandId)
    .eq('status', 'active')

  const linkedUserIds = Array.from(
    new Set((activeLinks || []).map((r: { owner_id: string }) => String(r.owner_id)).filter(Boolean)),
  )
  if (!linkedUserIds.length) {
    return { index: new Map(), eligibleCount: 0 }
  }

  const { data: trackAUsers } = await svc
    .from('users')
    .select('id, auth_id')
    .in('id', linkedUserIds)
    .eq('role', 'owner')
    .eq('origin_track', 'A')

  const users = trackAUsers || []
  if (!users.length) {
    return { index: new Map(), eligibleCount: 0 }
  }

  const authIds = Array.from(new Set(users.map((u: { auth_id: string }) => u.auth_id).filter(Boolean)))
  const userByAuth = new Map(users.map((u: { id: string; auth_id: string }) => [u.auth_id, u.id]))

  const { data: profiles } = await svc
    .from('profiles')
    .select('id, auth_id, owner_store_name, full_name')
    .in('auth_id', authIds)

  const index = new Map<string, EligibleOwner[]>()
  for (const p of profiles || []) {
    if (!p?.id || !p?.auth_id) continue
    const userId = userByAuth.get(p.auth_id)
    if (!userId) continue
    const ownerStoreName = String(p.owner_store_name || '').trim()
    const storeKey = normalizeStoreNameKey(ownerStoreName)
    if (!storeKey) continue

    const item: EligibleOwner = {
      profileId: String(p.id),
      userId: String(userId),
      ownerStoreName,
      ownerName: String(p.full_name || '').trim() || ownerStoreName || '이름 없음',
      storeKey,
    }
    const bucket = index.get(storeKey) || []
    bucket.push(item)
    index.set(storeKey, bucket)
  }

  const eligibleCount = Array.from(index.values()).reduce((sum, bucket) => sum + bucket.length, 0)
  return { index, eligibleCount }
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

  const { index: ownerIndex, eligibleCount } = await loadEligibleOwners(svc, brandId)

  const results: RowResult[] = []
  let imported = 0
  let skipped = 0
  let failed = 0
  let conflicts = 0

  for (let i = 0; i < parsed.rows.length; i++) {
    const line = i + 2
    const row = parsed.rows[i]
    const storeNameRaw = pickColumn(row, STORE_NAME_KEYS)
    const amountRaw = pickColumn(row, AMOUNT_KEYS)
    const memo = pickColumn(row, MEMO_KEYS) || 'CSV 초기 적립'

    if (!storeNameRaw) {
      failed++
      results.push({ line, store_name: '', status: 'error', reason: 'missing_store_name' })
      continue
    }

    const amount = parseAmount(amountRaw)
    if (amount == null) {
      failed++
      results.push({ line, store_name: storeNameRaw, status: 'error', reason: 'invalid_amount' })
      continue
    }

    const match = matchByStoreNameKey(storeNameRaw, ownerIndex)

    if (match.status === 'no_match') {
      failed++
      results.push({
        line,
        store_name: storeNameRaw,
        amount,
        status: 'no_match',
        reason: 'store_name_not_found',
      })
      continue
    }

    if (match.status === 'conflict') {
      conflicts++
      failed++
      results.push({
        line,
        store_name: storeNameRaw,
        amount,
        status: 'conflict',
        reason: 'multiple_owners_matched',
        conflict_owners: match.items.map((o) => ({
          profile_id: o.profileId,
          owner_store_name: o.ownerStoreName,
          owner_name: o.ownerName,
        })),
      })
      continue
    }

    const owner = match.item
    const profileId = owner.profileId
    const idempotencyKey = `manual_init:${companyId}:${profileId}`

    const { data: existingLedger } = await svc
      .from('brand_owner_point_ledger')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingLedger?.id) {
      skipped++
      results.push({
        line,
        store_name: storeNameRaw,
        amount,
        status: 'skipped',
        reason: 'already_initialized',
        owner_id: profileId,
        matched_owner_name: owner.ownerName,
        matched_store_name: owner.ownerStoreName,
      })
      continue
    }

    if (dryRun) {
      imported++
      results.push({
        line,
        store_name: storeNameRaw,
        amount,
        status: 'ok',
        owner_id: profileId,
        matched_owner_name: owner.ownerName,
        matched_store_name: owner.ownerStoreName,
      })
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
        results.push({
          line,
          store_name: storeNameRaw,
          amount,
          status: 'skipped',
          reason: 'duplicate_idempotency',
          owner_id: profileId,
          matched_owner_name: owner.ownerName,
          matched_store_name: owner.ownerStoreName,
        })
        continue
      }
      failed++
      results.push({
        line,
        store_name: storeNameRaw,
        amount,
        status: 'error',
        reason: ledgerErr.message || 'ledger_insert_failed',
      })
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
      results.push({
        line,
        store_name: storeNameRaw,
        amount,
        status: 'error',
        reason: balErr.message || 'balance_upsert_failed',
      })
      continue
    }

    imported++
    results.push({
      line,
      store_name: storeNameRaw,
      amount,
      status: 'ok',
      owner_id: profileId,
      matched_owner_name: owner.ownerName,
      matched_store_name: owner.ownerStoreName,
    })
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    company_id: companyId,
    eligible_owners: eligibleCount,
    total_rows: parsed.rows.length,
    imported,
    skipped,
    failed,
    conflicts,
    results,
  })
}
