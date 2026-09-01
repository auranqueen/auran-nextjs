import type { HqForcedCampaign, HqForcedCampaignTier } from '@/lib/brand/hqForcedCampaignPromos'

type ProductInfo = {
  supply_price: number
}

type GiftLine = { product_id: string; qty: number; label: string }

export function getQtyTiers(campaign: HqForcedCampaign): HqForcedCampaignTier[] {
  return (campaign.tiers ?? []).filter(
    (t) => t.min_qty > 0 && (t.min_amount == null || t.min_amount === 0),
  )
}

export function defaultSelectedSets(campaign: HqForcedCampaign): number {
  const qtyTiers = getQtyTiers(campaign)
  if (qtyTiers.length === 0) return 1
  return Math.min(...qtyTiers.map((t) => t.min_qty))
}

export function computeCampaignPackagePricing(
  campaign: HqForcedCampaign,
  productMap: Record<string, ProductInfo>,
  selectedSets: number,
) {
  const unitSetTotal = (campaign.target_product_ids || []).reduce((sum, pid) => {
    const p = productMap[pid]
    return sum + (p ? p.supply_price : 0)
  }, 0)
  const baseTotal = unitSetTotal * selectedSets

  const qtyTiers = getQtyTiers(campaign)
  const matchedTier =
    qtyTiers
      .filter((t) => selectedSets >= t.min_qty)
      .sort((a, b) => b.min_qty - a.min_qty)[0] ?? null

  let finalAmount = baseTotal
  let discountTotal = 0
  const qtyGifts: GiftLine[] = []

  if (matchedTier) {
    if (matchedTier.fixed_price != null) {
      finalAmount = Math.trunc(Number(matchedTier.fixed_price))
      discountTotal = Math.max(0, baseTotal - finalAmount)
    } else if (matchedTier.discount_pct != null) {
      discountTotal = Math.round(baseTotal * ((matchedTier.discount_pct ?? 0) / 100))
      finalAmount = baseTotal - discountTotal
    } else if (matchedTier.discount_amount != null) {
      discountTotal = Math.trunc(Number(matchedTier.discount_amount))
      finalAmount = Math.max(0, baseTotal - discountTotal)
    }
    for (const g of matchedTier.gifts ?? []) {
      if (g.qty > 0 && g.product_id) {
        qtyGifts.push({ product_id: g.product_id, qty: g.qty, label: `${g.qty}개 증정` })
      }
    }
  }

  const amountTiers = (campaign.tiers ?? []).filter((t) => t.min_amount != null && t.min_amount > 0)
  const matchedAmountTier =
    amountTiers
      .filter((t) => finalAmount >= (t.min_amount ?? 0))
      .sort((a, b) => (b.min_amount ?? 0) - (a.min_amount ?? 0))[0] ?? null

  const amountGifts: GiftLine[] = []
  if (matchedAmountTier) {
    const suffix = matchedAmountTier.highlight_text ? ` · ${matchedAmountTier.highlight_text}` : ''
    for (const g of matchedAmountTier.gifts ?? []) {
      if (g.qty > 0 && g.product_id) {
        amountGifts.push({ product_id: g.product_id, qty: g.qty, label: `${g.qty}개 증정${suffix}` })
      }
    }
  }

  return {
    unitSetTotal,
    baseTotal,
    finalAmount,
    discountTotal,
    matchedTier,
    matchedAmountTier,
    gifts: [...qtyGifts, ...amountGifts],
    selectedSets,
  }
}
