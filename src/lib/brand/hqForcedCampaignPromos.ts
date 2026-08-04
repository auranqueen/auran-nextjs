export type HqCampaignEffectRow = {
  campaign_id: string
  product_id: string | null
  qty: number
  amount: number
  effect_type: 'gift' | 'discount' | 'fixed_price'
  label: string
}
export type HqForcedCampaignTier = {
  min_qty: number
  discount_pct: number | null
  discount_amount: number | null
  fixed_price: number | null
  gifts: { product_id: string; qty: number }[]
  highlight_text: string | null
}
export type HqForcedCampaign = {
  id: string
  target_product_ids: string[]
  start_at: string
  end_at: string
  tiers?: HqForcedCampaignTier[]
}
type CartItem = { product_id: string; qty: number; unit_price: number }
function resolveTierEffects(
  campaign: HqForcedCampaign,
  tier: HqForcedCampaignTier,
  matchedQty: number,
  matchedSubtotal: number
): { discountAmount: number; rows: HqCampaignEffectRow[] } {
  const rows: HqCampaignEffectRow[] = []
  let discountAmount = 0
  const suffix = tier.highlight_text ? ` · ${tier.highlight_text}` : ''
  if (tier.fixed_price != null) {
    const diff = matchedSubtotal - tier.fixed_price
    if (diff > 0) {
      discountAmount += diff
      rows.push({
        campaign_id: campaign.id,
        product_id: null,
        qty: matchedQty,
        amount: diff,
        effect_type: 'fixed_price',
        label: `${tier.min_qty}개 이상 확정가 ${tier.fixed_price.toLocaleString()}원${suffix}`,
      })
    }
  } else if (tier.discount_pct != null || tier.discount_amount != null) {
    const amount = tier.discount_amount ?? Math.round(matchedSubtotal * ((tier.discount_pct ?? 0) / 100))
    if (amount > 0) {
      discountAmount += amount
      rows.push({
        campaign_id: campaign.id,
        product_id: null,
        qty: matchedQty,
        amount,
        effect_type: 'discount',
        label: (tier.discount_amount ? `${tier.discount_amount.toLocaleString()}원 할인` : `${tier.discount_pct}% 할인`) + suffix,
      })
    }
  }
  for (const g of tier.gifts ?? []) {
    if (g.qty > 0 && g.product_id) {
      rows.push({
        campaign_id: campaign.id,
        product_id: g.product_id,
        qty: g.qty,
        amount: 0,
        effect_type: 'gift',
        label: `${g.qty}개 증정${suffix}`,
      })
    }
  }
  return { discountAmount, rows }
}
export function resolveHqCampaignEffects(
  cartItems: CartItem[],
  activeCampaigns: HqForcedCampaign[],
  now: Date = new Date()
): { discountTotal: number; giftLines: HqCampaignEffectRow[] } {
  const giftLines: HqCampaignEffectRow[] = []
  let discountTotal = 0
  for (const campaign of activeCampaigns) {
    const start = new Date(campaign.start_at)
    const end = new Date(campaign.end_at)
    if (now < start || now > end) continue
    const targets = campaign.target_product_ids ?? []
    const matchedItems = cartItems.filter((i) => targets.includes(i.product_id))
    const matchedQty = matchedItems.reduce((sum, i) => sum + i.qty, 0)
    if (matchedQty === 0) continue
    const tiers = campaign.tiers ?? []
    const matchedTier = tiers.filter((t) => matchedQty >= t.min_qty).sort((a, b) => b.min_qty - a.min_qty)[0]
    if (!matchedTier) continue
    const matchedSubtotal = matchedItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0)
    const { discountAmount, rows } = resolveTierEffects(campaign, matchedTier, matchedQty, matchedSubtotal)
    discountTotal += discountAmount
    giftLines.push(...rows)
  }
  return { discountTotal, giftLines }
}
