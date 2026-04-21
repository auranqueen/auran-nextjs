import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCommissionsAfterOrderConfirm } from '@/lib/orders/applyOrderCommissions'

type ConfirmResult = {
  ok: boolean
  rewardAmount: number
  shareAmount: number
  autoConfirmDays: number
}

async function addUserPointsByAuth(supabase: SupabaseClient, authId: string, amount: number) {
  if (!amount) return
  const { data: row } = await supabase.from('users').select('id, points').eq('auth_id', authId).maybeSingle()
  if (!row?.id) return
  await supabase.from('users').update({ points: Number(row.points || 0) + amount }).eq('id', row.id)
}

async function insertPointTx(
  supabase: SupabaseClient,
  payload: { user_id: string; amount: number; type: string; description: string; order_id?: string | null; status?: string | null }
) {
  const full = await supabase.from('point_transactions').insert(payload as any)
  if (!full.error) return
  await supabase
    .from('point_transactions')
    .insert({ user_id: payload.user_id, amount: payload.amount, type: payload.type, description: payload.description } as any)
}

export async function confirmOrderById(supabase: SupabaseClient, orderId: string): Promise<ConfirmResult> {
  const { data: autoRow } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('category', 'order')
    .eq('key', 'auto_confirm_days')
    .maybeSingle()
  const autoConfirmDays = Math.max(1, Math.floor(Number((autoRow as { value?: string } | null)?.value ?? 7)))

  const { data: order } = await supabase
    .from('orders')
    .select('id,status,customer_id,items,referrer_user_id,share_toast_paid,prescription_owner_id,final_amount')
    .eq('id', orderId)
    .maybeSingle()
  if (!order?.id) return { ok: false, rewardAmount: 0, shareAmount: 0, autoConfirmDays }
  if (String((order as any).status || '') === '구매확정') return { ok: true, rewardAmount: 0, shareAmount: 0, autoConfirmDays }

  const nowIso = new Date().toISOString()
  await supabase.from('orders').update({ status: '구매확정', confirmed_at: nowIso } as any).eq('id', orderId)

  const items = Array.isArray((order as any).items) ? ((order as any).items as any[]) : []
  const productIds = Array.from(
    new Set(items.map((it) => String(it?.product_id || it?.id || '').trim()).filter((v) => v.length > 0))
  )
  let pMap: Record<string, { earn_rate: number; share_toast: number }> = {}
  if (productIds.length > 0) {
    const { data: prods } = await supabase.from('products').select('id,earn_rate,share_toast').in('id', productIds)
    pMap = Object.fromEntries(
      ((prods || []) as any[]).map((p) => [
        String(p.id),
        {
          earn_rate: Number(p.earn_rate || 0),
          share_toast: Number(p.share_toast || 0),
        },
      ])
    )
  }

  let rewardAmount = 0
  let shareAmount = 0
  items.forEach((it: any) => {
    const pid = String(it?.product_id || it?.id || '').trim()
    const qty = Math.max(1, Number(it?.quantity || 1))
    const price = Number(it?.price || it?.retail_price || it?.amount || 0)
    const meta = pMap[pid]
    if (meta) {
      rewardAmount += Math.floor((price * qty * Math.max(0, meta.earn_rate)) / 100)
      shareAmount += Math.floor(Math.max(0, meta.share_toast) * qty)
    }
  })

  const buyerAuthId = String((order as any).customer_id || '')
  if (buyerAuthId && rewardAmount > 0) {
    await insertPointTx(supabase, {
      user_id: buyerAuthId,
      amount: rewardAmount,
      type: 'purchase_confirm',
      description: '구매확정 적립',
      order_id: orderId,
      status: 'confirmed',
    })
    await addUserPointsByAuth(supabase, buyerAuthId, rewardAmount)
  }

  const referrerAuthId = String((order as any).referrer_user_id || '')
  if (referrerAuthId && shareAmount > 0 && !(order as any).share_toast_paid) {
    await insertPointTx(supabase, {
      user_id: referrerAuthId,
      amount: shareAmount,
      type: 'share_reward',
      description: '추천 구매확정 보상',
      order_id: orderId,
      status: 'confirmed',
    })
    await addUserPointsByAuth(supabase, referrerAuthId, shareAmount)
    {
      const { error: ttErr } = await supabase.from('toast_transactions').insert({
        user_id: referrerAuthId,
        amount: shareAmount,
        transaction_type: 'share_reward',
        description: '추천 구매확정 보상 토스트',
        reference_id: orderId,
      } as any)
      if (ttErr) console.warn('[confirmOrder] toast_transactions share_reward', ttErr)
    }
    await supabase
      .from('orders')
      .update({ share_toast_paid: true, share_toast_amount: shareAmount } as any)
      .eq('id', orderId)
    const { data: me } = await supabase.from('users').select('name').eq('auth_id', buyerAuthId).maybeSingle()
    const buyerName = String((me as any)?.name || '회원')
    const { data: refUser } = await supabase.from('users').select('id').eq('auth_id', referrerAuthId).maybeSingle()
    if (refUser?.id) {
      await supabase.from('notifications').insert({
        user_id: refUser.id,
        type: 'promo',
        title: '추천 보상이 적립됐어요 💜',
        body: `${buyerName}님이 내 추천으로 구매확정했어요! +${shareAmount}T`,
        icon: '💜',
        is_read: false,
      } as any)
    }
  }

  const prescriptionOwnerAuthId = String((order as any).prescription_owner_id || '')
  if (prescriptionOwnerAuthId) {
    const { data: rateRow } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('category', 'owner')
      .eq('key', 'owner_commission_rate')
      .maybeSingle()
    const rate = Math.max(0, Number((rateRow as { value?: string } | null)?.value ?? 8))
    const commission = Math.floor(Number((order as any).final_amount || 0) * (rate / 100))
    if (commission > 0) {
      await insertPointTx(supabase, {
        user_id: prescriptionOwnerAuthId,
        amount: commission,
        type: 'prescription_commission',
        description: '처방전 추천 커미션',
        order_id: orderId,
        status: 'confirmed',
      })
      await addUserPointsByAuth(supabase, prescriptionOwnerAuthId, commission)
      const { data: ownerUser } = await supabase.from('users').select('id').eq('auth_id', prescriptionOwnerAuthId).maybeSingle()
      if (ownerUser?.id) {
        const { data: buyer } = await supabase.from('users').select('name').eq('auth_id', buyerAuthId).maybeSingle()
        const buyerName = String((buyer as any)?.name || '고객')
        await supabase.from('notifications').insert({
          user_id: ownerUser.id,
          type: 'promo',
          title: '처방전 커미션 적립됐어요 💜',
          body: `${buyerName}님이 추천 제품 구매확정!\n+${commission}T 적립됐어요`,
          icon: '💜',
          is_read: false,
        } as any)
      }
    }
  }

  await applyCommissionsAfterOrderConfirm(supabase, orderId)

  return { ok: true, rewardAmount, shareAmount, autoConfirmDays }
}
