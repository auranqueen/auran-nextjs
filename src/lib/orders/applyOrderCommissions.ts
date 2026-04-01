import type { SupabaseClient } from '@supabase/supabase-js'

async function loadSettings(supabase: SupabaseClient, categories: string[]) {
  const map: Record<string, string> = {}
  for (const cat of categories) {
    const { data } = await supabase.from('admin_settings').select('key,value').eq('category', cat)
    ;((data as any[]) || []).forEach((r) => {
      if (r?.key != null) map[String(r.key)] = String(r.value ?? '')
    })
  }
  return map
}

function getSetting(map: Record<string, string>, key: string, fallback: string) {
  const v = map[key]
  return v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : fallback
}

function partnerGradeKey(grade: string): 'basic' | 'pro' | 'premium' {
  const g = String(grade || '').toLowerCase()
  if (['premium', 'gold', 'platinum', 'p'].includes(g)) return 'premium'
  if (['pro', 'silver', 's'].includes(g)) return 'pro'
  return 'basic'
}

function ownerPlanKey(plan: string): string {
  const p = String(plan || 'auran')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  return p || 'auran'
}

async function effectiveCaps(supabase: SupabaseClient, productId: string) {
  const { data, error } = await supabase
    .from('product_commission_view' as any)
    .select('effective_partner_commission, effective_owner_commission')
    .eq('product_id', productId)
    .maybeSingle()
  if (!error && data) {
    return {
      partnerCap: Math.min(100, Math.max(0, Number((data as any).effective_partner_commission ?? 100))),
      ownerCap: Math.min(100, Math.max(0, Number((data as any).effective_owner_commission ?? 100))),
    }
  }
  return { partnerCap: 100, ownerCap: 100 }
}

async function notifyUser(supabase: SupabaseClient, usersTableId: string | null | undefined, title: string, body: string) {
  if (!usersTableId) return
  await supabase.from('notifications').insert({
    user_id: usersTableId,
    type: 'promo',
    title,
    body,
    icon: '💜',
    is_read: false,
  } as any)
}

/**
 * 구매확정 직후: partner_commissions / owner_commissions 적재 및 파트너 프로필·등급 반영
 */
