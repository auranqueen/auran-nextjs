import type { SupabaseClient } from '@supabase/supabase-js'

export type PointsTrack = 'A' | 'B' | 'ARETE' | 'REWARD'
export type PointsSourceType = 'manual' | 'invoice_webhook' | 'arete_payment' | 'monthly_billing'

export type ApplyPointsDeltaParams = {
  companyId: string
  ownerId: string
  track: PointsTrack
  amount: number
  reason: string
  sourceType: PointsSourceType
  staffId?: string | null
}

export type ApplyPointsDeltaResult = {
  ok: boolean
  balanceAfter?: number
  error?: string
}

export async function applyPointsDelta(
  supabase: SupabaseClient,
  {
    companyId,
    ownerId,
    track,
    amount,
    reason,
    sourceType,
    staffId,
  }: ApplyPointsDeltaParams,
): Promise<ApplyPointsDeltaResult> {
  const delta = Math.trunc(Number(amount) || 0)
  const reasonTrim = String(reason || '').trim()
  if (!companyId || !ownerId || !track) {
    return { ok: false, error: 'missing_keys' }
  }
  if (!reasonTrim) {
    return { ok: false, error: 'reason_required' }
  }
  if (!['manual', 'invoice_webhook', 'arete_payment', 'monthly_billing'].includes(sourceType)) {
    return { ok: false, error: 'invalid_source_type' }
  }
  if (!['A', 'B', 'ARETE', 'REWARD'].includes(track)) {
    return { ok: false, error: 'invalid_track' }
  }

  const { data: pointRow, error: selectErr } = await supabase
    .from('brand_points')
    .select('balance, total_earned')
    .eq('company_id', companyId)
    .eq('owner_id', ownerId)
    .eq('track', track)
    .maybeSingle()

  if (selectErr) {
    return { ok: false, error: selectErr.message }
  }

  const currentBalance = Math.trunc(Number((pointRow as { balance?: number } | null)?.balance) || 0)
  const currentEarned = Math.trunc(Number((pointRow as { total_earned?: number } | null)?.total_earned) || 0)
  const balanceAfter = Math.max(0, currentBalance + delta)
  const totalEarned =
    track === 'REWARD' && delta > 0 ? currentEarned + delta : currentEarned

  const upsertPayload: Record<string, unknown> = {
    company_id: companyId,
    owner_id: ownerId,
    track,
    balance: balanceAfter,
    total_earned: totalEarned,
  }

  const { error: upsertErr } = await supabase.from('brand_points').upsert(upsertPayload, {
    onConflict: 'company_id,owner_id,track',
  })

  if (upsertErr) {
    return { ok: false, error: upsertErr.message }
  }

  const { error: ledgerErr } = await supabase.from('brand_points_ledger').insert({
    company_id: companyId,
    owner_id: ownerId,
    track,
    amount: delta,
    balance_after: balanceAfter,
    reason: reasonTrim,
    source_type: sourceType,
    created_by_staff_id: staffId ?? null,
  })

  if (ledgerErr) {
    return { ok: false, error: ledgerErr.message }
  }

  return { ok: true, balanceAfter }
}
