'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'
import { submitOrderBatch } from '@/lib/brand/submitOrderBatch'
import { resolveHqCampaignEffects } from '@/lib/brand/hqForcedCampaignPromos'
interface Props {
  campaigns: HqForcedCampaign[]
  ownerProfileId: string | null
}
interface ProductInfo {
  id: string
  brand_id: string
  name: string
  thumb_img: string | null
  supply_price: number
}
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12 }
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const PURPLE = '#7B5EA7'
const PAGE_SIZE = 3
export default function EventPackageSection({ campaigns, ownerProfileId }: Props) {
  const supabase = createClient()
  const [productMap, setProductMap] = useState<Record<string, ProductInfo>>({})
  const [pointBalances, setPointBalances] = useState<Record<string, number>>({})
  const [rewardBalances, setRewardBalances] = useState<Record<string, number>>({})
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<HqForcedCampaign | null>(null)
  const [usePoints, setUsePoints] = useState(true)
  const [usePointsReward, setUsePointsReward] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const companyIds = useMemo(
    () => Array.from(new Set(campaigns.map((c) => (c as unknown as { company_id?: string }).company_id).filter(Boolean))) as string[],
    [campaigns],
  )
  const allProductIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of campaigns) {
      for (const pid of c.target_product_ids || []) ids.add(pid)
      const giftId = (c as unknown as { gift_product_id?: string | null }).gift_product_id
      if (giftId) ids.add(giftId)
    }
    return Array.from(ids)
  }, [campaigns])
  useEffect(() => {
    if (!allProductIds.length) { setProductMap({}); return }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('brand_products')
        .select('id, brand_id, name, thumb_img, supply_price')
        .in('id', allProductIds)
      if (cancelled) return
      const map: Record<string, ProductInfo> = {}
      for (const p of (data || []) as ProductInfo[]) map[p.id] = p
      setProductMap(map)
    })()
    return () => { cancelled = true }
  }, [allProductIds, supabase])
  useEffect(() => {
    if (!ownerProfileId || !companyIds.length) { setPointBalances({}); return }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('brand_points')
        .select('company_id, balance')
        .in('company_id', companyIds)
        .eq('owner_id', ownerProfileId)
        .eq('track', 'ARETE')
      if (cancelled) return
      const map: Record<string, number> = {}
      for (const r of (data || []) as { company_id: string; balance: number }[]) {
        map[r.company_id] = Number(r.balance) || 0
      }
      setPointBalances(map)
    })()
    return () => { cancelled = true }
  }, [ownerProfileId, companyIds, supabase])
  useEffect(() => {
    if (!ownerProfileId || !companyIds.length) { setRewardBalances({}); return }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('brand_points')
        .select('company_id, balance')
        .in('company_id', companyIds)
        .eq('owner_id', ownerProfileId)
        .eq('track', 'REWARD')
      if (cancelled) return
      const map: Record<string, number> = {}
      for (const r of (data || []) as { company_id: string; balance: number }[]) {
        map[r.company_id] = Number(r.balance) || 0
      }
      setRewardBalances(map)
    })()
    return () => { cancelled = true }
  }, [ownerProfileId, companyIds, supabase])
  const campaignTotal = useCallback((c: HqForcedCampaign) => {
    return (c.target_product_ids || []).reduce((sum, pid) => {
      const p = productMap[pid]
      return sum + (p ? p.supply_price : 0)
    }, 0)
  }, [productMap])
  if (!campaigns.length) return null
  const visibleCampaigns = campaigns.slice(0, visibleCount)
  const selectedCompanyId = selected ? (selected as unknown as { company_id?: string }).company_id : null
  const selectedBalance = selectedCompanyId ? (pointBalances[selectedCompanyId] || 0) : 0
  const selectedRewardBalance = selectedCompanyId ? (rewardBalances[selectedCompanyId] || 0) : 0
  const selectedTotal = selected ? campaignTotal(selected) : 0
  const afterArete = usePoints ? Math.max(0, selectedTotal - selectedBalance) : selectedTotal
  const rewardApplied = usePointsReward ? Math.min(selectedRewardBalance, afterArete) : 0
  const finalAmount = Math.max(0, afterArete - rewardApplied)
  const submitOrder = async () => {
    if (!selected || !ownerProfileId) return
    setOrdering(true)
    try {
      const groups: Record<string, { brand_id: string; items: { product_id: string; name: string; qty: number; unit_price: number; line_amount: number }[]; amount: number }> = {}
      for (const pid of selected.target_product_ids || []) {
        const p = productMap[pid]
        if (!p) continue
        if (!groups[p.brand_id]) groups[p.brand_id] = { brand_id: p.brand_id, items: [], amount: 0 }
        groups[p.brand_id].items.push({ product_id: p.id, name: p.name, qty: 1, unit_price: p.supply_price, line_amount: p.supply_price })
        groups[p.brand_id].amount += p.supply_price
      }
      const groupList = Object.values(groups)
      if (!groupList.length) { showToast('구성 제품 정보를 불러오지 못했어요'); setOrdering(false); return }
      const allCartItemsForEffects = groupList.flatMap((g) =>
        g.items.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.unit_price })),
      )
      const { discountTotal } = resolveHqCampaignEffects(allCartItemsForEffects, [selected])
      const rawGrandTotal = groupList.reduce((s, g) => s + g.amount, 0)
      let remainingDiscount = discountTotal
      const cartItems = groupList.map((g, idx) => {
        const isLast = idx === groupList.length - 1
        const share = isLast ? remainingDiscount : Math.round(discountTotal * (g.amount / rawGrandTotal))
        remainingDiscount -= share
        return {
          brand_id: g.brand_id,
          profile_id: ownerProfileId,
          items: g.items,
          total_qty: g.items.length,
          total_amount: g.amount - share,
        }
      })
      const result = await submitOrderBatch(cartItems)
      if (!result?.ok) {
        showToast('주문 실패: ' + (result?.error || '다시 시도해주세요'))
        setOrdering(false)
        return
      }
      const orderIds: string[] = result.order_ids || []
      if (usePoints && selectedBalance > 0 && orderIds.length) {
        const grandTotal = rawGrandTotal - discountTotal
        const pointsUsedTotal = Math.min(selectedBalance, grandTotal)
        let remaining = pointsUsedTotal
        const pointsByOrder: Record<string, number> = {}
        orderIds.forEach((id, idx) => {
          const g = groupList[idx]
          if (!g) return
          const share = idx === orderIds.length - 1 ? remaining : Math.round(pointsUsedTotal * (g.amount / grandTotal))
          pointsByOrder[id] = Math.min(share, remaining)
          remaining -= pointsByOrder[id]
        })
        await fetch('/api/brand-orders/apply-event-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_by_order: pointsByOrder }),
        }).catch(() => {})
      }
      if (usePointsReward && selectedRewardBalance > 0 && orderIds.length) {
        const afterAreteTotal = usePoints ? Math.max(0, rawGrandTotal - discountTotal - selectedBalance) : rawGrandTotal - discountTotal
        const rewardUsedTotal = Math.min(selectedRewardBalance, afterAreteTotal)
        if (rewardUsedTotal > 0) {
          let remainingReward = rewardUsedTotal
          const rewardByOrder: Record<string, number> = {}
          orderIds.forEach((id, idx) => {
            const g = groupList[idx]
            if (!g) return
            const share = idx === orderIds.length - 1 ? remainingReward : Math.round(rewardUsedTotal * (g.amount / afterAreteTotal))
            rewardByOrder[id] = Math.min(share, remainingReward)
            remainingReward -= rewardByOrder[id]
          })
          await fetch('/api/brand-orders/apply-reward-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points_by_order: rewardByOrder }),
          }).catch(() => {})
        }
      }
      showToast('패키지 주문이 접수됐어요!')
      setSelected(null)
    } catch {
      showToast('주문 중 오류가 발생했어요')
    } finally {
      setOrdering(false)
    }
  }
  return (
    <div style={{ padding: '0 16px 16px', background: 'rgba(123,94,167,0.04)' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={{ fontSize: 11, color: SUB, padding: '10px 0 8px' }}>이번달 이벤트 패키지</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {visibleCampaigns.map((c) => {
          const meta = c as unknown as { title?: string; image_url?: string | null }
          return (
            <div key={c.id} onClick={() => { setSelected(c); setUsePoints(true) }} style={{ ...CARD, cursor: 'pointer' }}>
              {meta.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={meta.image_url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, marginBottom: 6, background: 'linear-gradient(135deg, #7B5EA7, #C9A96E)' }} />
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT, marginBottom: 2, lineHeight: 1.3 }}>{meta.title || '이벤트 패키지'}</div>
              <div style={{ fontSize: 11, color: SUB }}>{campaignTotal(c).toLocaleString()}원</div>
            </div>
          )
        })}
      </div>
      {visibleCount < campaigns.length && (
        <button type="button" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          style={{ width: '100%', marginTop: 10, padding: 8, fontSize: 11, borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: TEXT, cursor: 'pointer' }}>
          이벤트 더보기 ({visibleCount}/{campaigns.length})
        </button>
      )}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 998, display: 'flex', alignItems: 'flex-end' }} onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#151018', borderRadius: '16px 16px 0 0', padding: 16, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            {(() => {
              const meta = selected as unknown as { title?: string; description?: string | null; image_url?: string | null }
              return (
                <>
                  {meta.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meta.image_url} alt="" style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', borderRadius: 10, marginBottom: 12 }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '16/7', borderRadius: 10, marginBottom: 12, background: 'linear-gradient(135deg, #7B5EA7, #C9A96E)' }} />
                  )}
                  <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 6 }}>{meta.title || '이벤트 패키지'}</div>
                  {meta.description && <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{meta.description}</div>}
                  <div style={{ fontSize: 12, fontWeight: 500, color: SUB, marginBottom: 8 }}>포함 구성</div>
                  {(selected.target_product_ids || []).map((pid) => {
                    const p = productMap[pid]
                    return (
                      <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: 12, color: TEXT }}>
                        <span>{p?.name || '제품'}</span>
                        <span style={{ color: SUB }}>{(p?.supply_price || 0).toLocaleString()}원</span>
                      </div>
                    )
                  })}
                  <div style={{ ...CARD, marginTop: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TEXT, marginBottom: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                      아레테 포인트로 결제할게요 (누적잔액 {selectedBalance.toLocaleString()}P)
                    </label>
                    {selectedRewardBalance > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TEXT, marginBottom: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={usePointsReward} onChange={(e) => setUsePointsReward(e.target.checked)} />
                        일반적립금으로 결제할게요 (누적잔액 {selectedRewardBalance.toLocaleString()}P)
                      </label>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: TEXT }}>
                      <span>{(usePoints || usePointsReward) ? '추가 결제금액' : '패키지 합계'}</span>
                      <span>{finalAmount.toLocaleString()}원</span>
                    </div>
                  </div>
                  <button type="button" onClick={submitOrder} disabled={ordering}
                    style={{ width: '100%', marginTop: 10, padding: 11, fontSize: 13, borderRadius: 8, border: 'none', background: ordering ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', cursor: ordering ? 'not-allowed' : 'pointer' }}>
                    {ordering ? '처리 중...' : '패키지 담기'}
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
