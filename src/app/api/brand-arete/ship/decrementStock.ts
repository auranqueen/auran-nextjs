import { tryCreateAdminClient } from '@/lib/supabase/admin'

type KitItem = { product_id?: string; name?: string; qty?: number }
type AdminClient = NonNullable<ReturnType<typeof tryCreateAdminClient>>

export type AppliedDecrement = {
  inventory_id: string
  brand_id: string
  qty: number
  name: string
  before_qty: number
  log_id: string
  log_memo: string
}

export function parseKitSnapshot(raw: unknown): KitItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const r = x as KitItem
    return {
      product_id: r.product_id ? String(r.product_id) : undefined,
      name: String(r.name || ''),
      qty: Math.trunc(Number(r.qty) || 0),
    }
  }).filter((x) => (x.qty || 0) > 0)
}

export async function decrementStockForAreteItem(
  svc: AdminClient,
  brandId: string,
  invoiceId: string,
  item: KitItem,
) {
  const qty = Math.trunc(Number(item.qty) || 0)
  if (qty <= 0) return
  const name = String(item.name || '')
  const productId = item.product_id ? String(item.product_id) : ''

  let invBrandId = brandId
  if (productId) {
    const { data: prod } = await svc
      .from('brand_products')
      .select('brand_id')
      .eq('id', productId)
      .maybeSingle()
    if (prod?.brand_id) invBrandId = String(prod.brand_id)
  }

  const { data: alreadyLogged } = await svc
    .from('brand_stock_logs')
    .select('id')
    .eq('brand_id', invBrandId)
    .eq('ref_type', 'arete')
    .eq('ref_id', invoiceId)
    .eq('memo', `아레테 출고: ${name} ${qty}개`)
    .limit(1)
  if (alreadyLogged && alreadyLogged.length > 0) return

  const invQuery = svc
    .from('brand_inventory')
    .select('id, total_stock, safety_stock')
    .eq('brand_id', invBrandId)
  const { data: invRow } = productId
    ? await invQuery.eq('product_id', productId).maybeSingle()
    : await invQuery.eq('product_name', name).maybeSingle()

  if (!invRow) {
    console.warn(`[재고차감 실패] 매칭 안 됨: ${name} (arete ${invoiceId})`)
    await svc.from('brand_stock_logs').insert({
      brand_id: invBrandId,
      inventory_id: null,
      type: 'adjust',
      qty,
      before_qty: 0,
      after_qty: 0,
      ref_type: 'arete',
      ref_id: invoiceId,
      staff_name: '아레테 출고',
      memo: `재고매칭 실패로 미차감: ${name} (product_id: ${productId || '없음'})`,
    })
    return
  }

  await svc.rpc('decrement_inventory_stock', { p_inventory_id: invRow.id, p_qty: qty })
  const outMemo = `아레테 출고: ${name} ${qty}개`
  const { data: outLog } = await svc.from('brand_stock_logs').insert({
    brand_id: invBrandId,
    inventory_id: invRow.id,
    type: 'out',
    qty,
    before_qty: invRow.total_stock,
    after_qty: Math.max(0, invRow.total_stock - qty),
    ref_type: 'arete',
    ref_id: invoiceId,
    staff_name: '아레테 출고',
    memo: outMemo,
  }).select('id, memo').maybeSingle()
  if (!outLog?.id) return
  return {
    inventory_id: String(invRow.id),
    brand_id: invBrandId,
    qty,
    name,
    before_qty: Number(invRow.total_stock) || 0,
    log_id: String(outLog.id),
    log_memo: String(outLog.memo || outMemo),
  }
}

export async function restoreAreteDecrements(
  svc: AdminClient,
  invoiceId: string,
  applied: AppliedDecrement[],
) {
  for (const row of applied) {
    await svc.rpc('increment_inventory_stock', {
      p_inventory_id: row.inventory_id,
      p_qty: row.qty,
    })
    const restoredMemo = row.log_memo.includes('[복구됨]')
      ? row.log_memo
      : `${row.log_memo} [복구됨]`
    await svc.from('brand_stock_logs')
      .update({ memo: restoredMemo })
      .eq('id', row.log_id)
    await svc.from('brand_stock_logs').insert({
      brand_id: row.brand_id,
      inventory_id: row.inventory_id,
      type: 'return_in',
      qty: row.qty,
      before_qty: Math.max(0, row.before_qty - row.qty),
      after_qty: row.before_qty,
      ref_type: 'arete',
      ref_id: invoiceId,
      staff_name: '아레테 출고',
      memo: `발송실패로 재고 복구: ${row.name} ${row.qty}개`,
    })
  }
}
