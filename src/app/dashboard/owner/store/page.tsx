'use client'

// Supabase Storage: owner-store 버킷 생성 필요 (Public 권한은 프로젝트 정책에 맞게)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import OwnerCouponProductTargetFields from '@/components/owner-store/OwnerCouponProductTargetFields'
import SalonInfoForm from '@/components/owner-store/SalonInfoForm'

const BG = '#0D0B09'

type MainTab = 'products' | 'orders' | 'shipping' | 'coupons' | 'settlement' | 'salon-info'
type OrderSubTab = 'new' | 'processing' | 'shipping' | 'done' | 'cancel'

const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국'] as const

function trackingUrl(courier: string, slip: string) {
  const s = encodeURIComponent(slip.trim())
  if (courier.includes('CJ')) return `https://trace.cjlogistics.com/web/detail.jsp?slipno=${s}`
  if (courier.includes('한진')) return `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblnumText2=${s}`
  if (courier.includes('로젠')) return `https://www.logen.co.kr/m_kor/service/trace/index.php?invc_no=${s}`
  if (courier.includes('우체국')) return `https://service.epost.go.kr/trace.RetrieveDomRijieSimpleList.comm?sid1=${s}`
  return ''
}

function randomCouponCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function OwnerStorePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [ownerMode, setOwnerMode] = useState<string | null>(null)
  const [ownerSubPlan, setOwnerSubPlan] = useState<string | null>(null)
  const [ownerSignupDate, setOwnerSignupDate] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)
  const [storeDesc, setStoreDesc] = useState<string | null>(null)
  const [storeLogoUrl, setStoreLogoUrl] = useState<string | null>(null)
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  const [toast, setToast] = useState('')
  const [mainTab, setMainTab] = useState<MainTab>('products')
  const [orderSub, setOrderSub] = useState<OrderSubTab>('new')

  const [storeModal, setStoreModal] = useState(false)
  const [modalName, setModalName] = useState('')
  const [modalDesc, setModalDesc] = useState('')
  const [modalLogoFile, setModalLogoFile] = useState<File | null>(null)
  const [modalLogoPreview, setModalLogoPreview] = useState('')

  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [settlements, setSettlements] = useState<any[]>([])

  const [productModal, setProductModal] = useState<{ open: boolean; row: any | null }>({ open: false, row: null })
  const [pmName, setPmName] = useState('')
  const [pmDesc, setPmDesc] = useState('')
  const [pmPrice, setPmPrice] = useState<number>(0)
  const [pmSale, setPmSale] = useState<number | ''>('')
  const [pmStock, setPmStock] = useState<number>(0)
  const [pmCat, setPmCat] = useState('')
  const [pmTags, setPmTags] = useState('')
  const [pmThumb, setPmThumb] = useState<File | null>(null)
  const [pmThumbPrev, setPmThumbPrev] = useState('')
  const [pmGallery, setPmGallery] = useState<File[]>([])
  const [pmGalleryPrev, setPmGalleryPrev] = useState<string[]>([])
  const [pmExistingImageUrls, setPmExistingImageUrls] = useState<string[]>([])
  const [pmCommissionType, setPmCommissionType] = useState<string>('normal')
  const [pmOwnerRate, setPmOwnerRate] = useState<number | ''>('')
  const [pmPartnerRate, setPmPartnerRate] = useState<number | ''>('')
  const [pmOptions, setPmOptions] = useState<{ name: string; values: string }[]>([])
  const [pmActive, setPmActive] = useState(true)

  const [orderDetail, setOrderDetail] = useState<any | null>(null)
  const [shipModal, setShipModal] = useState<{ open: boolean; order: any | null }>({ open: false, order: null })
  const [shipCourier, setShipCourier] = useState<string>(COURIERS[0])
  const [shipTracking, setShipTracking] = useState('')

  const [couponModal, setCouponModal] = useState(false)
  const [cpName, setCpName] = useState('')
  const [cpCode, setCpCode] = useState('')
  const [cpKind, setCpKind] = useState<'percent' | 'fixed'>('percent')
  const [cpVal, setCpVal] = useState<number>(0)
  const [cpMin, setCpMin] = useState<number>(0)
  const [cpMax, setCpMax] = useState<number | ''>('')
  const [cpLimit, setCpLimit] = useState<number>(100)
  const [cpStart, setCpStart] = useState('')
  const [cpEnd, setCpEnd] = useState('')
  const [cpTarget, setCpTarget] = useState<'all' | 'product'>('all')
  const [cpSelectedProductIds, setCpSelectedProductIds] = useState<string[]>([])

  const [platformFeeRate, setPlatformFeeRate] = useState(8)
  const [settlementDay, setSettlementDay] = useState(25)

  const isInTrialPeriod = ownerSignupDate
    ? Date.now() - new Date(ownerSignupDate).getTime() < 90 * 24 * 60 * 60 * 1000
    : false
  const canAccessStore =
    ownerMode === 'independent' || ownerMode === 'both' || ownerMode === 'integrated' || isInTrialPeriod

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=owner')
      return null
    }
    const { data: urow } = await supabase.from('users').select('id, created_at').eq('auth_id', user.id).maybeSingle()
    const oid = urow?.id ? String(urow.id) : null
    setOwnerUserId(oid)

    const { data: prof } = await supabase.from('profiles').select('*').eq('auth_id', user.id).maybeSingle()
    const p = prof as any
    setOwnerSignupDate(String(urow?.created_at ?? p?.created_at ?? '') || null)
    setOwnerMode(p?.owner_mode ?? null)
    setOwnerSubPlan(p?.owner_subscription_plan ?? null)
    setStoreName(p?.owner_store_name ?? null)
    setStoreDesc(p?.owner_store_description ?? null)
    setStoreLogoUrl(p?.owner_store_logo_url ?? null)
    setBankName(String(p?.owner_bank_name ?? ''))
    setBankAccount(String(p?.owner_bank_account ?? p?.owner_account ?? ''))
    setBankHolder(String(p?.owner_bank_holder ?? p?.owner_holder ?? ''))
    return { user, oid, prof: p }
  }, [router])

  const loadProducts = useCallback(async () => {
    if (!ownerUserId) return
    const { data } = await supabase.from('owner_products').select('*').eq('owner_id', ownerUserId).order('created_at', { ascending: false })
    setProducts((data as any[]) || [])
  }, [ownerUserId])

  const loadOrders = useCallback(async () => {
    if (!ownerUserId) return
    const { data } = await supabase.from('owner_orders').select('*').eq('owner_id', ownerUserId).order('created_at', { ascending: false })
    setOrders((data as any[]) || [])
  }, [ownerUserId])

  const loadCoupons = useCallback(async () => {
    if (!ownerUserId) return
    const { data } = await supabase.from('owner_coupons').select('*').eq('owner_id', ownerUserId)
    setCoupons((data as any[]) || [])
  }, [ownerUserId])

  const loadSettlements = useCallback(async () => {
    if (!ownerUserId) return
    const { data } = await supabase.from('owner_settlements').select('*').eq('owner_id', ownerUserId).order('period_start', { ascending: false })
    setSettlements((data as any[]) || [])
  }, [ownerUserId])

  const loadAdminNumbers = useCallback(async () => {
    const { data: fee } = await supabase.from('admin_settings').select('value').eq('key', 'platform_fee_rate').limit(1).maybeSingle()
    const { data: day } = await supabase.from('admin_settings').select('value').eq('key', 'settlement_day').limit(1).maybeSingle()
    if (fee?.value != null && String(fee.value).trim() !== '') setPlatformFeeRate(Number(fee.value) || 8)
    if (day?.value != null && String(day.value).trim() !== '') setSettlementDay(Number(day.value) || 25)
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      await loadProfile()
      setLoading(false)
    }
    void run()
  }, [loadProfile])

  useEffect(() => {
    if (!canAccessStore || !ownerUserId) return
    void loadProducts()
    void loadOrders()
    void loadCoupons()
    void loadSettlements()
    void loadAdminNumbers()
  }, [canAccessStore, ownerUserId, loadProducts, loadOrders, loadCoupons, loadSettlements, loadAdminNumbers])

  const openStoreModal = () => {
    setModalName(storeName || '')
    setModalDesc(storeDesc || '')
    setModalLogoFile(null)
    setModalLogoPreview(storeLogoUrl || '')
    setStoreModal(true)
  }

  const saveStoreSettings = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !ownerUserId) return
    let logoUrl = storeLogoUrl || ''
    if (modalLogoFile) {
      const path = `${ownerUserId}/logo`
      const { error } = await supabase.storage.from('owner-store').upload(path, modalLogoFile, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('owner-store').getPublicUrl(path)
        logoUrl = data.publicUrl || logoUrl
      }
    }
    const nameTrim = modalName.trim()
    const { data: profRow } = await supabase.from('profiles').select('slug').eq('auth_id', user.id).maybeSingle()
    const profilePayload: Record<string, unknown> = {
      owner_store_name: nameTrim || null,
      owner_store_description: modalDesc.trim() || null,
      owner_store_logo_url: logoUrl || null,
    }
    if (!profRow?.slug && nameTrim) {
      let base = nameTrim.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!base) base = 'owner' + Math.random().toString(16).slice(2, 10)
      let candidate = base
      for (let suffix = 1; suffix < 1000; suffix++) {
        const { data: taken } = await supabase.from('profiles').select('auth_id').eq('slug', candidate).neq('auth_id', user.id).maybeSingle()
        if (!taken) break
        candidate = `${base}${suffix}`
      }
      profilePayload.slug = candidate
    }
    await supabase
      .from('profiles')
      .update(profilePayload as any)
      .eq('auth_id', user.id)
    setStoreName(modalName.trim() || null)
    setStoreDesc(modalDesc.trim() || null)
    setStoreLogoUrl(logoUrl || null)
    setStoreModal(false)
    setToast('저장됐어요 💜')
  }

  const openProductModal = (row: any | null) => {
    setProductModal({ open: true, row })
    if (row) {
      setPmName(String(row.name || ''))
      setPmDesc(String(row.description || ''))
      setPmPrice(Number(row.price || row.retail_price || 0))
      setPmSale(row.sale_price != null ? Number(row.sale_price) : '')
      setPmStock(Number(row.stock ?? 0))
      setPmCat(String(row.category || ''))
      setPmTags(Array.isArray(row.tags) ? row.tags.join(', ') : String(row.tags || ''))
      setPmThumb(null)
      setPmThumbPrev(String(row.thumbnail_url || ''))
      setPmGallery([])
      const existingImgs = Array.isArray(row.image_urls) ? row.image_urls : []
      setPmExistingImageUrls(existingImgs)
      setPmGalleryPrev(existingImgs)
      setPmCommissionType(String(row.commission_type || 'normal'))
      setPmOwnerRate(row.owner_commission_rate != null ? Number(row.owner_commission_rate) : '')
      setPmPartnerRate(row.partner_commission_rate != null ? Number(row.partner_commission_rate) : '')
      setPmOptions(Array.isArray(row.options_json) ? row.options_json : [])
      setPmActive(row.is_active !== false)
    } else {
      setPmName('')
      setPmDesc('')
      setPmPrice(0)
      setPmSale('')
      setPmStock(0)
      setPmCat('')
      setPmTags('')
      setPmThumb(null)
      setPmThumbPrev('')
      setPmGallery([])
      setPmExistingImageUrls([])
      setPmGalleryPrev([])
      setPmCommissionType('normal')
      setPmOwnerRate('')
      setPmPartnerRate('')
      setPmOptions([])
      setPmActive(true)
    }
  }

  const uploadOwnerStorePath = async (path: string, file: File) => {
    const { error } = await supabase.storage.from('owner-store').upload(path, file, { upsert: true })
    if (error) return ''
    const { data } = supabase.storage.from('owner-store').getPublicUrl(path)
    return data.publicUrl || ''
  }

  const saveProduct = async () => {
    if (!ownerUserId) return
    const id = productModal.row?.id || crypto.randomUUID()
    let thumbUrl = pmThumbPrev
    if (pmThumb) {
      const u = await uploadOwnerStorePath(`${ownerUserId}/${id}/thumb`, pmThumb)
      if (u) thumbUrl = u
    }
    const galleryUrls: string[] = [...pmExistingImageUrls]
    for (let i = 0; i < pmGallery.length && galleryUrls.length < 10; i++) {
      const u = await uploadOwnerStorePath(`${ownerUserId}/${id}/gallery_${Date.now()}_${i}`, pmGallery[i])
      if (u) galleryUrls.push(u)
    }
    const tagsArr = pmTags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const payload: any = {
      owner_id: ownerUserId,
      name: pmName.trim(),
      description: pmDesc.trim(),
      price: pmPrice,
      sale_price: pmSale === '' ? null : Number(pmSale),
      stock: pmStock,
      category: pmCat.trim() || null,
      tags: tagsArr,
      thumbnail_url: thumbUrl || null,
      image_urls: galleryUrls,
      commission_type: pmCommissionType,
      owner_commission_rate: pmCommissionType === 'custom' && pmOwnerRate !== '' ? Number(pmOwnerRate) : null,
      partner_commission_rate: pmCommissionType === 'custom' && pmPartnerRate !== '' ? Number(pmPartnerRate) : null,
      options_json: pmOptions,
      is_active: pmActive,
    }
    if (productModal.row?.id) {
      await supabase.from('owner_products').update(payload).eq('id', productModal.row.id)
    } else {
      await supabase.from('owner_products').insert({ ...payload, id })
    }
    setProductModal({ open: false, row: null })
    setToast('저장됐어요 💜')
    void loadProducts()
  }

  const deleteProduct = async (id: string) => {
    await supabase.from('owner_products').delete().eq('id', id)
    void loadProducts()
  }

  const toggleProduct = async (row: any, next: boolean) => {
    await supabase.from('owner_products').update({ is_active: next } as any).eq('id', row.id)
    void loadProducts()
  }

  const mapOrderSubToStatuses = (sub: OrderSubTab): string[] => {
    switch (sub) {
      case 'new':
        return ['pending', '신규', 'new', '주문접수']
      case 'processing':
        return ['processing', '처리중', 'confirmed', '주문확인']
      case 'shipping':
        return ['배송중', 'shipping', 'shipped']
      case 'done':
        return ['completed', '완료', '구매확정']
      case 'cancel':
        return ['cancelled', '취소', '반품', '취소반품']
      default:
        return []
    }
  }

  const filteredOrders = useMemo(() => {
    const st = mapOrderSubToStatuses(orderSub)
    if (!st.length) return orders
    return orders.filter((o) => st.includes(String(o.status || '')))
  }, [orders, orderSub])

  const confirmedForShipping = useMemo(() => orders.filter((o) => String(o.status || '') === 'confirmed' || o.status === '주문확인'), [orders])

  const shippingOrders = useMemo(() => orders.filter((o) => String(o.status || '') === '배송중' || o.status === 'shipping'), [orders])

  const autoConfirmAt = (deliveredAt: string | null) => {
    if (!deliveredAt) return null
    const d = new Date(deliveredAt)
    d.setDate(d.getDate() + 7)
    return d.toISOString()
  }

  const confirmOrder = async (row: any) => {
    await supabase.from('owner_orders').update({ status: 'confirmed' } as any).eq('id', row.id)
    setOrderDetail(null)
    void loadOrders()
    setToast('주문을 확인했어요')
  }

  const cancelOrder = async (row: any) => {
    const qty = Number(row.quantity || row.qty || 1)
    const pid = row.product_id || row.owner_product_id
    if (pid && qty) {
      const { data: p } = await supabase.from('owner_products').select('stock').eq('id', pid).maybeSingle()
      const cur = Number((p as any)?.stock ?? 0)
      await supabase.from('owner_products').update({ stock: cur + qty } as any).eq('id', pid)
    }
    await supabase.from('owner_orders').update({ status: 'cancelled' } as any).eq('id', row.id)
    setOrderDetail(null)
    void loadOrders()
    void loadProducts()
    setToast('취소 처리됐어요')
  }

  const submitShipping = async () => {
    const o = shipModal.order
    if (!o?.id || !shipTracking.trim()) return
    const ac = new Date()
    ac.setDate(ac.getDate() + 7)
    await supabase
      .from('owner_orders')
      .update({
        status: '배송중',
        tracking_number: shipTracking.trim(),
        courier: shipCourier,
        shipped_at: new Date().toISOString(),
        auto_confirm_at: ac.toISOString(),
      } as any)
      .eq('id', o.id)
    const cid = o.customer_user_id || o.customer_id
    if (cid) {
      await supabase.from('notifications').insert({
        user_id: cid,
        type: 'promo',
        title: '상품이 발송됐어요 🚚',
        body: `${shipCourier} ${shipTracking.trim()}`,
        icon: '🚚',
        is_read: false,
      } as any)
    }
    setShipModal({ open: false, order: null })
    setShipTracking('')
    void loadOrders()
    setToast('발송 처리됐어요')
  }

  const saveCoupon = async () => {
    if (!ownerUserId) return
    await supabase.from('owner_coupons').insert({
      owner_id: ownerUserId,
      name: cpName.trim(),
      code: cpCode.trim() || randomCouponCode(),
      discount_kind: cpKind,
      discount_value: cpVal,
      min_order_amount: cpMin,
      max_discount_amount: cpKind === 'percent' && cpMax !== '' ? Number(cpMax) : null,
      usage_limit: cpLimit,
      starts_at: cpStart || null,
      expires_at: cpEnd || null,
      apply_target: cpTarget,
      is_active: true,
    } as any)
    setCouponModal(false)
    void loadCoupons()
    setToast('쿠폰이 생성됐어요')
  }

  const saveBank = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('profiles')
      .update({
        owner_bank_name: bankName.trim() || null,
        owner_bank_account: bankAccount.trim() || null,
        owner_bank_holder: bankHolder.trim() || null,
      } as any)
      .eq('auth_id', user.id)
    setToast('정산 계좌가 저장됐어요')
  }

  const settlementPreview = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const start = new Date(y, m, 1).toISOString()
    const end = new Date(y, m + 1, 0, 23, 59, 59).toISOString()
    let total = 0
    for (const o of orders) {
      if (String(o.status || '') !== 'completed' && o.status !== '완료' && o.status !== '구매확정') continue
      const t = new Date(o.created_at || o.completed_at || 0).getTime()
      if (t >= new Date(start).getTime() && t <= new Date(end).getTime()) {
        total += Number(o.total_amount || o.amount || 0)
      }
    }
    const fee = Math.floor((total * platformFeeRate) / 100)
    const net = total - fee
    return { total, fee, net }
  }, [orders, platformFeeRate])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', padding: 24 }}>
        불러오는 중…
      </div>
    )
  }

  if (!canAccessStore) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', padding: 24, paddingBottom: 110 }}>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>
          3개월 무료 체험이 종료됐어요.<br />
          독립 스토어를 계속 쓰려면 구독이 필요해요.
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/subscription')}
          style={{ marginTop: 16, width: '100%', border: 'none', borderRadius: 12, background: '#7B5EA7', color: '#fff', padding: '12px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          구독하러 가기
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(13,11,9,0.95)',
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>
          ←
        </button>
        <div style={{ fontSize: 15 }}>독립 스토어</div>
      </div>

      <div style={{ padding: 14 }}>
        {!storeName ? (
          <div
            style={{
              background: 'rgba(201,169,110,0.1)',
              border: '1px solid rgba(201,169,110,0.3)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>스토어 이름을 먼저 설정해주세요 💜</div>
            <button
              type="button"
              onClick={openStoreModal}
              style={{ flexShrink: 0, border: '1px solid rgba(201,169,110,0.4)', background: 'rgba(201,169,110,0.15)', color: '#C9A96E', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              설정하기
            </button>
          </div>
        ) : null}

        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
          모드: {ownerMode || '-'} · 플랜: {ownerSubPlan || '-'}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
          {(
            [
              ['products', '제품관리'],
              ['orders', '주문관리'],
              ['shipping', '배송관리'],
              ['coupons', '쿠폰관리'],
              ['settlement', '정산'],
              ['salon-info', '살롱정보'],
            ] as [MainTab, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMainTab(k)}
              style={{
                flexShrink: 0,
                border: mainTab === k ? '1px solid rgba(123,94,167,0.5)' : '1px solid rgba(255,255,255,0.1)',
                background: mainTab === k ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.03)',
                color: '#fff',
                borderRadius: 20,
                padding: '7px 12px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {mainTab === 'products' && (
          <div>
            <button
              type="button"
              onClick={() => openProductModal(null)}
              style={{ width: '100%', marginBottom: 12, border: 'none', borderRadius: 12, background: '#7B5EA7', color: '#fff', padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + 제품 등록
            </button>
            {products.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, textAlign: 'center', padding: '24px 8px' }}>
                아직 등록된 제품이 없어요
                <br />
                첫 제품을 등록해보세요 💜
              </div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <img src={p.thumbnail_url || ''} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', background: '#222' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#C9A96E' }}>{Number(p.price || 0).toLocaleString()}원</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                      재고 {p.stock ?? 0} · 판매 {p.sales_count ?? 0}
                    </div>
                  </div>
                  <label style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                    <input type="checkbox" checked={p.is_active !== false} onChange={(e) => void toggleProduct(p, e.target.checked)} /> 활성
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button type="button" onClick={() => openProductModal(p)} style={{ fontSize: 10, borderRadius: 6, border: '1px solid rgba(123,94,167,0.35)', background: 'transparent', color: '#c4a7e7', padding: '4px 8px', cursor: 'pointer' }}>
                      수정
                    </button>
                    <button type="button" onClick={() => void deleteProduct(p.id)} style={{ fontSize: 10, borderRadius: 6, border: '1px solid rgba(217,79,79,0.35)', background: 'transparent', color: '#ff9d9d', padding: '4px 8px', cursor: 'pointer' }}>
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {mainTab === 'orders' && (
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {(
                [
                  ['new', '신규'],
                  ['processing', '처리중'],
                  ['shipping', '배송중'],
                  ['done', '완료'],
                  ['cancel', '취소반품'],
                ] as [OrderSubTab, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOrderSub(k)}
                  style={{
                    border: orderSub === k ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.12)',
                    background: orderSub === k ? 'rgba(123,94,167,0.2)' : 'transparent',
                    color: '#fff',
                    borderRadius: 8,
                    padding: '5px 10px',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            {filteredOrders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: 16 }}>주문이 없어요</div>
            ) : (
              filteredOrders.map((o) => (
                <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>#{String(o.id).slice(0, 8)}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {o.customer_name || '고객'} · {o.product_name || '-'}
                  </div>
                  <div style={{ fontSize: 11, color: '#C9A96E', marginTop: 4 }}>
                    {Number(o.total_amount || o.amount || 0).toLocaleString()}원 · 수수료 {Number(o.platform_fee || 0).toLocaleString()} · 정산 {Number(o.settlement_amount || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    {o.created_at ? new Date(o.created_at).toLocaleString('ko-KR') : ''}{' '}
                    <span style={{ marginLeft: 6, color: '#c4a7e7' }}>{o.status}</span>
                  </div>
                  {o.delivered_at && o.auto_confirm_at ? (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>자동구매확정: {new Date(o.auto_confirm_at).toLocaleDateString('ko-KR')}</div>
                  ) : o.delivered_at ? (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>자동구매확정 예정: {new Date(autoConfirmAt(o.delivered_at) || '').toLocaleDateString('ko-KR')}</div>
                  ) : null}
                  <button type="button" onClick={() => setOrderDetail(o)} style={{ marginTop: 8, fontSize: 10, borderRadius: 8, border: '1px solid rgba(123,94,167,0.35)', background: 'transparent', color: '#c4a7e7', padding: '5px 10px', cursor: 'pointer' }}>
                    상세
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {mainTab === 'shipping' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#c4a7e7' }}>발송 대기 (주문확인)</div>
            {confirmedForShipping.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>발송할 주문이 없어요</div>
            ) : (
              confirmedForShipping.map((o) => (
                <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 11 }}>#{String(o.id).slice(0, 8)} · {o.customer_name || '고객'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{o.shipping_address || o.address || '-'}</div>
                  <button type="button" onClick={() => setShipModal({ open: true, order: o })} style={{ marginTop: 8, fontSize: 10, borderRadius: 8, background: '#7B5EA7', border: 'none', color: '#fff', padding: '6px 12px', cursor: 'pointer' }}>
                    발송처리
                  </button>
                </div>
              ))
            )}
            <div style={{ fontSize: 12, fontWeight: 700, margin: '16px 0 8px', color: '#c4a7e7' }}>배송중</div>
            {shippingOrders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>배송중인 주문이 없어요</div>
            ) : (
              shippingOrders.map((o) => (
                <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 11 }}>
                    {o.courier} · {o.tracking_number}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const u = trackingUrl(String(o.courier || ''), String(o.tracking_number || ''))
                      if (u) window.open(u, '_blank')
                    }}
                    style={{ marginTop: 8, fontSize: 10, borderRadius: 8, border: '1px solid rgba(201,169,110,0.35)', background: 'rgba(201,169,110,0.12)', color: '#C9A96E', padding: '6px 12px', cursor: 'pointer' }}
                  >
                    배송조회
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {mainTab === 'coupons' && (
          <div>
            <button
              type="button"
              onClick={() => {
                setCpSelectedProductIds([])
                setCouponModal(true)
              }}
              style={{ width: '100%', marginBottom: 12, border: 'none', borderRadius: 12, background: '#7B5EA7', color: '#fff', padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              + 쿠폰 생성
            </button>
            {coupons.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>쿠폰이 없어요</div>
            ) : (
              coupons.map((c) => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{c.code}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                    {c.discount_kind === 'percent' ? `${c.discount_value}%` : `${Number(c.discount_value).toLocaleString()}원`} · 사용 {c.used_count ?? 0}/{c.usage_limit ?? '-'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    {c.starts_at?.slice(0, 10)} ~ {c.expires_at?.slice(0, 10)}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <label style={{ fontSize: 10 }}>
                      <input
                        type="checkbox"
                        checked={c.is_active !== false}
                        onChange={async (e) => {
                          await supabase.from('owner_coupons').update({ is_active: e.target.checked } as any).eq('id', c.id)
                          void loadCoupons()
                        }}
                      />{' '}
                      활성
                    </label>
                    <button type="button" onClick={() => void supabase.from('owner_coupons').delete().eq('id', c.id).then(() => loadCoupons())} style={{ fontSize: 10, color: '#ff9d9d', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {mainTab === 'settlement' && (
          <div>
            <div style={{ background: 'rgba(123,94,167,0.1)', border: '1px solid rgba(123,94,167,0.25)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>이번달 예상 정산</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#C9A96E', marginTop: 6 }}>{settlementPreview.total.toLocaleString()}원</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
                플랫폼 수수료 ({platformFeeRate}%): -{settlementPreview.fee.toLocaleString()}원
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#c4a7e7', marginTop: 4 }}>정산 예정 {settlementPreview.net.toLocaleString()}원</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 10 }}>매월 {settlementDay}일 정산</div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>정산 계좌</div>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="은행명" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="계좌번호" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} placeholder="예금주" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <button type="button" onClick={() => void saveBank()} style={{ width: '100%', border: 'none', borderRadius: 12, background: '#7B5EA7', color: '#fff', padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>
              계좌 저장
            </button>

            <div style={{ fontSize: 12, fontWeight: 700, margin: '18px 0 8px' }}>정산 내역</div>
            {settlements.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>내역이 없어요</div>
            ) : (
              settlements.map((s) => {
                const done = String(s.status || '').includes('완료') || s.status === 'paid'
                return (
                  <div key={s.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 11 }}>
                      {s.period_start?.slice(0, 10)} ~ {s.period_end?.slice(0, 10)}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      매출 {Number(s.total_sales || 0).toLocaleString()} · 수수료 {Number(s.platform_fee || 0).toLocaleString()} · 정산 {Number(s.net_amount || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 4, color: done ? '#4cad7e' : '#C9A96E' }}>{s.status || '대기'}</div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {mainTab === 'salon-info' && <SalonInfoForm />}
      </div>

      {storeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 360, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>스토어 설정</div>
            <input value={modalName} onChange={(e) => setModalName(e.target.value)} placeholder="스토어명" style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <textarea value={modalDesc} onChange={(e) => setModalDesc(e.target.value)} placeholder="스토어 설명" rows={3} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setModalLogoFile(f)
                if (f) setModalLogoPreview(URL.createObjectURL(f))
              }}
            />
            {modalLogoPreview ? <img src={modalLogoPreview} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', marginTop: 8 }} /> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setStoreModal(false)} style={{ flex: 1, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                닫기
              </button>
              <button type="button" onClick={() => void saveStoreSettings()} style={{ flex: 2, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {productModal.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(0,0,0,0.8)', overflowY: 'auto', padding: '16px 0 80px' }}>
          <div style={{ width: '92%', maxWidth: 400, margin: '0 auto', background: '#1a1228', border: '1px solid rgba(123,94,167,0.35)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>{productModal.row ? '제품 수정' : '제품 등록'}</div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>썸네일</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setPmThumb(f)
                if (f) setPmThumbPrev(URL.createObjectURL(f))
              }}
            />
            {pmThumbPrev ? <img src={pmThumbPrev} alt="" style={{ width: 100, height: 100, borderRadius: 10, objectFit: 'cover', marginTop: 8 }} /> : null}
            <div style={{ fontSize: 11, margin: '12px 0 4px' }}>상세 이미지 (최대 10장)</div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const arr = Array.from(e.target.files || []).slice(0, Math.max(0, 10 - pmExistingImageUrls.length))
                setPmGallery(arr)
                setPmGalleryPrev([...pmExistingImageUrls, ...arr.map((f) => URL.createObjectURL(f))])
              }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {pmGalleryPrev.map((u, i) => (
                <img key={i} src={u} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} />
              ))}
            </div>
            <input value={pmName} onChange={(e) => setPmName(e.target.value)} placeholder="제품명" style={{ width: '100%', boxSizing: 'border-box', marginTop: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <textarea value={pmDesc} onChange={(e) => setPmDesc(e.target.value)} placeholder="설명" rows={4} style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input type="number" value={pmPrice} onChange={(e) => setPmPrice(Number(e.target.value))} placeholder="정가" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input type="number" value={pmSale === '' ? '' : pmSale} onChange={(e) => setPmSale(e.target.value === '' ? '' : Number(e.target.value))} placeholder="할인가 (선택)" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input type="number" value={pmStock} onChange={(e) => setPmStock(Number(e.target.value))} placeholder="재고" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input value={pmCat} onChange={(e) => setPmCat(e.target.value)} placeholder="카테고리" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input value={pmTags} onChange={(e) => setPmTags(e.target.value)} placeholder="태그 (쉼표 구분)" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />

            <div style={{ fontSize: 11, margin: '12px 0 6px' }}>커미션 타입</div>
            {[
              ['normal', '일반 (기본 커미션)'],
              ['group', '공구 (할인율 낮음)'],
              ['timesale', '타임세일'],
              ['event', '이벤트 (커미션 없음)'],
              ['custom', '직접 설정'],
            ].map(([v, l]) => (
              <label key={v} style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
                <input type="radio" name="ct" checked={pmCommissionType === v} onChange={() => setPmCommissionType(v)} /> {l}
              </label>
            ))}
            {pmCommissionType === 'custom' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input type="number" value={pmOwnerRate === '' ? '' : pmOwnerRate} onChange={(e) => setPmOwnerRate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="원장님 %" style={{ flex: 1, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 8, fontSize: 11 }} />
                <input type="number" value={pmPartnerRate === '' ? '' : pmPartnerRate} onChange={(e) => setPmPartnerRate(e.target.value === '' ? '' : Number(e.target.value))} placeholder="파트너스 %" style={{ flex: 1, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 8, fontSize: 11 }} />
              </div>
            ) : null}

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setPmOptions((p) => [...p, { name: '', values: '' }])}
                style={{ border: '1px solid rgba(123,94,167,0.35)', background: 'rgba(123,94,167,0.12)', color: '#c4a7e7', borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
              >
                + 옵션
              </button>
              {pmOptions.map((op, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={op.name} onChange={(e) => setPmOptions((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="옵션명" style={{ flex: 1, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 8, fontSize: 11 }} />
                  <input value={op.values} onChange={(e) => setPmOptions((arr) => arr.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} placeholder="값 쉼표구분" style={{ flex: 1, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 8, fontSize: 11 }} />
                </div>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: 11, marginTop: 10 }}>
              <input type="checkbox" checked={pmActive} onChange={(e) => setPmActive(e.target.checked)} /> 활성
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={() => setProductModal({ open: false, row: null })} style={{ flex: 1, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                닫기
              </button>
              <button type="button" onClick={() => void saveProduct()} style={{ flex: 2, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {orderDetail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 380, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 16, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>주문 상세</div>
            <pre style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', whiteSpace: 'pre-wrap', marginTop: 10 }}>{JSON.stringify(orderDetail, null, 2)}</pre>
            <div style={{ fontSize: 11, marginTop: 8, color: 'rgba(255,255,255,0.5)' }}>배송지: {orderDetail.shipping_address || orderDetail.address || '-'}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.5)' }}>쿠폰: {orderDetail.coupon_code || orderDetail.applied_coupon || '-'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => void confirmOrder(orderDetail)} style={{ flex: 1, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>
                주문확인
              </button>
              <button type="button" onClick={() => void cancelOrder(orderDetail)} style={{ flex: 1, border: '1px solid rgba(217,79,79,0.4)', background: 'rgba(217,79,79,0.12)', color: '#ff9d9d', borderRadius: 10, padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>
                취소처리
              </button>
            </div>
            <button type="button" onClick={() => setOrderDetail(null)} style={{ marginTop: 10, width: '100%', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '8px 0', cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {shipModal.open && shipModal.order && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 360, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>발송 처리</div>
            <select value={shipCourier} onChange={(e) => setShipCourier(e.target.value)} style={{ width: '100%', marginTop: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0D0B09', color: '#fff', padding: 10, fontSize: 12 }}>
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input value={shipTracking} onChange={(e) => setShipTracking(e.target.value)} placeholder="송장번호" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setShipModal({ open: false, order: null })} style={{ flex: 1, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                닫기
              </button>
              <button type="button" onClick={() => void submitShipping()} style={{ flex: 2, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                발송완료
              </button>
            </div>
          </div>
        </div>
      )}

      {couponModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 380, background: '#1a1228', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 16, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>쿠폰 생성</div>
            <input value={cpName} onChange={(e) => setCpName(e.target.value)} placeholder="쿠폰명" style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input value={cpCode} onChange={(e) => setCpCode(e.target.value)} placeholder="쿠폰코드" style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
              <button
                type="button"
                onClick={() => setCpCode(randomCouponCode())}
                style={{ border: '1px solid rgba(201,169,110,0.35)', background: 'rgba(201,169,110,0.12)', color: '#C9A96E', borderRadius: 10, padding: '0 12px', fontSize: 11, cursor: 'pointer' }}
              >
                자동생성
              </button>
            </div>
            <label style={{ display: 'block', fontSize: 11, marginTop: 10 }}>
              <input type="radio" checked={cpKind === 'percent'} onChange={() => setCpKind('percent')} /> 정률 (%)
            </label>
            <label style={{ display: 'block', fontSize: 11 }}>
              <input type="radio" checked={cpKind === 'fixed'} onChange={() => setCpKind('fixed')} /> 정액 (원)
            </label>
            <input type="number" value={cpVal} onChange={(e) => setCpVal(Number(e.target.value))} placeholder="할인값" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <input type="number" value={cpMin} onChange={(e) => setCpMin(Number(e.target.value))} placeholder="최소주문금액" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            {cpKind === 'percent' ? (
              <input type="number" value={cpMax === '' ? '' : cpMax} onChange={(e) => setCpMax(e.target.value === '' ? '' : Number(e.target.value))} placeholder="최대할인금액" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            ) : null}
            <input type="number" value={cpLimit} onChange={(e) => setCpLimit(Number(e.target.value))} placeholder="사용횟수 제한" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="date" value={cpStart} onChange={(e) => setCpStart(e.target.value)} style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 8, fontSize: 11 }} />
              <input type="date" value={cpEnd} onChange={(e) => setCpEnd(e.target.value)} style={{ flex: 1, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 8, fontSize: 11 }} />
            </div>
            <OwnerCouponProductTargetFields
              products={products.map((p) => ({ id: String(p.id), name: String(p.name || ''), thumbnail_url: p.thumbnail_url }))}
              target={cpTarget}
              onTargetChange={setCpTarget}
              selectedProductIds={cpSelectedProductIds}
              onSelectedProductIdsChange={setCpSelectedProductIds}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setCouponModal(false)} style={{ flex: 1, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                닫기
              </button>
              <button type="button" onClick={() => void saveCoupon()} style={{ flex: 2, border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 88, background: 'rgba(123,94,167,0.95)', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 200 }}>
          {toast}
        </div>
      ) : null}

    </div>
  )
}