export async function applyCommissionsAfterOrderConfirm(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { data: order } = await supabase
    .from('orders')
    .select('id,customer_id,items,final_amount,referrer_user_id,prescription_owner_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order?.id) return

  const buyerAuthId = String((order as any).customer_id || '')
  const referrerAuthId = String((order as any).referrer_user_id || '').trim()
  const prescriptionOwnerAuthId = String((order as any).prescription_owner_id || '').trim()
  const orderFinal = Math.max(0, Number((order as any).final_amount || 0))

  const { data: buyerRow } = buyerAuthId
    ? await supabase.from('users').select('id').eq('auth_id', buyerAuthId).maybeSingle()
    : { data: null }
  const buyerUserId = buyerRow?.id ? String(buyerRow.id) : null

  const items = Array.isArray((order as any).items) ? ((order as any).items as any[]) : []
  const productIds = Array.from(
    new Set(items.map((it) => String(it?.product_id || it?.id || '').trim()).filter(Boolean))
  )
  if (!productIds.length) return

  const { data: prods } = await supabase.from('products').select('*').in('id', productIds)
  const prodMap = Object.fromEntries(((prods as any[]) || []).map((p) => [String(p.id), p]))

  const settings = await loadSettings(supabase, ['partner', 'commission', 'owner'])

  let partnerCommissionSum = 0
  let ownerCommissionSum = 0

  const { data: refUser } = referrerAuthId
    ? await supabase.from('users').select('id').eq('auth_id', referrerAuthId).maybeSingle()
    : { data: null }
  const partnerUsersId = refUser?.id ? String(refUser.id) : null

  const { data: partnerProf } = referrerAuthId
    ? await supabase.from('profiles').select('partner_grade, partner_total_sales, partner_total_commission').eq('auth_id', referrerAuthId).maybeSingle()
    : { data: null }
  const partnerGrade = partnerGradeKey(String((partnerProf as any)?.partner_grade || 'basic'))
  const gradeRate = Number(
    getSetting(
      settings,
      `partner_commission_${partnerGrade}`,
      partnerGrade === 'premium' ? '10' : partnerGrade === 'pro' ? '8' : '5'
    )
  )

  const { data: ownerUser } = prescriptionOwnerAuthId
    ? await supabase.from('users').select('id').eq('auth_id', prescriptionOwnerAuthId).maybeSingle()
    : { data: null }
  const ownerUsersId = ownerUser?.id ? String(ownerUser.id) : null

  const { data: ownerProf } = prescriptionOwnerAuthId
    ? await supabase.from('profiles').select('owner_subscription_plan').eq('auth_id', prescriptionOwnerAuthId).maybeSingle()
    : { data: null }
  const ownerPlan = ownerPlanKey(String((ownerProf as any)?.owner_subscription_plan || 'auran'))
  const ownerPlanRate = Number(getSetting(settings, `owner_commission_${ownerPlan}`, '10'))

  for (const it of items) {
    const pid = String(it?.product_id || it?.id || '').trim()
    if (!pid) continue
    const qty = Math.max(1, Number(it?.quantity || 1))
    const unit = Number(it?.price || it?.retail_price || it?.amount || 0)
    const lineAmount = Math.round(unit * qty)
    if (lineAmount <= 0) continue

    const pRow = prodMap[pid] || {}
    const commissionType = String(pRow.commission_type || 'normal')

    const caps = await effectiveCaps(supabase, pid)

    if (partnerUsersId && buyerUserId) {
      const { data: exists } = await supabase
        .from('partner_commissions' as any)
        .select('id')
        .eq('order_id', orderId)
        .eq('product_id', pid)
        .maybeSingle()
      if (!exists) {
        const rate = Math.min(gradeRate, caps.partnerCap)
        const amount = Math.floor((lineAmount * rate) / 100)
        if (amount > 0) {
          await supabase.from('partner_commissions' as any).insert({
            partner_id: partnerUsersId,
            order_id: orderId,
            product_id: pid,
            customer_id: buyerUserId,
            commission_rate: rate,
            commission_amount: amount,
            order_amount: lineAmount,
            commission_type: commissionType,
            status: 'confirmed',
          } as any)
          partnerCommissionSum += amount
        }
      }
    }

    if (ownerUsersId && buyerUserId) {
      const { data: existsO } = await supabase
        .from('owner_commissions' as any)
        .select('id')
        .eq('order_id', orderId)
        .eq('product_id', pid)
        .maybeSingle()
      if (!existsO) {
        const prodOrPlan = Number(pRow.owner_commission_rate) > 0 ? Number(pRow.owner_commission_rate) : ownerPlanRate
        const rate = Math.min(prodOrPlan, caps.ownerCap)
        const amount = Math.floor((lineAmount * rate) / 100)
        if (amount > 0) {
          await supabase.from('owner_commissions' as any).insert({
            owner_id: ownerUsersId,
            order_id: orderId,
            product_id: pid,
            customer_id: buyerUserId,
            prescription_id: null,
            commission_rate: rate,
            commission_amount: amount,
            order_amount: lineAmount,
            commission_type: commissionType,
            status: 'confirmed',
          } as any)
          ownerCommissionSum += amount
        }
      }
    }
  }

  if (partnerCommissionSum > 0 && partnerUsersId) {
    await notifyUser(
      supabase,
      partnerUsersId,
      '커미션이 확정됐어요 💜',
      `추천 구매확정! +${partnerCommissionSum}원 커미션`
    )
  }
  if (ownerCommissionSum > 0 && ownerUsersId) {
    await notifyUser(
      supabase,
      ownerUsersId,
      '처방전 커미션 확정됐어요 💜',
      `고객 구매확정! +${ownerCommissionSum}원 커미션`
    )
  }

  if (referrerAuthId && orderFinal > 0) {
    const { data: pr } = await supabase
      .from('profiles')
      .select('partner_total_sales, partner_total_commission, partner_grade')
      .eq('auth_id', referrerAuthId)
      .maybeSingle()
    if (pr) {
      const prevSales = Number((pr as any)?.partner_total_sales || 0)
      const prevComm = Number((pr as any)?.partner_total_commission || 0)
      const nextSales = prevSales + orderFinal
      const nextComm = prevComm + partnerCommissionSum

      const proMin = Number(getSetting(settings, 'partner_grade_pro_min_sales', '1000000'))
      const premMin = Number(getSetting(settings, 'partner_grade_premium_min_sales', '5000000'))
      let nextGrade = String((pr as any)?.partner_grade || 'basic').toLowerCase()
      if (nextSales >= premMin) nextGrade = 'premium'
      else if (nextSales >= proMin) nextGrade = 'pro'

      const prevG = partnerGradeKey(String((pr as any)?.partner_grade || 'basic'))
      const newG = partnerGradeKey(nextGrade)
      const upgraded = (prevG === 'basic' && (newG === 'pro' || newG === 'premium')) || (prevG === 'pro' && newG === 'premium')

      await supabase
        .from('profiles')
        .update({
          partner_total_sales: nextSales,
          partner_total_commission: nextComm,
          partner_grade: nextGrade,
        } as any)
        .eq('auth_id', referrerAuthId)

      if (upgraded && partnerUsersId) {
        const label = newG === 'premium' ? 'PREMIUM' : 'PRO'
        await notifyUser(supabase, partnerUsersId, '등급이 올라갔어요 🎉', `${label} 파트너스가 됐어요! 커미션율이 높아졌어요 💜`)
      }
    }
  }
}

/**
 * 반품/환불 완료 시 커미션 취소. 이미 지급(paid)이면 point_debts 반영.
 */
export async function cancelCommissionsForRefundOrder(supabase: SupabaseClient, orderId: string): Promise<void> {
  const [{ data: pc }, { data: oc }] = await Promise.all([
    supabase.from('partner_commissions' as any).select('*').eq('order_id', orderId),
    supabase.from('owner_commissions' as any).select('*').eq('order_id', orderId),
  ])
  const partnerRows = (pc as any[]) || []
  const ownerRows = (oc as any[]) || []

  const partnerNotify = new Set<string>()
  const ownerNotify = new Set<string>()

  for (const row of partnerRows) {
    const st = String(row.status || '').toLowerCase()
    if (st === 'cancelled') continue

    if (st === 'paid') {
      const amt = Math.max(0, Math.round(Number(row.commission_amount || 0)))
      const { data: u } = await supabase.from('users').select('auth_id').eq('id', row.partner_id).maybeSingle()
      const authId = (u as any)?.auth_id
      if (authId && amt > 0) {
        await supabase.from('point_debts').insert({
          user_id: authId,
          amount: amt,
          reason: '반품 커미션 회수',
          order_id: orderId,
          status: 'pending',
          expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        } as any)
      }
    }

    await supabase.from('partner_commissions' as any).update({ status: 'cancelled' } as any).eq('id', row.id)
    if (row.partner_id) partnerNotify.add(String(row.partner_id))
  }

  for (const row of ownerRows) {
    const st = String(row.status || '').toLowerCase()
    if (st === 'cancelled') continue

    if (st === 'paid') {
      const amt = Math.max(0, Math.round(Number(row.commission_amount || 0)))
      const { data: u } = await supabase.from('users').select('auth_id').eq('id', row.owner_id).maybeSingle()
      const authId = (u as any)?.auth_id
      if (authId && amt > 0) {
        await supabase.from('point_debts').insert({
          user_id: authId,
          amount: amt,
          reason: '반품 원장 커미션 회수',
          order_id: orderId,
          status: 'pending',
          expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        } as any)
      }
    }

    await supabase.from('owner_commissions' as any).update({ status: 'cancelled' } as any).eq('id', row.id)
    if (row.owner_id) ownerNotify.add(String(row.owner_id))
  }

  await Promise.all(
    Array.from(partnerNotify).map((pid) =>
      notifyUser(supabase, pid, '반품으로 커미션이 취소됐어요 😢', '반품으로 커미션이 취소됐어요 😢')
    )
  )
  await Promise.all(
    Array.from(ownerNotify).map((oid) =>
      notifyUser(supabase, oid, '반품으로 커미션이 취소됐어요 😢', '반품으로 커미션이 취소됐어요 😢')
    )
  )
}
