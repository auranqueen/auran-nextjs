import { tryCreateAdminClient } from '@/lib/supabase/admin'

type KitItem = { product_id?: string; name?: string; qty?: number }
type AdminClient = NonNullable<ReturnType<typeof tryCreateAdminClient>>

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
  await svc.from('brand_stock_logs').insert({
    brand_id: invBrandId,
    inventory_id: invRow.id,
    type: 'out',
    qty,
    before_qty: invRow.total_stock,
    after_qty: Math.max(0, invRow.total_stock - qty),
    ref_type: 'arete',
    ref_id: invoiceId,
    staff_name: '아레테 출고',
    memo: `아레테 출고: ${name} ${qty}개`,
  })
}
