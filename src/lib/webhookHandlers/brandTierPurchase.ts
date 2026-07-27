import type { SupabaseClient } from '@supabase/supabase-js'
type TierTarget = {
  tier_package_id?: string
  company_id?: string
  owner_profile_id?: string
  tier_name?: string
}
type PaymentIntentRow = {
  id: string
  user_id: string | null
  target_id: string | null
  amount: number | null
  kind: string
}
const PLATFORM_FEE_RATE = 8.8
export async function handleBrandTierPurchase(
  intent: PaymentIntentRow,
  client: SupabaseClient,
): Promise<void> {
  const { data: dupOrder } = await client
    .from('brand_tier_orders')
    .select('id')
    .eq('payment_intent_id', intent.id)
    .maybeSingle()
  if (dupOrder?.id) return
  let payload: TierTarget = {}
  try {
    payload = JSON.parse(String(intent.target_id))
  } catch {
    console.error('[brand_tier_purchase] target_id JSON parse failed', intent.id)
    return
  }
  const tierPackageId = String(payload.tier_package_id || '').trim()
  const companyId = String(payload.company_id || '').trim()
  const ownerProfileId = String(payload.owner_profile_id || '').trim()
  if (!tierPackageId || !companyId || !ownerProfileId) {
    console.error('[brand_tier_purchase] missing target fields', intent.id, payload)
    return
  }
  const { data: pkg } = await client
    .from('brand_tier_packages')
    .select('id, company_id, tier_name, price, is_active')
    .eq('id', tierPackageId)
    .eq('is_active', true)
    .maybeSingle()
  const dbPrice = Math.trunc(Number(pkg?.price ?? 0))
  const paidAmount = Math.trunc(Number(intent.amount ?? 0))
  if (!pkg?.id || String(pkg.company_id) !== companyId) {
    console.error('[brand_tier_purchase] package/company gate failed', intent.id)
    return
  }
  if (paidAmount !== dbPrice) {
    console.error('[brand_tier_purchase] amount mismatch', intent.id, { paidAmount, dbPrice })
    return
  }
  const { data: anchorBrand } = await client
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
    .eq('distribution_type', 'tier_contract')
    .limit(1)
    .maybeSingle()
  if (!anchorBrand?.id) {
    console.error('[brand_tier_purchase] no tier_contract brand for company', intent.id, companyId)
    return
  }
  const anchorBrandId = String(anchorBrand.id)
  const tierName = String(pkg.tier_name)
  const feeAmount = Math.floor(paidAmount * PLATFORM_FEE_RATE / 100)
  const netAmount = paidAmount - feeAmount
  const nowIso = new Date().toISOString()
  const { data: tierOrder, error: orderErr } = await client
    .from('brand_tier_orders')
    .insert({
      owner_id: ownerProfileId,
      brand_id: anchorBrandId,
      company_id: companyId,
      tier_package_id: tierPackageId,
      amount: paidAmount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      payment_intent_id: intent.id,
      status: 'paid',
      created_at: nowIso,
    } as any)
    .select('id')
    .single()
  if (orderErr || !tierOrder?.id) {
    console.error('[brand_tier_purchase] brand_tier_orders insert failed', orderErr)
    return
  }
  await client.from('brand_owner_grades').upsert(
    {
      company_id: companyId,
      brand_id: anchorBrandId,
      owner_id: ownerProfileId,
      origin_track: 'B',
      grade: tierName,
      tier_package_id: tierPackageId,
      purchase_amount: paidAmount,
      payment_status: 'paid',
      grade_purchased_at: nowIso,
      care_enabled: true,
    },
    { onConflict: 'company_id,owner_id,origin_track' },
  )
  const { data: buyerProfile } = await client
    .from('profiles')
    .select('auth_id')
    .eq('id', ownerProfileId)
    .maybeSingle()
  let sponsorProfileId: string | null = null
  let sponsorCommissionRate = 0
  if (buyerProfile?.auth_id) {
    const { data: buyerUser } = await client
      .from('users')
      .select('referred_by')
      .eq('auth_id', buyerProfile.auth_id)
      .maybeSingle()
    const referrerUserId = buyerUser?.referred_by ? String(buyerUser.referred_by) : null
    if (referrerUserId) {
      const { data: refUser } = await client
        .from('users')
        .select('auth_id, role')
        .eq('id', referrerUserId)
        .maybeSingle()
      if (refUser?.auth_id && refUser.role === 'owner') {
        const { data: refProf } = await client
          .from('profiles')
          .select('id')
          .eq('auth_id', refUser.auth_id)
          .maybeSingle()
        const candidateProfileId = refProf?.id ? String(refProf.id) : null
        if (candidateProfileId && candidateProfileId !== ownerProfileId) {
          const { data: sponsorGradeRow } = await client
            .from('brand_owner_grades')
            .select('id, tier_package_id, payment_status')
            .eq('company_id', companyId)
            .eq('owner_id', candidateProfileId)
            .eq('origin_track', 'B')
            .eq('payment_status', 'paid')
            .maybeSingle()
          if (sponsorGradeRow?.id && sponsorGradeRow.tier_package_id) {
            const { data: sponsorRatePkg } = await client
              .from('brand_tier_packages')
              .select('commission_rate')
              .eq('id', String(sponsorGradeRow.tier_package_id))
              .maybeSingle()
            const rate = Number(sponsorRatePkg?.commission_rate ?? 0)
            if (rate > 0) {
              sponsorProfileId = candidateProfileId
              sponsorCommissionRate = rate
              await client
                .from('brand_owner_grades')
                .update({ sponsor_owner_id: sponsorProfileId } as any)
                .eq('company_id', companyId)
                .eq('owner_id', ownerProfileId)
                .eq('origin_track', 'B')
                .is('sponsor_owner_id', null)
            } else {
              console.warn(
                '[brand_tier_purchase] sponsor rate missing for tier_package_id',
                intent.id,
                { companyId, tier_package_id: sponsorGradeRow.tier_package_id },
              )
            }
          }
        }
      }
    }
  }
  if (sponsorProfileId && sponsorCommissionRate > 0) {
    const commissionAmount = Math.floor(netAmount * sponsorCommissionRate / 100)
    if (commissionAmount > 0) {
      await client.from('sponsor_commission_ledger').insert({
        sponsor_owner_id: sponsorProfileId,
        referred_owner_id: ownerProfileId,
        brand_tier_order_id: tierOrder.id,
        brand_id: anchorBrandId,
        commission_amount: commissionAmount,
        commission_rate: sponsorCommissionRate,
        status: 'pending',
        created_at: nowIso,
      } as any)
      const { data: sponsorProf } = await client
        .from('profiles')
        .select('auth_id')
        .eq('id', sponsorProfileId)
        .maybeSingle()
      if (sponsorProf?.auth_id) {
        const { data: su } = await client
          .from('users')
          .select('id')
          .eq('auth_id', sponsorProf.auth_id)
          .maybeSingle()
        if (su?.id) {
          await client.from('notifications').insert({
            user_id: su.id,
            type: 'promo',
            title: '추천 원장 등급 구매 💜',
            body: `추천 원장님의 ${tierName} 구매로 커미션 ${commissionAmount.toLocaleString()}원이 예정됐어요`,
            icon: '💜',
            is_read: false,
          } as any)
        }
      }
    }
  }
  await client.from('notifications').insert({
    user_id: intent.user_id,
    type: 'promo',
    title: `${tierName} 등급 구매 완료 💜`,
    body: `${tierName} 등급이 활성화됐어요`,
    icon: '💜',
    is_read: false,
  } as any)
}
