'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const PURPLE = '#9B8AFB'

type UserRow = { id: string; role?: string | null }

type SalonProduct = {
  id?: string
  owner_id: string
  name: string
  product_type: 'session' | 'amount'
  session_count: number | null
  duration_minutes: number | null
  amount_preset: string | null
  custom_amount: number | null
  cost_price: number
  retail_price: number
  is_active: boolean
  updated_at?: string
}

type SalonPromotion = {
  id?: string
  salon_product_id: string
  owner_id: string
  promotion_type_keys: string[]
  custom_promotion_label: string
  discount_mode: 'percent' | 'fixed' | 'below_cost'
  discount_percent: number
  discount_amount: number
  period_mode: 'range' | 'always'
  period_start: string
  period_end: string
  quantity_limit_enabled: boolean
  quantity_limit: number
  toast_rate: number
  marketing_cost_acknowledged: boolean
}

const PROMO_DEF: { key: string; label: string }[] = [
  { key: 'open', label: '오픈기념' },
  { key: 'season', label: '시즌할인' },
  { key: 'first_visit', label: '첫방문체험가' },
  { key: 'return_visit', label: '재방문할인' },
  { key: 'birthday', label: '생일할인' },
  { key: 'weekday', label: '평일타임할인' },
  { key: 'same_day', label: '당일예약' },
  { key: 'friend', label: '친구동반' },
  { key: 'subscription', label: '정기구독' },
  { key: 'custom', label: '직접입력' },
]

const SESSION_OPTIONS = [1, 3, 5, 10, 12]
const AMOUNT_PRESETS = [
  { key: '500000', label: '50만', value: 500000 },
  { key: '1000000', label: '100만', value: 1000000 },
  { key: '2000000', label: '200만', value: 2000000 },
  { key: '5000000', label: '500만', value: 5000000 },
]

const DEFAULT_COMMISSION_KEY = 'default_salon_commission_rate'

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}

