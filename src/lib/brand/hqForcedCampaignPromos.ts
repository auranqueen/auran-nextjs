// 독립 헬퍼 — brandOrderPromos 함수는 import하지 않음(필요시 공용 타입만 참조)
export type HqCampaignEffectRow = {
  campaign_id: string
  product_id: string | null
  qty: number
  amount: number // discount일 때만 금액, gift/bundle은 0
  effect_type: 'gift' | 'discount'
  label: string
}
export type HqForcedCampaign = {
  id: string
  campaign_type: 'bundle' | 'gift' | 'discount'
  target_product_ids: string[]
  buy_qty: number | null
  bonus_qty: number | null
  gift_product_id: string | null
  discount_pct: number | null
  start_at: string
  end_at: string
  tiers?: { min_qty: number; discount_pct: number | null; discount_amount: number | null }[]
}
type CartItem = { product_id: string; qty: number; unit_price: number }
function resolveGiftEffect(
  campaign: HqForcedCampaign,
  matchedQty: number,
  targetProductId: string | null
): HqCampaignEffectRow | null {
  if (!campaign.buy_qty || !campaign.bonus_qty) return null
  const giftCount = Math.floor(matchedQty / campaign.buy_qty) * campaign.bonus_qty
  if (giftCount <= 0) return null
  return {
    campaign_id: campaign.id,
    product_id: targetProductId,
    qty: giftCount,
    amount: 0,
    effect_type: 'gift',
    label: `${campaign.buy_qty}+${campaign.bonus_qty} 증정`,
  }
}
function resolveDiscountEffect(
  campaign: HqForcedCampaign,
  matchedQty: number,
  matchedSubtotal: number
): HqCampaignEffectRow | null {
  const tiers = campaign.tiers ?? []
  const matched = tiers
    .filter(t => matchedQty >= t.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty)[0]
  if (!matched) return null
  const amount = matched.discount_amount ?? Math.round(matchedSubtotal * ((matched.discount_pct ?? 0) / 100))
  if (amount <= 0) return null
  return {
    campaign_id: campaign.id,
    product_id: null,
    qty: matchedQty,
    amount,
    effect_type: 'discount',
    label: matched.discount_amount ? `${matched.discount_amount}원 할인` : `${matched.discount_pct}% 할인`,
  }
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
    const matchedItems = cartItems.filter(i => targets.includes(i.product_id))
    const matchedQty = matchedItems.reduce((sum, i) => sum + i.qty, 0)
    if (matchedQty === 0) continue
    if (campaign.campaign_type === 'bundle') {
      const effect = resolveGiftEffect(campaign, matchedQty, matchedItems[0]?.product_id ?? null)
      if (effect) giftLines.push(effect)
    } else if (campaign.campaign_type === 'gift') {
      const effect = resolveGiftEffect(campaign, matchedQty, campaign.gift_product_id)
      if (effect) giftLines.push(effect)
    } else if (campaign.campaign_type === 'discount') {
      const matchedSubtotal = matchedItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0)
      const effect = resolveDiscountEffect(campaign, matchedQty, matchedSubtotal)
      if (effect) {
        discountTotal += effect.amount
        giftLines.push(effect)
      }
    }
  }
  return { discountTotal, giftLines }
}