'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const RED = '#E53935'
type Product = { id: string; brand_id: string; name: string }
type BrandOpt = { id: string; name: string }
type CampaignTier = { min_qty: number; discount_pct: number | null; discount_amount: number | null }
type Campaign = {
  id: string
  title: string
  badge_text: string | null
  campaign_type: 'bundle' | 'gift' | 'discount'
  target_product_ids: string[]
  start_at: string
  end_at: string
  is_active: boolean
}
type TierGiftDraft = { product_id: string; qty: string }
type TierDraft = {
  min_qty: string
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
  min_qty: '',
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
  campaign_type: 'bundle' as 'bundle' | 'gift' | 'discount',
  target_product_ids: [] as string[],
  buy_qty: '',
  bonus_qty: '',
  gift_product_id: '',
  tiers: [{ ...EMPTY_TIER }] as TierDraft[],
  start_at: '',
  end_at: '',
}
type Props = { companyId: string | null; staffId: string | null; isCEO: boolean }
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
      .select('id, title, badge_text, campaign_type, target_product_ids, start_at, end_at, is_active')
      .eq('company_id', companyId)
      .is('owner_id', null)
      .order('start_at', { ascending: false })
    setCampaigns((campaignRows || []) as Campaign[])
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
  const addTier = () => setDraft((prev) => ({ ...prev, tiers: [...prev.tiers, { ...EMPTY_TIER }] }))
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
    if (!draft.title.trim()) { showToast('이벤트명을 입력해주세요'); return }
    if (draft.target_product_ids.length === 0) { showToast('제품을 하나 이상 골라주세요'); return }
    if (!draft.start_at || !draft.end_at) { showToast('시작일/종료일을 입력해주세요'); return }
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
          campaign_type: draft.campaign_type,
          target_product_ids: draft.target_product_ids,
          buy_qty: draft.buy_qty ? Number(draft.buy_qty) : null,
          bonus_qty: draft.bonus_qty ? Number(draft.bonus_qty) : null,
          gift_product_id: draft.gift_product_id || null,
          tiers: draft.tiers.map((t) => ({
            min_qty: t.min_qty,
            discount_pct: t.useDiscount ? t.discount_pct : null,
            discount_amount: t.useDiscount ? t.discount_amount : null,
            fixed_price: t.useFixedPrice ? t.fixed_price : null,
            gifts: t.useGifts ? t.gifts.filter(g => g.product_id) : [],
            highlight_text: t.highlight_text || null,
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
      showToast('이벤트가 등록됐어요')
      setShowForm(false)
      setDraft(EMPTY_DRAFT)
      await load()
    } finally {
      setSaving(false)
    }
  }
  const remove = async (id: string) => {
    if (!companyId) return
    if (!window.confirm('이 이벤트를 삭제할까요?')) return
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
        <span style={{ fontSize: 13, fontWeight: 600, color: '#ff8a80' }}>본사 특별이벤트</span>
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
              </div>
              <button type="button" onClick={() => void remove(c.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', cursor: 'pointer' }}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        style={{ width: '100%', padding: 9, borderRadius: 8, border: `1px solid rgba(229,57,53,0.4)`, background: showForm ? 'rgba(229,57,53,0.1)' : 'transparent', color: '#ff8a80', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
      >
        {showForm ? '닫기' : '+ 새 이벤트 만들기'}
      </button>
      {showForm && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>이벤트명</div>
          <input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="예: 바로코빈C 콜라겐 앰플 프로모션"
            style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="이벤트 상세설명 (구성, 조건, 유통기한 등)"
            rows={3}
            style={{ width: '100%', marginBottom: 8, resize: 'vertical' }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCampaignImage(f) }}
            style={{ marginBottom: 4 }}
          />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>권장 사이즈 1080×1350px (세로 4:5), 5MB 이하</p>
          {draft.image_url && <img src={draft.image_url} alt="미리보기" style={{ maxWidth: 120, borderRadius: 8, marginBottom: 8 }} />}
          {uploadingImage && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>업로드 중...</p>}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>배지문구(선택)</div>
          <input
            value={draft.badge_text}
            onChange={(e) => setDraft((p) => ({ ...p, badge_text: e.target.value }))}
            placeholder="예: 최대 40%할인"
            style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>유형</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([
              { key: 'bundle', label: 'N+M 증정' },
              { key: 'gift', label: '다른제품 증정' },
              { key: 'discount', label: '수량별 할인' },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setDraft((p) => ({ ...p, campaign_type: t.key }))}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${draft.campaign_type === t.key ? RED : 'rgba(255,255,255,0.12)'}`, background: draft.campaign_type === t.key ? 'rgba(229,57,53,0.1)' : 'transparent', color: draft.campaign_type === t.key ? '#ff8a80' : 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {draft.campaign_type === 'bundle' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="number" placeholder="N개(구매)" value={draft.buy_qty} onChange={(e) => setDraft((p) => ({ ...p, buy_qty: e.target.value }))} style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
              <input type="number" placeholder="M개(증정)" value={draft.bonus_qty} onChange={(e) => setDraft((p) => ({ ...p, bonus_qty: e.target.value }))} style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          )}
          {draft.tiers.map((tier, idx) => (
            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>수량</span>
                <input type="text" value={tier.min_qty} onChange={(e) => updateTier(idx, { min_qty: e.target.value })} style={{ width: 60 }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>개 이상</span>
                {draft.tiers.length > 1 && <button onClick={() => removeTier(idx)} style={{ marginLeft: 'auto' }}>×</button>}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                <input type="checkbox" checked={tier.useDiscount} onChange={(e) => updateTier(idx, { useDiscount: e.target.checked })} />
                할인 적용
              </label>
              {tier.useDiscount && (
                <div style={{ display: 'flex', gap: 6, marginLeft: 24, marginBottom: 10 }}>
                  <input type="text" placeholder="% 할인" value={tier.discount_pct} onChange={(e) => updateTier(idx, { discount_pct: e.target.value, discount_amount: '' })} style={{ width: 80 }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>또는</span>
                  <input type="text" placeholder="원 할인" value={tier.discount_amount} onChange={(e) => updateTier(idx, { discount_amount: e.target.value, discount_pct: '' })} style={{ width: 100 }} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                <input type="checkbox" checked={tier.useFixedPrice} onChange={(e) => updateTier(idx, { useFixedPrice: e.target.checked })} />
                확정가로 판매
              </label>
              {tier.useFixedPrice && (
                <div style={{ marginLeft: 24, marginBottom: 10 }}>
                  <input type="text" placeholder="230000" value={tier.fixed_price} onChange={(e) => updateTier(idx, { fixed_price: e.target.value })} style={{ width: 120 }} /> 원
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 6 }}>
                <input type="checkbox" checked={tier.useGifts} onChange={(e) => updateTier(idx, { useGifts: e.target.checked })} />
                증정품 추가
              </label>
              {tier.useGifts && (
                <div style={{ marginLeft: 24, marginBottom: 10 }}>
                  {tier.gifts.map((g, gIdx) => (
                    <div key={gIdx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                      <input type="text" placeholder="증정 제품 (제품ID 또는 검색결과 선택값)" value={g.product_id} onChange={(e) => updateTierGift(idx, gIdx, { product_id: e.target.value })} style={{ flex: 1 }} />
                      <input type="text" value={g.qty} onChange={(e) => updateTierGift(idx, gIdx, { qty: e.target.value })} style={{ width: 50 }} />
                      <button onClick={() => removeTierGift(idx, gIdx)}>×</button>
                    </div>
                  ))}
                  <button onClick={() => addTierGift(idx)} style={{ fontSize: 12 }}>+ 증정품 추가</button>
                </div>
              )}
              <input
                type="text"
                value={tier.highlight_text}
                onChange={(e) => updateTier(idx, { highlight_text: e.target.value })}
                placeholder="이 구간 강조문구 (선택, 예: 가장 인기있는 구성이에요)"
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
          ))}
          <button onClick={addTier} style={{ width: '100%', marginBottom: 16 }}>+ 구간 추가</button>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>대상 제품(컴퍼니 전체 브랜드, 복수선택 — 교차주문시 수량 합산)</div>
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="제품명으로 검색 (예: 메쓰크림)"
            style={{ width: '100%', padding: '8px 12px', marginBottom: 8 }}
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
          {draft.campaign_type === 'gift' && (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>증정품 선택</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10, maxHeight: 100, overflowY: 'auto' as const }}>
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, gift_product_id: p.id }))}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${draft.gift_product_id === p.id ? RED : 'rgba(255,255,255,0.12)'}`, background: draft.gift_product_id === p.id ? 'rgba(229,57,53,0.1)' : 'transparent', color: draft.gift_product_id === p.id ? '#ff8a80' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>시작일</div>
              <input type="date" value={draft.start_at} onChange={(e) => setDraft((p) => ({ ...p, start_at: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>종료일</div>
              <input type="date" value={draft.end_at} onChange={(e) => setDraft((p) => ({ ...p, end_at: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: RED, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '등록 중…' : '이벤트 등록 (전체 원장에게 즉시 노출)'}
          </button>
        </div>
      )}
    </div>
  )
}