export type SubmitOrderBatchGroup = {
  brand_id: string
  profile_id: string
  owner_name?: string
  salon_name?: string
  grade?: string
  items: unknown[]
  total_qty?: number
  total_amount?: number
  promo_applied?: string | null
  promo?: string | null
  points_earned?: number
}

export type SubmitOrderBatchResult =
  | { ok: true; batch_id: string; order_no: string; order_ids?: string[] }
  | { ok: false; error: string; message: string; status?: number }

/**
 * 브랜드별로 그룹핑된 장바구니 → POST /api/brand-order-batches/create
 */
export async function submitOrderBatch(
  cartGroupedByBrand: SubmitOrderBatchGroup[],
  ownerNote?: string | null,
  campaignId?: string | null,
  packageCampaignId?: string | null,
  packageSets?: number | null,
): Promise<SubmitOrderBatchResult> {
  if (!Array.isArray(cartGroupedByBrand) || cartGroupedByBrand.length === 0) {
    return { ok: false, error: 'invalid_request', message: '발주할 상품이 없습니다' }
  }

  const note = typeof ownerNote === 'string' ? ownerNote.trim() : ''
  const pkgId =
    typeof packageCampaignId === 'string' && packageCampaignId.trim()
      ? packageCampaignId.trim()
      : ''
  const pkgSets = Math.trunc(Number(packageSets) || 0)
  const res = await fetch('/api/brand-order-batches/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartItems: cartGroupedByBrand,
      owner_note: note || null,
      campaign_id: campaignId || null,
      ...(pkgId
        ? { package_campaign_id: pkgId, package_sets: pkgSets }
        : {}),
    }),
  })
  const result = await res.json().catch(() => ({})) as {
    ok?: boolean
    batch_id?: string
    order_no?: string
    order_ids?: string[]
    error?: string
    message?: string
  }

  if (!res.ok || !result.ok || !result.batch_id || !result.order_no) {
    return {
      ok: false,
      error: result.error || 'request_failed',
      message: result.message || `발주 실패 (${res.status})`,
      status: res.status,
    }
  }

  return {
    ok: true,
    batch_id: result.batch_id,
    order_no: result.order_no,
    order_ids: result.order_ids,
  }
}
