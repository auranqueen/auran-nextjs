'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'
import { computeCampaignPackagePricing, defaultSelectedSets, getQtyTiers } from '@/lib/brand/computeCampaignPackagePricing'
import { submitOrderBatch } from '@/lib/brand/submitOrderBatch'
import { calcPointsEarned } from '@/lib/brand/brandOrderPromos'

interface Props {
  campaigns: HqForcedCampaign[]
  ownerProfileId: string | null
  ownerName?: string
  salonName?: string
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

export default function EventPackageSection({ campaigns, ownerProfileId, ownerName = '', salonName = '' }: Props) {
  const supabase = createClient()
  const [productMap, setProductMap] = useState<Record<string, ProductInfo>>({})
  const [pointBalances, setPointBalances] = useState<Record<string, number>>({})
  const [rewardBalances, setRewardBalances] = useState<Record<string, number>>({})
  const [gradeByCompany, setGradeByCompany] = useState<Record<string, string>>({})
  const [ratesByCompany, setRatesByCompany] = useState<Record<string, Record<string, number>>>({})
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<HqForcedCampaign | null>(null)
  const [selectedSets, setSelectedSets] = useState(1)
  const [usePoints, setUsePoints] = useState(true)
  const [usePointsReward, setUsePointsReward] = useState(true)
  const [areteHintOpen, setAreteHintOpen] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const openCampaignDetail = (c: HqForcedCampaign) => {
    setSelected(c)
    setSelectedSets(defaultSelectedSets(c))
    setUsePoints(true)
    setAreteHintOpen(false)
    if (ownerProfileId) {
      void (async () => {
        await supabase.from('hq_campaign_views').insert({
          campaign_id: c.id,
          owner_id: ownerProfileId,
        })
      })()
    }
  }
  const companyIds = useMemo(
    () => Array.from(new Set(campaigns.map((c) => (c as unknown as { company_id?: string }).company_id).filter(Boolean))) as string[],
    [campaigns],
  )
  const allProductIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of campaigns) {
      for (const pid of c.target_product_ids || []) ids.add(pid)
      for (const t of c.tiers ?? []) {
        for (const g of t.gifts ?? []) {
          if (g.product_id) ids.add(g.product_id)
        }
      }
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
  useEffect(() => {
    if (!ownerProfileId || !companyIds.length) { setGradeByCompany({}); setRatesByCompany({}); return }
    let cancelled = false
    void (async () => {
      const [{ data: gradeRows }, { data: rateRows }] = await Promise.all([
        supabase
          .from('brand_owner_grades')
          .select('company_id, grade')
          .eq('owner_id', ownerProfileId)
          .eq('origin_track', 'A')
          .eq('payment_status', 'paid')
          .in('company_id', companyIds),
        supabase
          .from('brand_grade_point_rates')
          .select('company_id, grade, rate')
          .in('company_id', companyIds),
      ])
      if (cancelled) return
      const gMap: Record<string, string> = {}
      for (const r of (gradeRows || []) as { company_id: string; grade: string }[]) {
        gMap[r.company_id] = r.grade
      }
      const rMap: Record<string, Record<string, number>> = {}
      for (const r of (rateRows || []) as { company_id: string; grade: string; rate: number }[]) {
        if (!rMap[r.company_id]) rMap[r.company_id] = {}
        rMap[r.company_id][r.grade] = Number(r.rate)
      }
      setGradeByCompany(gMap)
      setRatesByCompany(rMap)
    })()
    return () => { cancelled = true }
  }, [ownerProfileId, companyIds, supabase])

  const campaignTotal = useCallback((c: HqForcedCampaign) => {
    return (c.target_product_ids || []).reduce((sum, pid) => {
      const p = productMap[pid]
      return sum + (p ? p.supply_price : 0)
    }, 0)
  }, [productMap])

  const packagePricing = useMemo(() => {
    if (!selected) return null
    return computeCampaignPackagePricing(selected, productMap, selectedSets)
  }, [selected, productMap, selectedSets])

  const selectedQtyTiers = selected ? getQtyTiers(selected).sort((a, b) => a.min_qty - b.min_qty) : []

  if (!campaigns.length) return null
  const visibleCampaigns = campaigns.slice(0, visibleCount)
  const selectedCompanyId = selected ? (selected as unknown as { company_id?: string }).company_id : null
  const selectedBalance = selectedCompanyId ? (pointBalances[selectedCompanyId] || 0) : 0
  const selectedRewardBalance = selectedCompanyId ? (rewardBalances[selectedCompanyId] || 0) : 0
  const packageFinalAmount = packagePricing?.finalAmount ?? 0
  const afterArete = usePoints ? Math.max(0, packageFinalAmount - selectedBalance) : packageFinalAmount
  const rewardApplied = usePointsReward ? Math.min(selectedRewardBalance, afterArete) : 0
  const checkoutAmount = Math.max(0, afterArete - rewardApplied)

  const submitOrder = async () => {
    if (!selected || !ownerProfileId || !packagePricing) return
    setOrdering(true)
    try {
      const { finalAmount, baseTotal, gifts } = packagePricing
      const sets = selectedSets

      type LineItem = { product_id: string; name: string; qty: number; unit_price: number; line_amount: number; promo?: string }
      const groups: Record<string, { brand_id: string; items: LineItem[]; amount: number }> = {}

      const targetLines: { pid: string; p: ProductInfo; lineBase: number }[] = []
      for (const pid of selected.target_product_ids || []) {
        const p = productMap[pid]
        if (!p) continue
        targetLines.push({ pid, p, lineBase: p.supply_price * sets })
      }
      if (!targetLines.length) {
        showToast('구성 제품 정보를 불러오지 못했어요')
        setOrdering(false)
        return
      }

      let remainingLineAmount = finalAmount
      targetLines.forEach((row, idx) => {
        const isLast = idx === targetLines.length - 1
        const lineAmount = isLast || baseTotal <= 0
          ? remainingLineAmount
          : Math.round(finalAmount * (row.lineBase / baseTotal))
        remainingLineAmount -= lineAmount
        if (!groups[row.p.brand_id]) {
          groups[row.p.brand_id] = { brand_id: row.p.brand_id, items: [], amount: 0 }
        }
        groups[row.p.brand_id].items.push({
          product_id: row.p.id,
          name: row.p.name,
          qty: sets,
          unit_price: row.p.supply_price,
          line_amount: row.lineBase,
        })
        groups[row.p.brand_id].amount += lineAmount
      })

      for (const g of gifts) {
        const gp = productMap[g.product_id]
        if (!gp) continue
        if (!groups[gp.brand_id]) groups[gp.brand_id] = { brand_id: gp.brand_id, items: [], amount: 0 }
        groups[gp.brand_id].items.push({
          product_id: gp.id,
          name: gp.name,
          qty: g.qty,
          unit_price: 0,
          line_amount: 0,
          promo: g.label,
        })
      }

      const groupList = Object.values(groups)
      const cartItems = groupList.map((g) => ({
        brand_id: g.brand_id,
        profile_id: ownerProfileId,
        owner_name: ownerName,
        salon_name: salonName,
        items: g.items,
        total_qty: g.items.reduce((s, i) => s + i.qty, 0),
        total_amount: g.amount,
      }))

      const result = await submitOrderBatch(cartItems, null, selected.id, selected.id, selectedSets)
      if (!result?.ok) {
        showToast('주문 실패: ' + (result?.message || result?.error || '다시 시도해주세요'))
        setOrdering(false)
        return
      }

      const orderIds: string[] = result.order_ids || []
      const pointsByOrder: Record<string, number> = {}
      if (usePoints && selectedBalance > 0 && orderIds.length) {
        const pointsUsedTotal = Math.min(selectedBalance, finalAmount)
        let remaining = pointsUsedTotal
        orderIds.forEach((id, idx) => {
          const g = groupList[idx]
          if (!g) return
          const share = idx === orderIds.length - 1 ? remaining : Math.round(pointsUsedTotal * (g.amount / Math.max(1, finalAmount)))
          pointsByOrder[id] = Math.min(share, remaining)
          remaining -= pointsByOrder[id]
        })
      }
      const rewardByOrder: Record<string, number> = {}
      if (usePointsReward && selectedRewardBalance > 0 && orderIds.length) {
        const afterAreteTotal = usePoints ? Math.max(0, finalAmount - selectedBalance) : finalAmount
        const rewardUsedTotal = Math.min(selectedRewardBalance, afterAreteTotal)
        if (rewardUsedTotal > 0) {
          let remainingReward = rewardUsedTotal
          orderIds.forEach((id, idx) => {
            const g = groupList[idx]
            if (!g) return
            const share = idx === orderIds.length - 1 ? remainingReward : Math.round(rewardUsedTotal * (g.amount / Math.max(1, afterAreteTotal)))
            rewardByOrder[id] = Math.min(share, remainingReward)
            remainingReward -= rewardByOrder[id]
          })
        }
      }
      const earnedByOrder: Record<string, number> = {}
      if (selectedCompanyId && gradeByCompany[selectedCompanyId] && orderIds.length) {
        const grade = gradeByCompany[selectedCompanyId]
        const rateMap = ratesByCompany[selectedCompanyId] ?? null
        orderIds.forEach((id, idx) => {
          const item = cartItems[idx]
          if (!item) return
          const netForEarning = item.total_amount
          earnedByOrder[id] = calcPointsEarned(netForEarning, grade, rateMap)
        })
      }
      if (orderIds.length) {
        await fetch('/api/brand-orders/apply-event-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_by_order: pointsByOrder, earned_by_order: earnedByOrder }),
        }).catch(() => {})
      }
      if (Object.keys(rewardByOrder).length > 0) {
        await fetch('/api/brand-orders/apply-reward-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_by_order: rewardByOrder }),
        }).catch(() => {})
      }

      showToast('패키지 주문이 접수됐어요!')
      setSelected(null)
    } catch {
      showToast('주문 중 오류가 발생했어요')
    } finally {
      setOrdering(false)
    }
  }

  const tierSummary = (() => {
    if (!packagePricing?.matchedTier) return null
    const t = packagePricing.matchedTier
    if (t.fixed_price != null) return `${t.min_qty}세트 · 확정가 ${t.fixed_price.toLocaleString()}원`
    if (t.discount_pct != null) return `${t.min_qty}세트 · ${t.discount_pct}% 할인`
    if (t.discount_amount != null) return `${t.min_qty}세트 · ${t.discount_amount.toLocaleString()}원 할인`
    return `${t.min_qty}세트 구간`
  })()

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
            <div key={c.id} onClick={() => openCampaignDetail(c)} style={{ ...CARD, cursor: 'pointer' }}>
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

                  {selectedQtyTiers.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: SUB, marginBottom: 8 }}>구매 세트 수</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {selectedQtyTiers.map((t) => (
                          <button
                            key={t.min_qty}
                            type="button"
                            onClick={() => setSelectedSets(t.min_qty)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 8,
                              border: `1px solid ${selectedSets === t.min_qty ? PURPLE : 'rgba(255,255,255,0.15)'}`,
                              background: selectedSets === t.min_qty ? 'rgba(123,94,167,0.25)' : 'transparent',
                              color: selectedSets === t.min_qty ? '#fff' : TEXT,
                              fontSize: 12,
                              fontWeight: selectedSets === t.min_qty ? 600 : 400,
                              cursor: 'pointer',
                            }}
                          >
                            {t.min_qty}세트
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 12, fontWeight: 500, color: SUB, marginBottom: 8 }}>
                    포함 구성 {selectedQtyTiers.length > 0 ? `(세트당 · ${selectedSets}세트 주문)` : ''}
                  </div>
                  {(selected.target_product_ids || []).map((pid) => {
                    const p = productMap[pid]
                    return (
                      <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: 12, color: TEXT }}>
                        <span>{p?.name || '제품'} × {selectedSets}</span>
                        <span style={{ color: SUB }}>{((p?.supply_price || 0) * selectedSets).toLocaleString()}원</span>
                      </div>
                    )
                  })}

                  {packagePricing && packagePricing.discountTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, color: '#c4a7e7' }}>
                      <span>캠페인 할인</span>
                      <span>-{packagePricing.discountTotal.toLocaleString()}원</span>
                    </div>
                  )}

                  {tierSummary && (
                    <div style={{ fontSize: 12, color: '#c4a7e7', marginBottom: 6 }}>적용 구간: {tierSummary}</div>
                  )}

                  {packagePricing && packagePricing.gifts.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: SUB, marginBottom: 6 }}>증정</div>
                      {packagePricing.gifts.map((g, i) => {
                        const gp = productMap[g.product_id]
                        return (
                          <div key={`${g.product_id}-${i}`} style={{ fontSize: 12, color: TEXT, padding: '4px 0' }}>
                            🎁 {gp?.name || '증정품'} × {g.qty}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ ...CARD, marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 8 }}>
                      <span>결제 예정 ({selectedSets}세트)</span>
                      <span>{packageFinalAmount.toLocaleString()}원</span>
                    </div>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TEXT, cursor: 'pointer', flex: 1 }}>
                          <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                          아레테 포인트로 결제할게요 (누적잔액 {selectedBalance.toLocaleString()}P)
                        </label>
                        <button
                          type="button"
                          aria-label="아레테 포인트 안내"
                          aria-expanded={areteHintOpen}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setAreteHintOpen((v) => !v)
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            border: '1px solid #7B5EA7',
                            background: areteHintOpen ? '#7B5EA7' : 'transparent',
                            color: areteHintOpen ? '#fff' : '#c4a7e7',
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: '16px',
                            padding: 0,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          ?
                        </button>
                      </div>
                      {areteHintOpen ? (
                        <div
                          role="tooltip"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: 6,
                            zIndex: 5,
                            maxWidth: 240,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: '#3A3540',
                            color: '#fff',
                            fontSize: 11,
                            lineHeight: 1.5,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                          }}
                        >
                          포인트는 지금 바로 차감되지 않고, 이번 달 청구서에서 한번에 정산돼요
                        </div>
                      ) : null}
                    </div>
                    {selectedRewardBalance > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TEXT, marginBottom: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={usePointsReward} onChange={(e) => setUsePointsReward(e.target.checked)} />
                        일반적립금으로 결제할게요 (누적잔액 {selectedRewardBalance.toLocaleString()}P)
                      </label>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: TEXT }}>
                      <span>{(usePoints || usePointsReward) ? '추가 결제금액' : '패키지 합계'}</span>
                      <span>{checkoutAmount.toLocaleString()}원</span>
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
