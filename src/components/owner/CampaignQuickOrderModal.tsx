'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { submitOrderBatch } from '@/lib/brand/submitOrderBatch'
import { resolveHqCampaignEffects, type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'
import { calcPointsEarned } from '@/lib/brand/brandOrderPromos'

type ProductInfo = {
  name: string
  supply_price: number
  brand_id: string
  thumb_img?: string | null
}

type CampaignDetail = HqForcedCampaign & {
  company_id: string
  target_grades?: string[] | null
  in_period?: boolean
  not_started?: boolean
  expired?: boolean
}

interface Props {
  campaignId: string
  ownerProfileId: string
  onClose: () => void
}

const PURPLE = '#7B5EA7'
const CARD: CSSProperties = {
  background: '#F8F4FC',
  border: '1px solid #EDE6DA',
  borderRadius: 10,
  padding: 12,
}

function FullViewportModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 18,
          background: '#fff',
          padding: 16,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'sticky',
            top: 0,
            float: 'right',
            zIndex: 2,
            width: 32,
            height: 32,
            border: 'none',
            background: 'transparent',
            color: '#666',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

export default function CampaignQuickOrderModal({ campaignId, ownerProfileId, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [productMap, setProductMap] = useState<Record<string, ProductInfo>>({})
  const [areteBalance, setAreteBalance] = useState(0)
  const [rewardBalance, setRewardBalance] = useState(0)
  const [grade, setGrade] = useState('취급점')
  const [rateMap, setRateMap] = useState<Record<string, number> | null>(null)
  const [usePoints, setUsePoints] = useState(true)
  const [usePointsReward, setUsePointsReward] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [toast, setToast] = useState('')
  const [done, setDone] = useState(false)
  const [earnedPreview, setEarnedPreview] = useState(0)

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/owner/campaigns/${encodeURIComponent(campaignId)}`)
      const json = await res.json().catch(() => ({})) as {
        ok?: boolean
        error?: string
        message?: string
        campaign?: CampaignDetail
        products?: Record<string, ProductInfo>
      }
      if (!res.ok || !json.ok || !json.campaign) {
        setLoadError(json.message || json.error || `불러오기 실패 (${res.status})`)
        setCampaign(null)
        setProductMap({})
        return
      }
      setCampaign(json.campaign)
      setProductMap(json.products || {})

      const companyId = json.campaign.company_id
      if (companyId && ownerProfileId) {
        const [{ data: arete }, { data: reward }, { data: gradeRow }, { data: rateRows }] = await Promise.all([
          supabase
            .from('brand_points')
            .select('balance')
            .eq('company_id', companyId)
            .eq('owner_id', ownerProfileId)
            .eq('track', 'ARETE')
            .maybeSingle(),
          supabase
            .from('brand_points')
            .select('balance')
            .eq('company_id', companyId)
            .eq('owner_id', ownerProfileId)
            .eq('track', 'REWARD')
            .maybeSingle(),
          supabase
            .from('brand_owner_grades')
            .select('grade')
            .eq('owner_id', ownerProfileId)
            .eq('company_id', companyId)
            .eq('origin_track', 'A')
            .eq('payment_status', 'paid')
            .maybeSingle(),
          supabase
            .from('brand_grade_point_rates')
            .select('grade, rate')
            .eq('company_id', companyId),
        ])
        setAreteBalance(Math.trunc(Number(arete?.balance) || 0))
        setRewardBalance(Math.trunc(Number(reward?.balance) || 0))
        setGrade(String(gradeRow?.grade || '취급점'))
        const rMap: Record<string, number> = {}
        for (const r of (rateRows || []) as { grade: string; rate: number }[]) {
          rMap[r.grade] = Number(r.rate)
        }
        setRateMap(Object.keys(rMap).length ? rMap : null)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '불러오기 중 오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }, [campaignId, ownerProfileId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const packageTotal = useMemo(() => {
    if (!campaign) return 0
    return (campaign.target_product_ids || []).reduce((sum, pid) => {
      const p = productMap[pid]
      return sum + (p ? p.supply_price : 0)
    }, 0)
  }, [campaign, productMap])

  const effects = useMemo(() => {
    if (!campaign) return { discountTotal: 0, giftLines: [] as ReturnType<typeof resolveHqCampaignEffects>['giftLines'] }
    const items = (campaign.target_product_ids || [])
      .map((pid) => {
        const p = productMap[pid]
        if (!p) return null
        return { product_id: pid, qty: 1, unit_price: p.supply_price }
      })
      .filter(Boolean) as { product_id: string; qty: number; unit_price: number }[]
    return resolveHqCampaignEffects(items, [campaign])
  }, [campaign, productMap])

  const afterDiscount = Math.max(0, packageTotal - effects.discountTotal)
  const afterArete = usePoints ? Math.max(0, afterDiscount - areteBalance) : afterDiscount
  const rewardApplied = usePointsReward ? Math.min(rewardBalance, afterArete) : 0
  const finalAmount = Math.max(0, afterArete - rewardApplied)

  const submitOrder = async () => {
    if (!campaign || !ownerProfileId) return
    if (campaign.expired || campaign.not_started || campaign.in_period === false) {
      showToast(campaign.expired ? '종료된 캠페인이에요' : '아직 시작 전인 캠페인이에요')
      return
    }
    setOrdering(true)
    try {
      const groups: Record<
        string,
        { brand_id: string; items: { product_id: string; name: string; qty: number; unit_price: number; line_amount: number }[]; amount: number }
      > = {}
      for (const pid of campaign.target_product_ids || []) {
        const p = productMap[pid]
        if (!p) continue
        if (!groups[p.brand_id]) groups[p.brand_id] = { brand_id: p.brand_id, items: [], amount: 0 }
        groups[p.brand_id].items.push({
          product_id: pid,
          name: p.name,
          qty: 1,
          unit_price: p.supply_price,
          line_amount: p.supply_price,
        })
        groups[p.brand_id].amount += p.supply_price
      }
      const groupList = Object.values(groups)
      if (!groupList.length) {
        showToast('구성 제품 정보를 불러오지 못했어요')
        setOrdering(false)
        return
      }

      const allCartItemsForEffects = groupList.flatMap((g) =>
        g.items.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.unit_price })),
      )
      const { discountTotal } = resolveHqCampaignEffects(allCartItemsForEffects, [campaign])
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

      const result = await submitOrderBatch(cartItems, null, campaign.id)
      if (!result?.ok) {
        showToast('주문 실패: ' + (result?.message || result?.error || '다시 시도해주세요'))
        setOrdering(false)
        return
      }

      const orderIds: string[] = result.order_ids || []
      const pointsByOrder: Record<string, number> = {}
      if (usePoints && areteBalance > 0 && orderIds.length) {
        const grandTotal = rawGrandTotal - discountTotal
        const pointsUsedTotal = Math.min(areteBalance, grandTotal)
        let remaining = pointsUsedTotal
        orderIds.forEach((id, idx) => {
          const g = groupList[idx]
          if (!g) return
          const share = idx === orderIds.length - 1 ? remaining : Math.round(pointsUsedTotal * (g.amount / grandTotal))
          pointsByOrder[id] = Math.min(share, remaining)
          remaining -= pointsByOrder[id]
        })
      }

      const rewardByOrder: Record<string, number> = {}
      if (usePointsReward && rewardBalance > 0 && orderIds.length) {
        const afterAreteTotal = usePoints
          ? Math.max(0, rawGrandTotal - discountTotal - areteBalance)
          : rawGrandTotal - discountTotal
        const rewardUsedTotal = Math.min(rewardBalance, afterAreteTotal)
        if (rewardUsedTotal > 0) {
          let remainingReward = rewardUsedTotal
          orderIds.forEach((id, idx) => {
            const g = groupList[idx]
            if (!g) return
            const share =
              idx === orderIds.length - 1
                ? remainingReward
                : Math.round(rewardUsedTotal * (g.amount / Math.max(1, afterAreteTotal)))
            rewardByOrder[id] = Math.min(share, remainingReward)
            remainingReward -= rewardByOrder[id]
          })
        }
      }

      const earnedByOrder: Record<string, number> = {}
      let earnedSum = 0
      if (orderIds.length) {
        orderIds.forEach((id, idx) => {
          const item = cartItems[idx]
          if (!item) return
          const areteUsed = pointsByOrder[id] || 0
          const rewardUsed = rewardByOrder[id] || 0
          const netForEarning = Math.max(0, item.total_amount - areteUsed - rewardUsed)
          const earned = calcPointsEarned(netForEarning, grade, rateMap)
          earnedByOrder[id] = earned
          earnedSum += earned
        })
      }

      if (orderIds.length) {
        const pointsRes = await fetch('/api/brand-orders/apply-event-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_by_order: pointsByOrder, earned_by_order: earnedByOrder }),
        })
        if (!pointsRes.ok) {
          const pj = await pointsRes.json().catch(() => ({})) as { message?: string; error?: string }
          showToast('주문은 접수됐지만 아레테 포인트 적용 실패: ' + (pj.message || pj.error || pointsRes.status))
        }
      }
      if (Object.keys(rewardByOrder).length > 0) {
        const rewardRes = await fetch('/api/brand-orders/apply-reward-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_by_order: rewardByOrder }),
        })
        if (!rewardRes.ok) {
          const rj = await rewardRes.json().catch(() => ({})) as { message?: string; error?: string }
          showToast('주문은 접수됐지만 일반적립금 적용 실패: ' + (rj.message || rj.error || rewardRes.status))
        }
      }

      setEarnedPreview(earnedSum)
      setDone(true)
    } catch (e) {
      showToast('주문 중 오류: ' + (e instanceof Error ? e.message : '다시 시도해주세요'))
    } finally {
      setOrdering(false)
    }
  }

  return (
    <FullViewportModal onClose={onClose}>
      {toast ? (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '7px 18px',
            borderRadius: 20,
            zIndex: 10000,
            maxWidth: '90vw',
          }}
        >
          {toast}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#8A7E72', fontSize: 13 }}>
          불러오는 중…
        </div>
      ) : loadError ? (
        <div style={{ padding: '24px 8px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#3A3540', marginBottom: 8 }}>불러오기 실패</div>
          <div style={{ fontSize: 13, color: '#c44', lineHeight: 1.5, marginBottom: 16 }}>{loadError}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      ) : done ? (
        <div style={{ padding: '8px 4px 12px', clear: 'both' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#3A3540', marginBottom: 12, lineHeight: 1.4 }}>
            ✅ 선주문이 완료됐어요!
          </div>
          <div style={{ fontSize: 13, color: '#5A5248', lineHeight: 1.6, marginBottom: 8 }}>
            예상 적립포인트: <strong>{earnedPreview.toLocaleString()}원</strong>
            <br />
            (다음 달 청구서 정산 시 반영돼요)
          </div>
          <div style={{ fontSize: 13, color: '#8A7E72', lineHeight: 1.6, marginBottom: 20 }}>
            본사 발주현황에 반영되어 물류로 전달됩니다
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            확인
          </button>
        </div>
      ) : campaign ? (
        <div style={{ clear: 'both', paddingTop: 4 }}>
          {campaign.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.image_url}
              alt=""
              style={{ width: '100%', aspectRatio: '16/7', objectFit: 'cover', borderRadius: 10, marginBottom: 12 }}
            />
          ) : null}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#3A3540', marginBottom: 6 }}>
            {campaign.title || '캠페인'}
          </div>
          {campaign.expired ? (
            <div style={{ fontSize: 12, color: '#c44', marginBottom: 8 }}>종료된 캠페인이에요</div>
          ) : campaign.not_started ? (
            <div style={{ fontSize: 12, color: '#a8863f', marginBottom: 8 }}>아직 시작 전인 캠페인이에요</div>
          ) : null}
          {campaign.description ? (
            <div style={{ fontSize: 12, color: '#8A7E72', lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-wrap' }}>
              {campaign.description}
            </div>
          ) : null}

          <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7E72', marginBottom: 8 }}>포함 구성</div>
          {(campaign.target_product_ids || []).map((pid) => {
            const p = productMap[pid]
            return (
              <div
                key={pid}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #F0EBE3',
                  fontSize: 13,
                  color: '#3A3540',
                }}
              >
                <span>{p?.name || '제품'}</span>
                <span style={{ color: '#8A7E72' }}>{(p?.supply_price || 0).toLocaleString()}원</span>
              </div>
            )
          })}

          {(campaign.tiers || []).length > 0 ? (
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7E72', marginBottom: 6 }}>혜택 구간</div>
              {(campaign.tiers || []).map((t, i) => {
                const parts: string[] = []
                if (t.min_qty > 0) parts.push(`${t.min_qty}개↑`)
                if (t.min_amount != null && t.min_amount > 0) parts.push(`${t.min_amount.toLocaleString()}원↑`)
                if (t.fixed_price != null) parts.push(`확정가 ${t.fixed_price.toLocaleString()}원`)
                else if (t.discount_pct != null) parts.push(`${t.discount_pct}% 할인`)
                else if (t.discount_amount != null) parts.push(`${t.discount_amount.toLocaleString()}원 할인`)
                if ((t.gifts || []).length) parts.push(`증정 ${(t.gifts || []).length}종`)
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 12,
                      color: '#5A5248',
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#FBF8F4',
                      border: '1px solid #EDE6DA',
                      marginBottom: 6,
                    }}
                  >
                    {t.highlight_text || parts.join(' · ') || `구간 ${i + 1}`}
                  </div>
                )
              })}
            </div>
          ) : null}

          <div style={{ ...CARD, marginTop: 14 }}>
            {areteBalance > 0 ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#3A3540',
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                아레테 포인트로 결제할게요 (누적잔액 {areteBalance.toLocaleString()}P)
              </label>
            ) : null}
            {rewardBalance > 0 ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#3A3540',
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={usePointsReward}
                  onChange={(e) => setUsePointsReward(e.target.checked)}
                />
                일반적립금으로 결제할게요 (누적잔액 {rewardBalance.toLocaleString()}P)
              </label>
            ) : null}
            {effects.discountTotal > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A7E72', marginBottom: 4 }}>
                <span>캠페인 할인</span>
                <span>-{effects.discountTotal.toLocaleString()}원</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#3A3540' }}>
              <span>{usePoints || usePointsReward ? '추가 결제금액' : '패키지 합계'}</span>
              <span>{finalAmount.toLocaleString()}원</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: '1px solid #EDE6DA',
                background: '#fff',
                color: '#8A7E72',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              다음에 하기
            </button>
            <button
              type="button"
              onClick={() => void submitOrder()}
              disabled={ordering || Boolean(campaign.expired) || Boolean(campaign.not_started)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background:
                  ordering || campaign.expired || campaign.not_started ? 'rgba(123,94,167,0.4)' : PURPLE,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: ordering || campaign.expired || campaign.not_started ? 'not-allowed' : 'pointer',
              }}
            >
              {ordering ? '처리 중…' : '주문하기'}
            </button>
          </div>
        </div>
      ) : null}
    </FullViewportModal>
  )
}
