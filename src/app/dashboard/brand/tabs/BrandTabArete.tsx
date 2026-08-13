'use client'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
interface Props {
  companyId: string | null
}
interface MemberRow {
  owner_id: string
  name: string
  balance: number
}
interface BundleItem {
  product_id: string
  name: string
  qty: number
  price: number
}
interface ProductOption {
  id: string
  name: string
  supply_price: number
}
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 12 }
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const PURPLE = '#7B5EA7'
function thisMonthDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
export default function BrandTabArete({ companyId }: Props) {
  const supabase = createClient()
  const billingMonth = thisMonthDate()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [guideUrl, setGuideUrl] = useState('')
  const [guideTitle, setGuideTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [savingBundle, setSavingBundle] = useState(false)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const { data: memberRows } = await supabase
      .from('brand_arete_members')
      .select('owner_id')
      .eq('company_id', companyId)
      .eq('status', 'active')
    const ownerIds = (memberRows || []).map((m: { owner_id: string }) => m.owner_id)
    let memberList: MemberRow[] = []
    if (ownerIds.length) {
      const [{ data: profiles }, { data: pointRows }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', ownerIds),
        supabase.from('brand_points').select('owner_id, balance').eq('company_id', companyId).eq('track', 'ARETE').in('owner_id', ownerIds),
      ])
      const balanceMap: Record<string, number> = {}
      for (const p of pointRows || []) balanceMap[(p as { owner_id: string }).owner_id] = Number((p as { balance: number }).balance || 0)
      memberList = (profiles || []).map((p: { id: string; full_name?: string | null }) => ({
        owner_id: p.id,
        name: p.full_name || '원장님',
        balance: balanceMap[p.id] || 0,
      }))
    }
    setMembers(memberList)
    const { data: bundleRow } = await supabase
      .from('brand_arete_monthly_bundles')
      .select('items')
      .eq('company_id', companyId)
      .eq('billing_month', billingMonth)
      .maybeSingle()
    setBundleItems(((bundleRow as { items?: BundleItem[] } | null)?.items) || [])
    const { data: guideRow } = await supabase
      .from('brand_arete_guide_images')
      .select('image_url, title')
      .eq('company_id', companyId)
      .eq('billing_month', billingMonth)
      .maybeSingle()
    setGuideUrl((guideRow as { image_url?: string } | null)?.image_url || '')
    setGuideTitle((guideRow as { title?: string } | null)?.title || '')
    setLoading(false)
  }, [companyId, billingMonth, supabase])
  useEffect(() => { void load() }, [load])
  const searchProducts = useCallback(async (q: string) => {
    if (!companyId || !q.trim()) { setProducts([]); return }
    const { data: brandRows } = await supabase.from('brands').select('id').eq('company_id', companyId)
    const brandIds = (brandRows || []).map((b: { id: string }) => b.id)
    if (!brandIds.length) return
    const { data } = await supabase
      .from('brand_products')
      .select('id, name, supply_price')
      .in('brand_id', brandIds)
      .ilike('name', `%${q.trim()}%`)
      .limit(10)
    setProducts((data || []) as ProductOption[])
  }, [companyId, supabase])
  const addBundleItem = (p: ProductOption) => {
    setBundleItems((prev) => {
      if (prev.some((i) => i.product_id === p.id)) return prev
      return [...prev, { product_id: p.id, name: p.name, qty: 1, price: p.supply_price }]
    })
    setProducts([])
    setProductSearch('')
  }
  const updateQty = (productId: string, qty: number) => {
    setBundleItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, qty: Math.max(1, qty) } : i))
  }
  const removeItem = (productId: string) => {
    setBundleItems((prev) => prev.filter((i) => i.product_id !== productId))
  }
  const bundleTotal = useMemo(() => bundleItems.reduce((s, i) => s + i.qty * i.price, 0), [bundleItems])
  const saveBundle = async () => {
    if (!companyId) return
    setSavingBundle(true)
    const { error } = await supabase.from('brand_arete_monthly_bundles').upsert({
      company_id: companyId,
      billing_month: billingMonth,
      items: bundleItems,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,billing_month' })
    setSavingBundle(false)
    showToast(error ? '저장 실패: ' + error.message : '이번달 번들 저장됐어요')
  }
  const uploadGuide = async (file: File) => {
    if (!companyId) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `arete-guides/${companyId}-${billingMonth}-${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
      if (error || !data) { showToast('업로드 실패'); return }
      const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('brand_arete_guide_images').upsert({
        company_id: companyId,
        billing_month: billingMonth,
        image_url: urlData.publicUrl,
        title: guideTitle || `${billingMonth.slice(0, 7)} 프로그램 가이드`,
      }, { onConflict: 'company_id,billing_month' })
      if (dbErr) { showToast('저장 실패: ' + dbErr.message); return }
      setGuideUrl(urlData.publicUrl)
      showToast('가이드 업로드 완료')
    } finally {
      setUploading(false)
    }
  }
  const cancelMember = async (ownerId: string) => {
    if (!companyId) return
    if (!window.confirm('이 원장님의 아레테 멤버십을 해지할까요?')) return
    await supabase.from('brand_arete_members').update({ status: 'cancelled' }).eq('company_id', companyId).eq('owner_id', ownerId)
    await supabase.from('profiles').update({ arete_member: false }).eq('id', ownerId)
    setMembers((prev) => prev.filter((m) => m.owner_id !== ownerId))
    showToast('해지 처리됐어요')
  }
  if (!companyId) {
    return <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
  }
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>전체 회원</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{members.length}명</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>이번달 번들 총액</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{bundleTotal.toLocaleString()}원</div>
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>이번달({billingMonth.slice(0, 7)}) 번들 구성</div>
        {bundleItems.map((item) => (
          <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
            <span style={{ flex: 1, fontSize: 12, color: TEXT }}>{item.name}</span>
            <input type="number" value={item.qty} onChange={(e) => updateQty(item.product_id, Number(e.target.value))}
              style={{ width: 50, fontSize: 12, padding: '3px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', color: TEXT }} />
            <span style={{ fontSize: 11, color: SUB, width: 80, textAlign: 'right' }}>{(item.qty * item.price).toLocaleString()}원</span>
            <button type="button" onClick={() => removeItem(item.product_id)} style={{ fontSize: 11, color: 'rgba(229,57,53,0.8)', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
          </div>
        ))}
        <div style={{ position: 'relative', marginTop: 10 }}>
          <input
            value={productSearch}
            onChange={(e) => { setProductSearch(e.target.value); void searchProducts(e.target.value) }}
            placeholder="제품 검색해서 담기"
            style={{ width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', color: TEXT }}
          />
          {products.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#221c2a', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, zIndex: 10, marginTop: 4 }}>
              {products.map((p) => (
                <div key={p.id} onClick={() => addBundleItem(p)} style={{ padding: '8px 10px', fontSize: 12, color: TEXT, cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  {p.name} · {p.supply_price.toLocaleString()}원
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => void saveBundle()} disabled={savingBundle}
          style={{ width: '100%', marginTop: 10, padding: 8, fontSize: 12, borderRadius: 8, border: 'none', background: savingBundle ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', cursor: 'pointer' }}>
          {savingBundle ? '저장 중...' : '번들 저장'}
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>이번달 프로그램 가이드</div>
        {guideUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={guideUrl} alt="" style={{ width: 44, height: 56, objectFit: 'cover', borderRadius: 6 }} />
            <div style={{ fontSize: 12, color: TEXT }}>{guideTitle}</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>아직 업로드된 가이드가 없어요</div>
        )}
        <input
          value={guideTitle}
          onChange={(e) => setGuideTitle(e.target.value)}
          placeholder="가이드 제목"
          style={{ width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', color: TEXT, marginBottom: 8 }}
        />
        <label style={{ display: 'block', textAlign: 'center', padding: 8, fontSize: 12, borderRadius: 8, border: `1px solid ${PURPLE}`, color: '#c4a7e7', cursor: 'pointer' }}>
          {uploading ? '업로드 중...' : '이미지/PDF 업로드'}
          <input type="file" accept="image/*,.pdf" disabled={uploading} style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadGuide(f) }} />
        </label>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>회원 · 포인트 현황</div>
        {members.length === 0 ? (
          <div style={{ fontSize: 11, color: SUB }}>아레테 회원이 없어요</div>
        ) : (
          members.map((m) => (
            <div key={m.owner_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 12, color: TEXT }}>{m.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: SUB }}>{m.balance.toLocaleString()}P</span>
                <button type="button" onClick={() => void cancelMember(m.owner_id)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.8)', cursor: 'pointer' }}>
                  해지
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
