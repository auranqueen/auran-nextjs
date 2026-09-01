'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const RED = '#E53935'
const PURPLE = '#7B5EA7'
const DARK_INPUT = {
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(0,0,0,0.25)',
  color: '#fff',
  fontSize: 13,
  boxSizing: 'border-box' as const,
}
const DARK_INPUT_SM = { ...DARK_INPUT, padding: '6px 8px', fontSize: 12 }
type Product = { id: string; brand_id: string; name: string }
type BrandOpt = { id: string; name: string }
type Campaign = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  badge_text: string | null
  campaign_type: 'bundle' | 'gift' | 'discount'
  target_product_ids: string[]
  start_at: string
  end_at: string
  is_active: boolean
  target_grades?: string[] | null
  broadcasted_at?: string | null
  view_count?: number
  order_count?: number
  revenue?: number
  conversion_pct?: number
}
type TierGiftDraft = { product_id: string; qty: string }
type TierDraft = {
  tierType: 'qty' | 'amount'
  min_qty: string
  min_amount: string
  useDiscount: boolean
  discount_pct: string
  discount_amount: string
  useFixedPrice: boolean
  fixed_price: string
  useGifts: boolean
  gifts: TierGiftDraft[]
  highlight_text: string
}
const EMPTY_TIER: TierDraft = {
  tierType: 'qty',
  min_qty: '',
  min_amount: '',
  useDiscount: false, discount_pct: '', discount_amount: '',
  useFixedPrice: false, fixed_price: '',
  useGifts: false, gifts: [],
  highlight_text: '',
}
const EMPTY_DRAFT = {
  title: '',
  badge_text: '',
  image_url: '',
  description: '',
  target_product_ids: [] as string[],
  target_grades: [] as string[],
  tiers: [{ ...EMPTY_TIER }] as TierDraft[],
  start_at: '',
  end_at: '',
}
type Props = { companyId: string | null; staffId: string | null; isCEO: boolean }
const BROADCAST_GRADE_OPTIONS = ['취급점', '전문점', '프리미엄전문점'] as const
export default function BrandHqCampaignSection({ companyId, staffId, isCEO }: Props) {
  const supabase = createClient()
  const [brands, setBrands] = useState<BrandOpt[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [toast, setToast] = useState('')
  const [broadcastPanelId, setBroadcastPanelId] = useState<string | null>(null)
  const [broadcastAll, setBroadcastAll] = useState(true)
  const [broadcastGrades, setBroadcastGrades] = useState<string[]>([])
  const [broadcasting, setBroadcasting] = useState(false)
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const load = useCallback(async () => {
    if (!companyId) return
    const { data: brandRows } = await supabase.from('brands').select('id, name').eq('company_id', companyId)
    setBrands((brandRows || []) as BrandOpt[])
    const brandIds = (brandRows || []).map((b: { id: string }) => b.id)
    if (brandIds.length > 0) {
      const { data: prodRows } = await supabase
        .from('brand_products')
        .select('id, brand_id, name')
        .in('brand_id', brandIds)
        .eq('status', 'active')
      setProducts((prodRows || []) as Product[])
    }
    const { data: campaignRows } = await supabase
      .from('hq_forced_campaigns')
      .select('id, title, description, image_url, badge_text, campaign_type, target_product_ids, start_at, end_at, is_active, target_grades, broadcasted_at')
      .eq('company_id', companyId)
      .is('owner_id', null)
      .order('start_at', { ascending: false })
    const rows = (campaignRows || []) as Campaign[]
    const withStats = await Promise.all(rows.map(async (c) => {
      const [viewsRes, ordersRes] = await Promise.all([
        supabase.from('hq_campaign_views').select('*', { count: 'exact', head: true }).eq('campaign_id', c.id),
        supabase.from('brand_orders').select('total_amount').eq('campaign_id', c.id),
      ])
      const viewCount = viewsRes.count ?? 0
      const orders = (ordersRes.data || []) as { total_amount?: number | null }[]
      const orderCount = orders.length
      const revenue = orders.reduce((sum, o) => sum + Math.trunc(Number(o.total_amount) || 0), 0)
      const conversionPct = viewCount > 0 ? Math.round((orderCount / viewCount) * 100) : 0
      return { ...c, view_count: viewCount, order_count: orderCount, revenue, conversion_pct: conversionPct }
    }))
    setCampaigns(withStats)
  }, [companyId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const toggleProduct = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      target_product_ids: prev.target_product_ids.includes(id)
        ? prev.target_product_ids.filter((p) => p !== id)
        : [...prev.target_product_ids, id],
    }))
  }
  const filteredProducts = productSearch.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    : products
  const updateTier = (idx: number, patch: Partial<TierDraft>) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }))
  }
  const addQtyTier = () => setDraft((prev) => ({ ...prev, tiers: [...prev.tiers, { ...EMPTY_TIER, tierType: 'qty' }] }))
  const addAmountTier = () => setDraft((prev) => ({ ...prev, tiers: [...prev.tiers, { ...EMPTY_TIER, tierType: 'amount' }] }))
  const removeTier = (idx: number) =>
    setDraft((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) }))
  const addTierGift = (tierIdx: number) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => i === tierIdx ? { ...t, gifts: [...t.gifts, { product_id: '', qty: '1' }] } : t),
    }))
  }
  const updateTierGift = (tierIdx: number, giftIdx: number, patch: Partial<TierGiftDraft>) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => i === tierIdx ? {
        ...t,
        gifts: t.gifts.map((g, j) => j === giftIdx ? { ...g, ...patch } : g),
      } : t),
    }))
  }
  const removeTierGift = (tierIdx: number, giftIdx: number) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) => i === tierIdx ? { ...t, gifts: t.gifts.filter((_, j) => j !== giftIdx) } : t),
    }))
  }
  const uploadCampaignImage = async (file: File) => {
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `campaign-images/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
      if (error || !data) { return }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      setDraft((prev) => ({ ...prev, image_url: urlData.publicUrl }))
    } finally {
      setUploadingImage(false)
    }
  }
  const submit = async () => {
    if (!companyId) return
    if (!draft.title.trim()) { showToast('캠페인명을 입력해주세요'); return }
    if (draft.target_product_ids.length === 0) { showToast('제품을 하나 이상 골라주세요'); return }
    if (!draft.start_at || !draft.end_at) { showToast('시작일/종료일을 입력해주세요'); return }

    for (let i = 0; i < draft.tiers.length; i++) {
      const t = draft.tiers[i]
      const minQty = Math.trunc(Number(t.min_qty) || 0)
      const minAmount = Math.trunc(Number(t.min_amount) || 0)
      const hasThreshold = t.tierType === 'qty' ? minQty > 0 : minAmount > 0
      if (!hasThreshold) continue

      const hasDiscount =
        t.useDiscount &&
        (String(t.discount_pct || '').trim() !== '' || String(t.discount_amount || '').trim() !== '')
      const hasFixedPrice = t.useFixedPrice && String(t.fixed_price || '').trim() !== ''
      const hasGifts = t.useGifts && t.gifts.some((g) => Boolean(g.product_id))
      if (hasDiscount || hasFixedPrice || hasGifts) continue

      const label =
        t.tierType === 'qty' ? `${minQty}개 이상` : `${minAmount.toLocaleString()}원 이상`
      showToast(
        `${i + 1}번째 구간(${label})에 할인/확정가/증정품 중 하나도 설정 안 되어있어요. 혜택을 추가하거나 그 구간을 삭제해주세요`,
      )
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/brand/hq-campaigns/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          company_id: companyId,
          staff_id: staffId,
          title: draft.title.trim(),
          badge_text: draft.badge_text.trim() || null,
          description: draft.description,
          image_url: draft.image_url,
          campaign_type: 'discount',
          target_product_ids: draft.target_product_ids,
          target_grades: draft.target_grades,
          tiers: draft.tiers.map((t) => ({
            min_qty: t.tierType === 'qty' ? t.min_qty : 0,
            min_amount: t.tierType === 'amount' ? t.min_amount : null,
            discount_pct: t.tierType === 'qty' && t.useDiscount ? t.discount_pct : null,
            discount_amount: t.tierType === 'qty' && t.useDiscount ? t.discount_amount : null,
            fixed_price: t.tierType === 'qty' && t.useFixedPrice ? t.fixed_price : null,
            gifts: t.useGifts ? t.gifts.filter(g => g.product_id) : [],
            highlight_text: t.tierType === 'amount' && t.highlight_text ? t.highlight_text : null,
          })),
          start_at: draft.start_at,
          end_at: draft.end_at,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('저장 실패')
        return
      }
      showToast('캠페인이 등록됐어요')
      setShowForm(false)
      setDraft(EMPTY_DRAFT)
      await load()
    } finally {
      setSaving(false)
    }
  }
  const remove = async (id: string) => {
    if (!companyId) return
    if (!window.confirm('이 캠페인을 삭제할까요?')) return
    const res = await fetch('/api/brand/hq-campaigns/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ company_id: companyId, id, staff_id: staffId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) {
      showToast('삭제 실패')
      return
    }
    showToast('삭제됐어요')
    await load()
  }
  const openBroadcastPanel = (campaignId: string) => {
    setBroadcastPanelId((prev) => (prev === campaignId ? null : campaignId))
    setBroadcastAll(true)
    setBroadcastGrades([])
  }
  const toggleBroadcastGrade = (grade: string) => {
    setBroadcastGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    )
  }
  const confirmBroadcast = async (campaignId: string) => {
    if (!companyId) return
    const targetGrades = broadcastAll ? 'all' : broadcastGrades
    if (!broadcastAll && broadcastGrades.length === 0) {
      showToast('등급을 선택해주세요')
      return
    }
    setBroadcasting(true)
    try {
      const res = await fetch('/api/brand/campaigns/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          company_id: companyId,
          staff_id: staffId,
          campaign_id: campaignId,
          target_grades: targetGrades,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        showToast('발송 실패')
        return
      }
      showToast(`${json.sent_count ?? 0}명에게 발송했어요`)
      setBroadcastPanelId(null)
      await load()
    } finally {
      setBroadcasting(false)
    }
  }
  const tierToggleStyle = (selected: boolean) => ({
    fontSize: 11,
    padding: '4px 12px',
    borderRadius: 20,
    border: `0.5px solid ${selected ? 'rgba(123,94,167,0.5)' : 'rgba(255,255,255,0.15)'}`,
    background: selected ? 'rgba(123,94,167,0.2)' : 'transparent',
    color: selected ? '#c4a7e7' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer' as const,
  })
  if (!companyId) return null
  return (
    <div style={{ border: `1px solid rgba(229,57,53,0.3)`, borderRadius: 12, background: 'rgba(229,57,53,0.05)', padding: 16, marginBottom: 16 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: RED, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 15 }}>🔥</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ff8a80' }}>본사 특별캠페인</span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
        전체 원장 대상 · 재구매 발송처리시 자동 적용됩니다
      </div>
      {campaigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {campaigns.map((c) => (
            <div key={c.id} style={{ border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 12, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {c.badge_text && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7' }}>{c.badge_text}</span>
                )}
                <span style={{ fontSize: 13, color: '#fff' }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                {c.start_at?.slice(0, 10)} ~ {c.end_at?.slice(0, 10)} · 제품 {c.target_product_ids?.length || 0}개
                {c.broadcasted_at ? (
                  <span style={{ marginLeft: 8, color: 'rgba(129,199,132,0.85)' }}>
                    · 발송 {new Date(c.broadcasted_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 12, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                <span>👀 읽음 {c.view_count ?? 0}</span>
                <span>🛒 구매 {c.order_count ?? 0}건</span>
                <span>💰 매출 {(c.revenue ?? 0).toLocaleString()}원</span>
                <span>📈 전환율 {c.conversion_pct ?? 0}%</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                <button type="button" onClick={() => openBroadcastPanel(c.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(255,193,7,0.35)', background: 'rgba(255,193,7,0.1)', color: 'rgba(255,193,7,0.9)', cursor: 'pointer' }}>
                  {c.broadcasted_at ? '재발송' : '발송'}
                </button>
                <button type="button" onClick={() => void remove(c.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
              {broadcastPanelId === c.id && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.2)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>발송 대상</div>
                  <button
                    type="button"
                    onClick={() => { setBroadcastAll(true); setBroadcastGrades([]) }}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, marginRight: 6, marginBottom: 6, border: `0.5px solid ${broadcastAll ? 'rgba(255,193,7,0.5)' : 'rgba(255,255,255,0.15)'}`, background: broadcastAll ? 'rgba(255,193,7,0.15)' : 'transparent', color: broadcastAll ? 'rgba(255,193,7,0.95)' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                  >
                    전체 원장
                  </button>
                  {BROADCAST_GRADE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { setBroadcastAll(false); toggleBroadcastGrade(g) }}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, marginRight: 6, marginBottom: 6, border: `0.5px solid ${!broadcastAll && broadcastGrades.includes(g) ? 'rgba(123,94,167,0.5)' : 'rgba(255,255,255,0.15)'}`, background: !broadcastAll && broadcastGrades.includes(g) ? 'rgba(123,94,167,0.2)' : 'transparent', color: !broadcastAll && broadcastGrades.includes(g) ? '#c4a7e7' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                    >
                      {g}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={broadcasting}
                    onClick={() => void confirmBroadcast(c.id)}
                    style={{ display: 'block', width: '100%', marginTop: 6, padding: '7px', fontSize: 12, borderRadius: 6, border: 'none', background: broadcasting ? 'rgba(123,94,167,0.35)' : PURPLE, color: '#fff', cursor: broadcasting ? 'not-allowed' : 'pointer' }}
                  >
                    {broadcasting ? '발송 중...' : '발송하기'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        style={{ width: '100%', padding: 9, borderRadius: 8, border: `1px solid rgba(229,57,53,0.4)`, background: showForm ? 'rgba(229,57,53,0.1)' : 'transparent', color: '#ff8a80', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
      >
        {showForm ? '닫기' : '+ 새 캠페인 만들기'}
      </button>
      {showForm && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>캠페인명</div>
          <input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="예: 바로코빈C 콜라겐 앰플 프로모션"
            style={{ ...DARK_INPUT, width: '100%', marginBottom: 10 }}
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="캠페인 상세설명 (구성, 조건, 유통기한 등)"
            rows={3}
            style={{ ...DARK_INPUT, width: '100%', marginBottom: 8, resize: 'vertical' }}
          />
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>노출 대상</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
              <input
                type="checkbox"
                checked={draft.target_grades.length === 0}
                onChange={(e) => setDraft((prev) => ({ ...prev, target_grades: e.target.checked ? [] : ['취급점'] }))}
              />
              전체 등급
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 24, opacity: draft.target_grades.length === 0 ? 0.4 : 1, pointerEvents: draft.target_grades.length === 0 ? 'none' : 'auto' }}>
              {['취급점', '전문점', '프리미엄전문점', '메디슈티컬'].map((g) => (
                <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  <input
                    type="checkbox"
                    checked={draft.target_grades.includes(g)}
                    onChange={(e) => setDraft((prev) => ({
                      ...prev,
                      target_grades: e.target.checked
                        ? [...prev.target_grades, g]
                        : prev.target_grades.filter((x) => x !== g),
                    }))}
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCampaignImage(f) }}
            style={{ marginBottom: 4, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
          />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>권장 사이즈 1080×1350px (세로 4:5), 5MB 이하</p>
          {draft.image_url && <img src={draft.image_url} alt="미리보기" style={{ maxWidth: 120, borderRadius: 8, marginBottom: 8 }} />}
          {uploadingImage && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>업로드 중...</p>}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>배지문구(선택)</div>
          <input
            value={draft.badge_text}
            onChange={(e) => setDraft((p) => ({ ...p, badge_text: e.target.value }))}
            placeholder="예: 최대 40%할인"
            style={{ ...DARK_INPUT, width: '100%', marginBottom: 10 }}
          />
          {draft.tiers.map((tier, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button type="button" onClick={() => updateTier(idx, { tierType: 'qty' })} style={tierToggleStyle(tier.tierType === 'qty')}>수량기준</button>
                <button type="button" onClick={() => updateTier(idx, { tierType: 'amount' })} style={tierToggleStyle(tier.tierType === 'amount')}>금액기준</button>
                {draft.tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(idx)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#e88', cursor: 'pointer', fontSize: 16 }}>×</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="text"
                  value={tier.tierType === 'qty' ? tier.min_qty : tier.min_amount}
                  onChange={(e) => updateTier(idx, tier.tierType === 'qty' ? { min_qty: e.target.value } : { min_amount: e.target.value })}
                  style={{ ...DARK_INPUT_SM, width: 80 }}
                />
                <span style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7' }}>
                  {tier.tierType === 'qty' ? '개' : '원'}
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                  {tier.tierType === 'qty' ? '개 이상' : '원 이상'}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                <input type="checkbox" checked={tier.useDiscount} onChange={(e) => updateTier(idx, { useDiscount: e.target.checked })} />
                할인 적용
              </label>
              {tier.useDiscount && tier.tierType === 'qty' && (
                <div style={{ display: 'flex', gap: 6, marginLeft: 24, marginBottom: 10 }}>
                  <input type="text" placeholder="% 할인" value={tier.discount_pct} onChange={(e) => updateTier(idx, { discount_pct: e.target.value, discount_amount: '' })} style={{ ...DARK_INPUT_SM, width: 80 }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>또는</span>
                  <input type="text" placeholder="원 할인" value={tier.discount_amount} onChange={(e) => updateTier(idx, { discount_amount: e.target.value, discount_pct: '' })} style={{ ...DARK_INPUT_SM, width: 100 }} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                <input type="checkbox" checked={tier.useFixedPrice} onChange={(e) => updateTier(idx, { useFixedPrice: e.target.checked })} />
                확정가로 판매
              </label>
              {tier.useFixedPrice && tier.tierType === 'qty' && (
                <div style={{ marginLeft: 24, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="text" placeholder="230000" value={tier.fixed_price} onChange={(e) => updateTier(idx, { fixed_price: e.target.value })} style={{ ...DARK_INPUT_SM, width: 120 }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>원</span>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                <input type="checkbox" checked={tier.useGifts} onChange={(e) => updateTier(idx, { useGifts: e.target.checked })} />
                증정품 추가
              </label>
              {tier.useGifts && (
                <div style={{ marginLeft: 24, marginBottom: 10 }}>
                  {tier.gifts.map((g, gIdx) => {
                    const selectedName = products.find((p) => p.id === g.product_id)?.name || ''
                    const listId = `gift-products-${idx}-${gIdx}`
                    return (
                      <div key={gIdx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <input
                          type="text"
                          list={listId}
                          defaultValue={selectedName}
                          placeholder="증정 제품명 검색"
                          onChange={(e) => {
                            const match = products.find((p) => p.name === e.target.value)
                            if (match) updateTierGift(idx, gIdx, { product_id: match.id })
                          }}
                          style={{ ...DARK_INPUT_SM, flex: 1 }}
                        />
                        <datalist id={listId}>
                          {products.map((p) => (
                            <option key={p.id} value={p.name} />
                          ))}
                        </datalist>
                        <input type="text" value={g.qty} onChange={(e) => updateTierGift(idx, gIdx, { qty: e.target.value })} style={{ ...DARK_INPUT_SM, width: 50 }} />
                        <button type="button" onClick={() => removeTierGift(idx, gIdx)} style={{ background: 'transparent', border: 'none', color: '#e88', cursor: 'pointer' }}>×</button>
                      </div>
                    )
                  })}
                  <button type="button" onClick={() => addTierGift(idx)} style={{ fontSize: 12, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}>+ 증정품 추가</button>
                </div>
              )}
              {tier.tierType === 'amount' && (
                <input
                  type="text"
                  value={tier.highlight_text}
                  onChange={(e) => updateTier(idx, { highlight_text: e.target.value })}
                  placeholder="원장님께 보일 안내 문구 (선택)"
                  style={{ ...DARK_INPUT, width: '100%', fontSize: 12 }}
                />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={addQtyTier} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer' }}>+ 수량구간 추가</button>
            <button type="button" onClick={addAmountTier} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(123,94,167,0.35)', background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer' }}>+ 금액구간 추가</button>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>대상 제품(컴퍼니 전체 브랜드, 복수선택 — 교차주문시 수량 합산)</div>
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="제품명으로 검색 (예: 메쓰크림)"
            style={{ ...DARK_INPUT, width: '100%', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10, maxHeight: 140, overflowY: 'auto' as const }}>
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p.id)}
                style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${draft.target_product_ids.includes(p.id) ? RED : 'rgba(255,255,255,0.12)'}`, background: draft.target_product_ids.includes(p.id) ? 'rgba(229,57,53,0.1)' : 'transparent', color: draft.target_product_ids.includes(p.id) ? '#ff8a80' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>시작일</div>
              <input type="date" value={draft.start_at} onChange={(e) => setDraft((p) => ({ ...p, start_at: e.target.value }))} style={{ ...DARK_INPUT, width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>종료일</div>
              <input type="date" value={draft.end_at} onChange={(e) => setDraft((p) => ({ ...p, end_at: e.target.value }))} style={{ ...DARK_INPUT, width: '100%' }} />
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: RED, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '등록 중…' : '캠페인 등록 (전체 원장에게 즉시 노출)'}
          </button>
        </div>
      )}
    </div>
  )
}