export default function OwnerSalonProductsPage() {
  const supabase = createClient()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [commissionRate, setCommissionRate] = useState(8)

  const [products, setProducts] = useState<SalonProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SalonProduct>({
    owner_id: '',
    name: '',
    product_type: 'session',
    session_count: 1,
    duration_minutes: 60,
    amount_preset: '500000',
    custom_amount: null,
    cost_price: 0,
    retail_price: 0,
    is_active: true,
  })

  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [promo, setPromo] = useState<SalonPromotion | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoSaving, setPromoSaving] = useState(false)

  const loadCommission = useCallback(async () => {
    const { data } = await supabase
      .from('benefit_settings')
      .select('setting_value')
      .eq('setting_key', DEFAULT_COMMISSION_KEY)
      .maybeSingle()
    if (data && (data as { setting_value?: unknown }).setting_value != null) {
      const n = num((data as { setting_value?: unknown }).setting_value, 8)
      if (n > 0) setCommissionRate(n)
    }
  }, [supabase])

  const resolveOwner = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setOwnerId(null)
      setAuthLoading(false)
      return
    }
    const { data: u } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
    const row = u as UserRow | null
    if (!row || (row.role && row.role !== 'owner')) {
      setOwnerId(null)
      setAuthLoading(false)
      return
    }
    setOwnerId(row.id)
    setAuthLoading(false)
  }, [supabase])

  const loadProducts = useCallback(async () => {
    if (!ownerId) return
    setLoadingProducts(true)
    const { data, error } = await supabase
      .from('salon_products')
      .select('*')
      .eq('owner_id', ownerId)
      .order('id', { ascending: false })
    if (error) {
      console.error(error)
      setProducts([])
    } else {
      setProducts((data as SalonProduct[]) || [])
    }
    setLoadingProducts(false)
  }, [supabase, ownerId])

  useEffect(() => {
    resolveOwner()
    loadCommission()
  }, [resolveOwner, loadCommission])

  useEffect(() => {
    if (ownerId) loadProducts()
  }, [ownerId, loadProducts])

  const openCreate = () => {
    if (!ownerId) return
    setEditingId(null)
    setForm({
      owner_id: ownerId,
      name: '',
      product_type: 'session',
      session_count: 1,
      duration_minutes: 60,
      amount_preset: '500000',
      custom_amount: null,
      cost_price: 0,
      retail_price: 0,
      is_active: true,
    })
    setModalOpen(true)
  }

  const openEdit = (p: SalonProduct) => {
    setEditingId(p.id || null)
    setForm({
      ...p,
      session_count: p.session_count ?? 1,
      duration_minutes: p.duration_minutes ?? 60,
      amount_preset: p.amount_preset || '500000',
      custom_amount: p.custom_amount ?? null,
    })
    setModalOpen(true)
  }

  const saveProduct = async () => {
    if (!ownerId) return
    const payload: Record<string, unknown> = {
      owner_id: ownerId,
      name: form.name.trim(),
      product_type: form.product_type,
      session_count: form.product_type === 'session' ? num(form.session_count, 1) : null,
      duration_minutes: form.product_type === 'session' ? num(form.duration_minutes, 0) : null,
      amount_preset: form.product_type === 'amount' ? form.amount_preset : null,
      custom_amount:
        form.product_type === 'amount' && form.amount_preset === 'custom' ? num(form.custom_amount, 0) : null,
      cost_price: num(form.cost_price, 0),
      retail_price: num(form.retail_price, 0),
      is_active: !!form.is_active,
      updated_at: new Date().toISOString(),
    }
    if (editingId) {
      const { error } = await supabase.from('salon_products').update(payload).eq('id', editingId).eq('owner_id', ownerId)
      if (error) {
        alert(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('salon_products').insert(payload)
      if (error) {
        alert(error.message)
        return
      }
    }
    setModalOpen(false)
    loadProducts()
  }

  const deleteProduct = async (id: string) => {
    if (!ownerId || !confirm('이 상품을 삭제할까요?')) return
    const { error } = await supabase.from('salon_products').delete().eq('id', id).eq('owner_id', ownerId)
    if (error) {
      alert(error.message)
      return
    }
    if (selectedProductId === id) {
      setSelectedProductId('')
      setPromo(null)
    }
    loadProducts()
  }

  const loadPromotion = useCallback(
    async (productId: string) => {
      if (!ownerId || !productId) {
        setPromo(null)
        return
      }
      setPromoLoading(true)
      const { data } = await supabase
        .from('salon_promotions')
        .select('*')
        .eq('salon_product_id', productId)
        .eq('owner_id', ownerId)
        .maybeSingle()

      if (data) {
        const row = data as Record<string, unknown>
        let keys: string[] = []
        if (Array.isArray(row.promotion_type_keys)) keys = row.promotion_type_keys as string[]
        else if (typeof row.promotion_type_keys === 'string') {
          try {
            keys = JSON.parse(row.promotion_type_keys as string)
          } catch {
            keys = []
          }
        }
        setPromo({
          id: row.id as string,
          salon_product_id: productId,
          owner_id: ownerId,
          promotion_type_keys: keys,
          custom_promotion_label: String(row.custom_promotion_label || ''),
          discount_mode: (row.discount_mode as SalonPromotion['discount_mode']) || 'percent',
          discount_percent: num(row.discount_percent, 0),
          discount_amount: num(row.discount_amount, 0),
          period_mode: (row.period_mode as SalonPromotion['period_mode']) || 'always',
          period_start: String(row.period_start || '').slice(0, 10),
          period_end: String(row.period_end || '').slice(0, 10),
          quantity_limit_enabled: !!row.quantity_limit_enabled,
          quantity_limit: num(row.quantity_limit, 0),
          toast_rate: num(row.toast_rate, 0),
          marketing_cost_acknowledged: !!row.marketing_cost_acknowledged,
        })
      } else {
        setPromo({
          salon_product_id: productId,
          owner_id: ownerId,
          promotion_type_keys: [],
          custom_promotion_label: '',
          discount_mode: 'percent',
          discount_percent: 0,
          discount_amount: 0,
          period_mode: 'always',
          period_start: '',
          period_end: '',
          quantity_limit_enabled: false,
          quantity_limit: 0,
          toast_rate: 0,
          marketing_cost_acknowledged: false,
        })
      }
      setPromoLoading(false)
    },
    [supabase, ownerId]
  )

  useEffect(() => {
    if (selectedProductId && ownerId) void loadPromotion(selectedProductId)
    else setPromo(null)
  }, [selectedProductId, ownerId, loadPromotion])

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  )

  const marginCalc = useMemo(() => {
    if (!selectedProduct || !promo) return null
    const retail = num(selectedProduct.retail_price, 0)
    const cost = num(selectedProduct.cost_price, 0)
    const cr = commissionRate / 100
    let payment = retail
    if (promo.discount_mode === 'percent') {
      payment = Math.max(0, retail - (retail * num(promo.discount_percent, 0)) / 100)
    } else if (promo.discount_mode === 'fixed') {
      payment = Math.max(0, retail - num(promo.discount_amount, 0))
    } else if (promo.discount_mode === 'below_cost') {
      payment = cost
    }
    const discountAmt = retail - payment
    const hqFee = cost * cr
    const toastAmt = (payment * num(promo.toast_rate, 0)) / 100
    const net = payment - hqFee - toastAmt
    const vsCost = net - cost
    const belowCost = payment < cost - 0.01
    const loss = belowCost ? cost - payment : 0
    return {
      retail,
      cost,
      payment,
      discountAmt,
      hqFee,
      toastAmt,
      net,
      vsCost,
      belowCost,
      loss,
    }
  }, [selectedProduct, promo, commissionRate])

  const savePromotion = async () => {
    if (!ownerId || !selectedProductId || !promo) return
    if (marginCalc?.belowCost && !promo.marketing_cost_acknowledged) {
      alert('원가 이하 설정입니다. 마케팅 비용 동의에 체크해 주세요.')
      return
    }
    setPromoSaving(true)
    const payload: Record<string, unknown> = {
      salon_product_id: selectedProductId,
      owner_id: ownerId,
      promotion_type_keys: promo.promotion_type_keys,
      custom_promotion_label: promo.custom_promotion_label,
      discount_mode: promo.discount_mode,
      discount_percent: num(promo.discount_percent, 0),
      discount_amount: num(promo.discount_amount, 0),
      period_mode: promo.period_mode,
      period_start: promo.period_mode === 'range' && promo.period_start ? promo.period_start : null,
      period_end: promo.period_mode === 'range' && promo.period_end ? promo.period_end : null,
      quantity_limit_enabled: promo.quantity_limit_enabled,
      quantity_limit: num(promo.quantity_limit, 0),
      toast_rate: num(promo.toast_rate, 0),
      marketing_cost_acknowledged: promo.marketing_cost_acknowledged,
      updated_at: new Date().toISOString(),
    }
    if (promo.id) {
      const { error } = await supabase.from('salon_promotions').update(payload).eq('id', promo.id).eq('owner_id', ownerId)
      if (error) alert(error.message)
      else loadPromotion(selectedProductId)
    } else {
      const { error } = await supabase.from('salon_promotions').insert(payload)
      if (error) alert(error.message)
      else loadPromotion(selectedProductId)
    }
    setPromoSaving(false)
  }

  const deletePromotion = async () => {
    if (!ownerId || !promo?.id) return
    if (!confirm('프로모션을 삭제할까요?')) return
    const { error } = await supabase.from('salon_promotions').delete().eq('id', promo.id).eq('owner_id', ownerId)
    if (error) alert(error.message)
    else loadPromotion(selectedProductId)
  }

  const togglePromoKey = (key: string) => {
    setPromo(prev => {
      if (!prev) return prev
      const set = new Set(prev.promotion_type_keys)
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return { ...prev, promotion_type_keys: Array.from(set) }
    })
  }

  const cost = num(form.cost_price, 0)
  const retail = num(form.retail_price, 0)
  const cr = commissionRate / 100
  const hqFeeForm = cost * cr
  const ownerNetForm = cost - hqFeeForm
  const marginAmt = retail - cost
  const marginPct = retail > 0 ? (marginAmt / retail) * 100 : 0

  const cardStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: 13,
    boxSizing: 'border-box',
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24 }}>
        불러오는 중…
      </div>
    )
  }

  if (!ownerId) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24 }}>
        <p style={{ color: GOLD }}>원장님 계정으로 로그인해 주세요.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: '20px 16px 80px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: PURPLE, marginBottom: 6 }}>OWNER · SALON</div>
        <h1 style={{ fontSize: 20, color: GOLD, margin: 0 }}>관리 상품 · 프로모션</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
          본사 수수료율은 benefit_settings · {DEFAULT_COMMISSION_KEY} 기준 ({commissionRate}%)
        </p>
      </div>

      <section style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, margin: 0, color: GOLD }}>관리상품 목록</h2>
          <button
            type="button"
            onClick={openCreate}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: `linear-gradient(135deg, ${GOLD}, #a88b4a)`,
              border: 'none',
              color: '#0D0B09',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            + 새 상품 등록
          </button>
        </div>

        {loadingProducts ? (
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>상품 불러오는 중…</div>
        ) : products.length === 0 ? (
          <div style={{ ...cardStyle, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>등록된 관리상품이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {products.map(p => (
              <div key={p.id} style={cardStyle}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                  유형: {p.product_type === 'session' ? '회차권' : '금액권'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
                  원가: {num(p.cost_price, 0).toLocaleString()}원 · 정가: {num(p.retail_price, 0).toLocaleString()}원
                </div>
                <div style={{ fontSize: 12, color: p.is_active ? PURPLE : 'rgba(255,255,255,0.35)' }}>
                  {p.is_active ? '● 활성' : '○ 비활성'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(155,138,251,0.15)',
                      border: `1px solid ${PURPLE}44`,
                      color: PURPLE,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => p.id && deleteProduct(p.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid rgba(255,80,80,0.35)',
                      color: '#f08080',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, marginBottom: 12, color: GOLD }}>프로모션 설정</h2>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 6 }}>상품 선택</label>
        <select
          value={selectedProductId}
          onChange={e => setSelectedProductId(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        >
          <option value="">— 상품을 선택하세요 —</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {promoLoading && <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>프로모션 불러오는 중…</div>}

        {!promoLoading && selectedProductId && promo && (
          <div style={{ ...cardStyle, borderColor: `${PURPLE}33` }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PROMO_DEF.map(pt => (
                <label
                  key={pt.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={promo.promotion_type_keys.includes(pt.key)}
                    onChange={() => togglePromoKey(pt.key)}
                  />
                  {pt.label}
                </label>
              ))}
            </div>
            {promo.promotion_type_keys.includes('custom') && (
              <input
                placeholder="직접입력 라벨"
                value={promo.custom_promotion_label}
                onChange={e => setPromo({ ...promo, custom_promotion_label: e.target.value })}
                style={{ ...inputStyle, marginBottom: 14 }}
              />
            )}

            <div style={{ fontSize: 12, color: GOLD, marginBottom: 8 }}>할인 방식</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input
                  type="radio"
                  name="dm"
                  checked={promo.discount_mode === 'percent'}
                  onChange={() => setPromo({ ...promo, discount_mode: 'percent' })}
                />
                정률
                <input
                  type="number"
                  style={{ ...inputStyle, width: 72, marginLeft: 8 }}
                  value={promo.discount_percent}
                  onChange={e => setPromo({ ...promo, discount_percent: num(e.target.value, 0) })}
                />
                %
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input
                  type="radio"
                  name="dm"
                  checked={promo.discount_mode === 'fixed'}
                  onChange={() => setPromo({ ...promo, discount_mode: 'fixed' })}
                />
                정액
                <input
                  type="number"
                  style={{ ...inputStyle, width: 100, marginLeft: 8 }}
                  value={promo.discount_amount}
                  onChange={e => setPromo({ ...promo, discount_amount: num(e.target.value, 0) })}
                />
                원
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input
                  type="radio"
                  name="dm"
                  checked={promo.discount_mode === 'below_cost'}
                  onChange={() => setPromo({ ...promo, discount_mode: 'below_cost' })}
                />
                원가이하 특가
              </label>
            </div>

            <div style={{ fontSize: 12, color: GOLD, marginBottom: 8 }}>기간</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 8 }}>
                <input
                  type="radio"
                  name="pm"
                  checked={promo.period_mode === 'range'}
                  onChange={() => setPromo({ ...promo, period_mode: 'range' })}
                />
                기간설정
              </label>
              {promo.period_mode === 'range' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={promo.period_start}
                    onChange={e => setPromo({ ...promo, period_start: e.target.value })}
                    style={inputStyle}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>~</span>
                  <input
                    type="date"
                    value={promo.period_end}
                    onChange={e => setPromo({ ...promo, period_end: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginTop: 8 }}>
                <input
                  type="radio"
                  name="pm"
                  checked={promo.period_mode === 'always'}
                  onChange={() => setPromo({ ...promo, period_mode: 'always' })}
                />
                상시운영
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={promo.quantity_limit_enabled}
                onChange={e => setPromo({ ...promo, quantity_limit_enabled: e.target.checked })}
              />
              수량한정
              <input
                type="number"
                style={{ ...inputStyle, width: 72 }}
                value={promo.quantity_limit}
                onChange={e => setPromo({ ...promo, quantity_limit: num(e.target.value, 0) })}
              />
              명
            </label>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>토스트 지급률 (%)</div>
              <input
                type="number"
                style={inputStyle}
                value={promo.toast_rate}
                onChange={e => setPromo({ ...promo, toast_rate: num(e.target.value, 0) })}
              />
            </div>

            {marginCalc && (
              <div
                style={{
                  background: 'rgba(155,138,251,0.08)',
                  border: `1px solid ${PURPLE}44`,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 12, color: PURPLE, fontWeight: 700, marginBottom: 10 }}>── 실시간 마진 계산기 ──</div>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <div>선택상품 정가: {marginCalc.retail.toLocaleString()} 원</div>
                  <div>프로모션 할인: -{marginCalc.discountAmt.toLocaleString()} 원</div>
                  <div>고객 결제금액: {marginCalc.payment.toLocaleString()} 원</div>
                  <div>
                    본사 수수료 {commissionRate}%: -{marginCalc.hqFee.toLocaleString()} 원
                  </div>
                  <div>토스트 지급: -{marginCalc.toastAmt.toLocaleString()} 원</div>
                  <div style={{ color: GOLD, fontWeight: 700 }}>원장님 실수령: {marginCalc.net.toLocaleString()} 원</div>
                  <div>
                    원가 대비: {marginCalc.vsCost.toLocaleString()} 원{' '}
                    {marginCalc.vsCost >= 0 ? '✅' : '⚠️'}
                  </div>
                </div>
              </div>
            )}

            {marginCalc?.belowCost && (
              <div
                style={{
                  background: 'rgba(200,80,80,0.12)',
                  border: '1px solid rgba(200,80,80,0.35)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                ⚠️ 이 프로모션은 마케팅 비용이 발생해요
                <br />
                예상 손실: {marginCalc.loss.toLocaleString()}원
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={promo.marketing_cost_acknowledged}
                    onChange={e => setPromo({ ...promo, marketing_cost_acknowledged: e.target.checked })}
                  />
                  마케팅 비용으로 처리하겠습니다 (체크 필수)
                </label>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={promoSaving}
                onClick={savePromotion}
                style={{
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: GOLD,
                  border: 'none',
                  color: '#0D0B09',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {promoSaving ? '저장 중…' : '프로모션 저장'}
              </button>
              {promo.id && (
                <button
                  type="button"
                  onClick={deletePromotion}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 10,
                    background: 'transparent',
                    border: '1px solid rgba(255,100,100,0.4)',
                    color: '#f08080',
                    cursor: 'pointer',
                  }}
                >
                  프로모션 삭제
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: '#161210',
              border: `1px solid ${GOLD}33`,
              borderRadius: 20,
              padding: 20,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              color: '#fff',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD, marginBottom: 16 }}>
              {editingId ? '상품 수정' : '새 상품 등록'}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>상품명</div>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>유형</div>
              <label style={{ marginRight: 16, fontSize: 13 }}>
                <input
                  type="radio"
                  checked={form.product_type === 'session'}
                  onChange={() => setForm({ ...form, product_type: 'session' })}
                />{' '}
                회차권
              </label>
              <label style={{ fontSize: 13 }}>
                <input
                  type="radio"
                  checked={form.product_type === 'amount'}
                  onChange={() => setForm({ ...form, product_type: 'amount' })}
                />{' '}
                금액권
              </label>
            </div>

            {form.product_type === 'session' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>회차</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {SESSION_OPTIONS.map(n => (
                      <label key={n} style={{ fontSize: 12 }}>
                        <input
                          type="radio"
                          name="sc"
                          checked={form.session_count === n}
                          onChange={() => setForm({ ...form, session_count: n })}
                        />{' '}
                        {n}회
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>시술시간 (분)</div>
                  <input
                    type="number"
                    value={form.duration_minutes ?? ''}
                    onChange={e => setForm({ ...form, duration_minutes: num(e.target.value, 0) })}
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {form.product_type === 'amount' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>금액</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {AMOUNT_PRESETS.map(ap => (
                    <label key={ap.key} style={{ fontSize: 12 }}>
                      <input
                        type="radio"
                        name="amt"
                        checked={form.amount_preset === ap.key}
                        onChange={() => setForm({ ...form, amount_preset: ap.key, custom_amount: null })}
                      />{' '}
                      {ap.label}
                    </label>
                  ))}
                  <label style={{ fontSize: 12 }}>
                    <input
                      type="radio"
                      name="amt"
                      checked={form.amount_preset === 'custom'}
                      onChange={() => setForm({ ...form, amount_preset: 'custom' })}
                    />{' '}
                    직접입력
                  </label>
                </div>
                {form.amount_preset === 'custom' && (
                  <input
                    type="number"
                    placeholder="금액 (원)"
                    value={form.custom_amount ?? ''}
                    onChange={e => setForm({ ...form, custom_amount: num(e.target.value, 0) })}
                    style={inputStyle}
                  />
                )}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>원가 (보장금액)</div>
              <input
                type="number"
                value={form.cost_price}
                onChange={e => setForm({ ...form, cost_price: num(e.target.value, 0) })}
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: PURPLE, marginTop: 8, lineHeight: 1.6 }}>
                본사 수수료 {commissionRate}%: {hqFeeForm.toLocaleString()} 원 (자동)
                <br />
                원장님 실수령(원가 기준): {ownerNetForm.toLocaleString()} 원 (자동)
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>정가</div>
              <input
                type="number"
                value={form.retail_price}
                onChange={e => setForm({ ...form, retail_price: num(e.target.value, 0) })}
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
                마진: {marginAmt.toLocaleString()} 원 · 마진율: {marginPct.toFixed(1)} %
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
              />
              활성
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveProduct}
                style={{
                  flex: 2,
                  padding: 12,
                  borderRadius: 10,
                  background: GOLD,
                  border: 'none',
                  color: '#0D0B09',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
