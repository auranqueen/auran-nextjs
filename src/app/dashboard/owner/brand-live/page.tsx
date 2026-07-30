'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: '예정', color: '#185FA5', bg: '#E6F1FB' },
  live: { label: '방송중', color: '#A32D2D', bg: '#FCEBEB' },
  done: { label: '완료', color: '#5F5E5A', bg: '#F1EFE8' },
  cancelled: { label: '취소', color: '#888', bg: '#F1EFE8' },
}
interface LiveRow {
  id: string
  title: string
  description: string
  platform: string
  live_url: string
  scheduled_at: string
  status: string
  recording_url: string
  target_grades: string[]
  brands: { name: string }
}
type Product = { id: string; brand_id: string; name: string; brand_name: string }
type Campaign = {
  id: string
  title: string
  badge_text: string | null
  campaign_type: 'bundle' | 'gift' | 'discount'
  target_product_ids: string[]
  buy_qty: number | null
  bonus_qty: number | null
  gift_product_id: string | null
  discount_pct: number | null
  start_at: string
  end_at: string
  is_active: boolean
}
const EMPTY_DRAFT = {
  title: '',
  badge_text: '',
  campaign_type: 'bundle' as 'bundle' | 'gift' | 'discount',
  target_product_ids: [] as string[],
  buy_qty: '',
  bonus_qty: '',
  gift_product_id: '',
  discount_pct: '',
  start_at: '',
  end_at: '',
  apply_to_members: false,
}
export default function BrandLivePage() {
  const router = useRouter()
  const supabase = createClient()
  const [lives, setLives] = useState<LiveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tradeBrands, setTradeBrands] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showPromoForm, setShowPromoForm] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const loadPromotions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
    if (!profile?.id) return
    const { data: campaignRows } = await supabase
      .from('hq_forced_campaigns')
      .select('id, title, badge_text, campaign_type, target_product_ids, buy_qty, bonus_qty, gift_product_id, discount_pct, start_at, end_at, is_active')
      .eq('owner_id', profile.id)
      .order('start_at', { ascending: false })
    setCampaigns((campaignRows || []) as Campaign[])
  }, [supabase])
  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login?role=owner'); return }
      const brandIds = await getOwnerLinkedBrandIds(supabase, user.id, { includePending: true })
      if (brandIds.length === 0) { setLoading(false); return }
      const { data: brandRows } = await supabase
        .from('brands').select('id, name').in('id', brandIds)
      setTradeBrands((brandRows || []).map((b: { name?: string }) => String(b.name || '')).filter(Boolean))
      const { data } = await supabase
        .from('brand_lives')
        .select('id, title, description, platform, live_url, scheduled_at, status, recording_url, target_grades, brands(name)')
        .in('brand_id', brandIds)
        .order('scheduled_at', { ascending: false })
        .limit(20)
      setLives((data || []) as any[])
      const { data: prodRows } = await supabase
        .from('brand_products')
        .select('id, brand_id, name, brands(name)')
        .in('brand_id', brandIds)
        .eq('status', 'active')
      setProducts(
        (prodRows || []).map((p: any) => ({
          id: p.id,
          brand_id: p.brand_id,
          name: p.name || '',
          brand_name: p.brands?.name || '',
        })),
      )
      setLoading(false)
    }
    void fetch()
    void loadPromotions()
  }, [])
  const toggleProduct = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      target_product_ids: prev.target_product_ids.includes(id)
        ? prev.target_product_ids.filter((p) => p !== id)
        : [...prev.target_product_ids, id],
    }))
  }
  const submitPromo = async () => {
    if (!draft.title.trim()) { showToast('제목을 입력해주세요'); return }
    if (draft.target_product_ids.length === 0) { showToast('제품을 하나 이상 골라주세요'); return }
    if (!draft.start_at || !draft.end_at) { showToast('시작일/종료일을 입력해주세요'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/owner/live-promotions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: draft.title.trim(),
          badge_text: draft.badge_text.trim() || null,
          campaign_type: draft.campaign_type,
          target_product_ids: draft.target_product_ids,
          buy_qty: draft.buy_qty ? Number(draft.buy_qty) : null,
          bonus_qty: draft.bonus_qty ? Number(draft.bonus_qty) : null,
          gift_product_id: draft.gift_product_id || null,
          discount_pct: draft.discount_pct ? Number(draft.discount_pct) : null,
          apply_to_members: draft.apply_to_members,
          start_at: draft.start_at,
          end_at: draft.end_at,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('저장 실패')
        return
      }
      showToast('프로모션이 등록됐어요')
      setShowPromoForm(false)
      setDraft(EMPTY_DRAFT)
      await loadPromotions()
    } finally {
      setSaving(false)
    }
  }
  const removePromo = async (id: string) => {
    if (!window.confirm('이 프로모션을 삭제할까요?')) return
    const res = await fetch('/api/owner/live-promotions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) {
      showToast('삭제 실패')
      return
    }
    showToast('삭제됐어요')
    await loadPromotions()
  }
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 라이브</div>
      </div>
      {tradeBrands.length > 0 && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>내 라이브 프로모션</div>
            <button
              type="button"
              onClick={() => setShowPromoForm((v) => !v)}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, border: `1px solid ${PURPLE}`, background: showPromoForm ? LIGHT : PURPLE, color: showPromoForm ? PURPLE : '#fff', cursor: 'pointer' }}
            >
              {showPromoForm ? '닫기' : '+ 새로 만들기'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 10 }}>
            내 스토어 제품에 이벤트를 걸면, 기간 동안 자동으로 배지+할인/증정이 적용돼요.
          </div>
          {showPromoForm && (
            <div style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>제목</div>
              <input
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="예: 메쓰크림 1+1 라이브 특가"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff' }}
              />
              <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>배지문구(선택)</div>
              <input
                value={draft.badge_text}
                onChange={(e) => setDraft((p) => ({ ...p, badge_text: e.target.value }))}
                placeholder="예: 1+1"
                style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff' }}
              />
              <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>유형</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {([
                  { key: 'bundle', label: 'N+M 증정' },
                  { key: 'gift', label: '다른제품 증정' },
                  { key: 'discount', label: '% 할인' },
                ] as const).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, campaign_type: t.key }))}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${draft.campaign_type === t.key ? PURPLE : BORDER}`, background: draft.campaign_type === t.key ? 'rgba(123,94,167,0.08)' : '#fff', color: draft.campaign_type === t.key ? PURPLE : SUB, fontSize: 11, cursor: 'pointer' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {draft.campaign_type === 'bundle' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input type="number" placeholder="N개(구매)" value={draft.buy_qty} onChange={(e) => setDraft((p) => ({ ...p, buy_qty: e.target.value }))} style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff' }} />
                  <input type="number" placeholder="M개(증정)" value={draft.bonus_qty} onChange={(e) => setDraft((p) => ({ ...p, bonus_qty: e.target.value }))} style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff' }} />
                </div>
              )}
              {draft.campaign_type === 'discount' && (
                <input type="number" placeholder="할인율(%)" value={draft.discount_pct} onChange={(e) => setDraft((p) => ({ ...p, discount_pct: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff' }} />
              )}
              <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>대상 제품(복수선택)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10, maxHeight: 140, overflowY: 'auto' as const }}>
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${draft.target_product_ids.includes(p.id) ? PURPLE : BORDER}`, background: draft.target_product_ids.includes(p.id) ? 'rgba(123,94,167,0.1)' : '#fff', color: draft.target_product_ids.includes(p.id) ? PURPLE : SUB, cursor: 'pointer' }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              {draft.campaign_type === 'gift' && (
                <>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>증정품 선택</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 10, maxHeight: 100, overflowY: 'auto' as const }}>
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, gift_product_id: p.id }))}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${draft.gift_product_id === p.id ? PURPLE : BORDER}`, background: draft.gift_product_id === p.id ? 'rgba(123,94,167,0.1)' : '#fff', color: draft.gift_product_id === p.id ? PURPLE : SUB, cursor: 'pointer' }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft.apply_to_members}
                  onChange={(e) => setDraft((p) => ({ ...p, apply_to_members: e.target.checked }))}
                />
                <span style={{ fontSize: 12, color: TEXT }}>회원(관리고객)에게도 적용</span>
              </label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>시작일</div>
                  <input type="date" value={draft.start_at} onChange={(e) => setDraft((p) => ({ ...p, start_at: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>종료일</div>
                  <input type="date" value={draft.end_at} onChange={(e) => setDraft((p) => ({ ...p, end_at: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff' }} />
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitPromo()}
                style={{ width: '100%', padding: 11, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '등록 중…' : '프로모션 등록'}
              </button>
            </div>
          )}
          {campaigns.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {campaigns.map((c) => (
                <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.badge_text && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(123,94,167,0.12)', color: PURPLE, flexShrink: 0 }}>{c.badge_text}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: TEXT }}>{c.title}</div>
                    <div style={{ fontSize: 10, color: SUB }}>{c.start_at?.slice(0, 10)} ~ {c.end_at?.slice(0, 10)}</div>
                  </div>
                  <button type="button" onClick={() => void removePromo(c.id)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e88', cursor: 'pointer', flexShrink: 0 }}>삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ padding: '0 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 10 }}>브랜드 라이브 일정</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : tradeBrands.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>거래 브랜드를 등록하면 라이브 정보를 볼 수 있어요</div>
        ) : lives.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>등록된 라이브가 없어요</div>
        ) : lives.map((l) => {
          const st = STATUS_MAP[l.status] || STATUS_MAP['done']
          return (
            <div key={l.id} style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={{ fontSize: 11, color: SUB }}>{l.brands?.name}</span>
                <span style={{ fontSize: 11, color: SUB, marginLeft: 'auto' }}>
                  {l.scheduled_at ? new Date(l.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{l.title}</div>
              {l.description && <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>{l.description}</div>}
              {l.status === 'live' && l.live_url && (
                <a href={l.live_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8, background: PURPLE, color: '#fff', fontSize: 12, textDecoration: 'none' }}>
                  라이브 입장하기 →
                </a>
              )}
              {l.status === 'done' && l.recording_url && (
                <a href={l.recording_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', padding: '8px', borderRadius: 8, background: LIGHT, border: `1px solid ${BORDER}`, color: PURPLE, fontSize: 12, textDecoration: 'none' }}>
                  다시보기 →
                </a>
              )}
            </div>
          )
        })}
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}