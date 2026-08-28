'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const BG = '#1a1228'
const BORDER = 'rgba(123,94,167,0.45)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const SHEET_BG = '#11161b'

type LinkType = 'booking' | 'brand_product' | 'product'

type ShippingAddr = {
  id: string
  recipient_name?: string | null
  name?: string | null
  phone?: string | null
  recipient_phone?: string | null
  address?: string | null
  address_detail?: string | null
  detail?: string | null
  label?: string | null
  is_default?: boolean | null
}

export default function SceneCtaPaymentModal(props: {
  scenePostId: string
  linkType: LinkType
  salonName: string
  itemName: string
  price: number
  uploaderNickname?: string | null
  /** PayApp target_id (booking pipe). brand_product는 모달에서 batch 생성 */
  targetId?: string | null
  productHref?: string | null
  salonId?: string | null
  brandProductId?: string | null
  onClose: () => void
}) {
  const {
    scenePostId,
    linkType,
    salonName,
    itemName,
    price,
    uploaderNickname,
    targetId,
    productHref,
    salonId,
    brandProductId,
    onClose,
  } = props

  const supabase = createClient()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [meId, setMeId] = useState<string | null>(null)
  const [savedAddresses, setSavedAddresses] = useState<ShippingAddr[]>([])
  const [selectedAddr, setSelectedAddr] = useState<ShippingAddr | null>(null)
  const [addrLoading, setAddrLoading] = useState(linkType === 'brand_product')
  const [addressSheetOpen, setAddressSheetOpen] = useState(false)
  const [newAddressOpen, setNewAddressOpen] = useState(false)
  const [newAddrStep, setNewAddrStep] = useState(1)
  const [newAddress, setNewAddress] = useState('')
  const [newAddressDetail, setNewAddressDetail] = useState('')
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newRecipientPhone, setNewRecipientPhone] = useState('')
  const [newAddressLabel, setNewAddressLabel] = useState<'집' | '회사' | '기타'>('집')
  const [addressSaving, setAddressSaving] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [quote, setQuote] = useState<{ subtotal: number; shipping_fee: number; final_amount: number } | null>(null)

  const kind = linkType === 'booking' ? 'booking' : 'brand_product_order'
  const iconLabel = linkType === 'booking' ? '📅' : '🛍'
  const payLabel =
    linkType === 'booking' ? '이 관리 바로결제하기' : '이 제품 바로결제하기'

  const reloadSavedAddresses = async (userId: string) => {
    const { data } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false }).order('created_at', { ascending: false })
    const rows = (data || []) as ShippingAddr[]
    setSavedAddresses(rows)
    return rows
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).daum?.Postcode) return
    const existing = document.querySelector('script[data-daum-postcode="true"]')
    if (existing) return
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.setAttribute('data-daum-postcode', 'true')
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    if (linkType !== 'brand_product') return
    let cancelled = false
    ;(async () => {
      setAddrLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        if (!cancelled) {
          setMeId(null)
          setAddrLoading(false)
        }
        return
      }
      const { data: u } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!u?.id) {
        if (!cancelled) {
          setMeId(null)
          setAddrLoading(false)
        }
        return
      }
      if (cancelled) return
      setMeId(u.id)
      const rows = await reloadSavedAddresses(u.id)
      if (cancelled) return
      const def = rows.find((r) => r.is_default === true) || rows[0] || null
      setSelectedAddr(def)
      setAddrLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkType])
  useEffect(() => {
    if (linkType !== 'brand_product') return
    if (!salonId || !brandProductId || !selectedAddr) {
      setQuote(null)
      setQuoting(false)
      return
    }
    const address = String(selectedAddr.address || '').trim()
    if (!address) {
      setQuote(null)
      return
    }
    let cancelled = false
    setQuoting(true)
    ;(async () => {
      try {
        const res = await fetch('/api/brand-product-orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dry_run: true,
            salon_id: salonId,
            items: [{ brand_product_id: brandProductId, quantity: 1 }],
            address,
            address_detail: String(selectedAddr.address_detail || selectedAddr.detail || '').trim() || null,
          }),
        }).then((r) => r.json())
        if (cancelled) return
        if (!res?.ok) {
          setQuote(null)
          setError('배송비 계산에 실패했어요. 배송지를 다시 확인해주세요')
          return
        }
        setQuote({
          subtotal: Math.trunc(Number(res.subtotal) || 0),
          shipping_fee: Math.trunc(Number(res.shipping_fee) || 0),
          final_amount: Math.trunc(Number(res.final_amount) || 0),
        })
        setError('')
      } catch {
        if (!cancelled) {
          setQuote(null)
          setError('배송비 계산에 실패했어요. 잠시 후 다시 시도해주세요')
        }
      } finally {
        if (!cancelled) setQuoting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [linkType, salonId, brandProductId, selectedAddr])


  const openAddressSearch = (onSelect: (addr: string) => void) => {
    if (!(window as any).daum?.Postcode) return
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => onSelect(String(data?.roadAddress || '')),
    }).open()
  }

  const formatAddrLine = (row: ShippingAddr) => {
    const addr = String(row.address || '').trim()
    const detail = String(row.address_detail || row.detail || '').trim()
    const name = String(row.recipient_name || row.name || '').trim()
    const left = [addr, detail].filter(Boolean).join(' ')
    return name ? `${left} · ${name}` : left || '배송지'
  }

  const pickAddress = (row: ShippingAddr) => {
    setSelectedAddr(row)
    setAddressSheetOpen(false)
    setNewAddressOpen(false)
    setNewAddrStep(1)
  }

  const handlePay = async () => {
    if (paying) return
    if (linkType === 'product') {
      window.location.href = productHref || (targetId ? `/products/${targetId}` : '/')
      return
    }

    if (linkType === 'brand_product') {
      if (!salonId || !brandProductId) {
        setError('제품 정보가 없어요')
        return
      }
      if (!selectedAddr) {
        setError('배송지를 등록해주세요')
        return
      }
      const address = String(selectedAddr.address || '').trim()
      const recipient_name = String(selectedAddr.recipient_name || selectedAddr.name || '').trim()
      const recipient_phone = String(selectedAddr.phone || selectedAddr.recipient_phone || '').trim()
      const address_detail = String(selectedAddr.address_detail || selectedAddr.detail || '').trim() || null
      if (!address || !recipient_name || !recipient_phone) {
        setError('배송지 정보가 올바르지 않아요')
        return
      }
      setPaying(true)
      setError('')
      try {
        const checkoutBatchId = crypto.randomUUID()
        const orderRes = await fetch('/api/brand-product-orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salon_id: salonId,
            checkout_batch_id: checkoutBatchId,
            items: [{ brand_product_id: brandProductId, quantity: 1 }],
            recipient_name,
            recipient_phone,
            address,
            address_detail,
            scene_post_id: scenePostId,
          }),
        }).then((r) => r.json())
        if (!orderRes?.ok) {
          setError(orderRes?.error || '주문 생성에 실패했어요')
          setPaying(false)
          return
        }
        const amount = Math.trunc(Number(orderRes.final_amount))
        if (!Number.isFinite(amount) || amount < 1000) {
          setError('결제 금액이 올바르지 않아요')
          setPaying(false)
          return
        }
        const payRes = await fetch('/api/payments/payapp/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'brand_product_order',
            amount,
            target_id: checkoutBatchId,
            scene_post_id: scenePostId,
          }),
        }).then((r) => r.json())
        if (!payRes?.ok || !payRes?.pay_url) {
          setError(payRes?.error || payRes?.reason || '결제 요청에 실패했어요')
          setPaying(false)
          return
        }
        window.location.href = payRes.pay_url as string
      } catch {
        setError('결제 요청 중 오류가 발생했어요')
        setPaying(false)
      }
      return
    }

    const amount = Math.trunc(Number(price))
    if (!Number.isFinite(amount) || amount < 1000) {
      setError('결제 금액이 올바르지 않아요')
      return
    }
    setPaying(true)
    setError('')
    try {
      const res = await fetch('/api/payments/payapp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount,
          target_id: targetId || undefined,
          scene_post_id: scenePostId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok || !json?.pay_url) {
        setError(json?.error || json?.reason || '결제 요청에 실패했어요')
        setPaying(false)
        return
      }
      window.location.href = json.pay_url as string
    } catch {
      setError('결제 요청 중 오류가 발생했어요')
      setPaying(false)
    }
  }

  const openSheetForAdd = () => {
    setAddressSheetOpen(true)
    setNewAddressOpen(true)
    setNewAddrStep(1)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          padding: 20,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(123,94,167,0.25)',
              border: `1px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            {iconLabel}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: TEXT, marginBottom: 4 }}>
          {itemName}
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: TEXT_SUB, marginBottom: 14 }}>
          {salonName}
        </div>

        <div
          style={{
            background: 'rgba(201,169,110,0.12)',
            border: '1px solid rgba(201,169,110,0.35)',
            borderRadius: 12,
            padding: '12px 14px',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>결제 금액</div>
          {linkType === 'brand_product' ? (
            quoting ? (
              <div style={{ fontSize: 14, color: TEXT_SUB }}>배송비 계산 중…</div>
            ) : quote ? (
              quote.shipping_fee > 0 ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, lineHeight: 1.55 }}>
                  {`제품가 ₩${quote.subtotal.toLocaleString()} + 배송비 ₩${quote.shipping_fee.toLocaleString()} = ₩${quote.final_amount.toLocaleString()}`}
                </div>
              ) : (
                <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>
                  {`₩${quote.final_amount.toLocaleString()}`}
                </div>
              )
            ) : (
              <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>
                {`₩${Math.trunc(price).toLocaleString()}`}
              </div>
            )
          ) : (
            <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>
              {Math.trunc(price).toLocaleString()}원
            </div>
          )}
        </div>

        {uploaderNickname ? (
          <div
            style={{
              fontSize: 12,
              color: TEXT_SUB,
              lineHeight: 1.55,
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            {uploaderNickname}님의 영상을 보고 오셨네요
          </div>
        ) : null}

        {linkType === 'brand_product' ? (
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '12px 12px',
              marginBottom: 12,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>배송지</div>
            {addrLoading ? (
              <div style={{ fontSize: 12, color: TEXT_SUB }}>불러오는 중…</div>
            ) : selectedAddr ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 12, color: TEXT, lineHeight: 1.5 }}>
                  {formatAddrLine(selectedAddr)}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddressSheetOpen(true)
                    setNewAddressOpen(false)
                  }}
                  style={{
                    flexShrink: 0,
                    border: `1px solid ${BORDER}`,
                    background: 'transparent',
                    color: GOLD,
                    borderRadius: 8,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  변경
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>배송지를 등록해주세요</div>
                <button
                  type="button"
                  onClick={openSheetForAdd}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 10,
                    background: PURPLE,
                    color: TEXT,
                    padding: '10px 0',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  추가하기
                </button>
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <div style={{ fontSize: 11, color: '#E57373', textAlign: 'center', marginBottom: 10 }}>
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled={paying || (linkType === 'brand_product' && !selectedAddr)}
          onClick={() => void handlePay()}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 12,
            background:
              paying || (linkType === 'brand_product' && !selectedAddr)
                ? 'rgba(123,94,167,0.45)'
                : PURPLE,
            color: TEXT,
            padding: '13px 0',
            fontSize: 14,
            fontWeight: 800,
            cursor:
              paying || (linkType === 'brand_product' && !selectedAddr) ? 'default' : 'pointer',
            marginBottom: 8,
          }}
        >
          {paying ? '결제 준비 중…' : payLabel}
        </button>

        <button
          type="button"
          disabled={paying}
          onClick={onClose}
          style={{
            width: '100%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: TEXT,
            borderRadius: 12,
            padding: '11px 0',
            fontSize: 12,
            cursor: paying ? 'default' : 'pointer',
          }}
        >
          닫기
        </button>
      </div>

      {addressSheetOpen ? (
        <>
          <div
            onClick={() => setAddressSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.55)' }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: '75vh',
              overflowY: 'auto',
              zIndex: 200,
              background: SHEET_BG,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              padding: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 10 }}>배송지 선택</div>
            {savedAddresses.map((row) => {
              const lineAddress = String(row.address || '')
              const selected =
                selectedAddr?.id === row.id ||
                (lineAddress === String(selectedAddr?.address || '') &&
                  String(row.recipient_name || row.name || '') ===
                    String(selectedAddr?.recipient_name || selectedAddr?.name || ''))
              return (
                <label
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    border: selected ? '1px solid rgba(201,168,76,0.6)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="scene_cta_saved_address_pick"
                    checked={!!selected}
                    onChange={() => pickAddress(row)}
                  />
                  <span style={{ lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 500, color: '#fff' }}>{row.label || '배송지'}</span>
                    {row.is_default === true ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: '#fff',
                          background: '#7B5EA7',
                          borderRadius: 999,
                          padding: '2px 7px',
                        }}
                      >
                        기본
                      </span>
                    ) : null}
                    <br />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.86)' }}>
                      {String(row.recipient_name || row.name || '-')} ·{' '}
                      {String(row.phone || row.recipient_phone || '-')}
                    </span>
                    <br />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                      {lineAddress || '-'}
                      {row.address_detail || row.detail
                        ? ` ${String(row.address_detail || row.detail)}`
                        : ''}
                    </span>
                  </span>
                </label>
              )
            })}

            <button
              type="button"
              onClick={() => setNewAddressOpen((v) => !v)}
              style={{
                width: '100%',
                marginTop: 4,
                marginBottom: 8,
                border: '1px dashed rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                borderRadius: 10,
                padding: '9px 0',
                cursor: 'pointer',
              }}
            >
              + 새 주소 추가
            </button>

            {newAddressOpen ? (
              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 500,
                      color: newAddrStep === 1 ? '#fff' : 'rgba(255,255,255,0.45)',
                      padding: '6px 0',
                      borderRadius: 8,
                      background: newAddrStep === 1 ? '#7B5EA7' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    1. 주소
                  </div>
                  <div
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 500,
                      color: newAddrStep === 2 ? '#fff' : 'rgba(255,255,255,0.45)',
                      padding: '6px 0',
                      borderRadius: 8,
                      background: newAddrStep === 2 ? '#7B5EA7' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    2. 받는 분
                  </div>
                </div>
                {newAddrStep === 1 ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>
                      주소를 입력해주세요
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        readOnly
                        placeholder="주소"
                        value={newAddress}
                        style={{
                          flex: 1,
                          boxSizing: 'border-box',
                          background: 'rgba(0,0,0,0.25)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          color: '#fff',
                          fontSize: 12,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => openAddressSearch((addr) => setNewAddress(addr))}
                        style={{
                          width: 72,
                          flexShrink: 0,
                          border: 'none',
                          borderRadius: 8,
                          background: '#7B5EA7',
                          color: '#fff',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        주소찾기
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="상세주소"
                      value={newAddressDetail}
                      onChange={(e) => setNewAddressDetail(e.target.value)}
                      style={{
                        width: '100%',
                        marginBottom: 10,
                        boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setNewAddressOpen(false)
                          setNewAddrStep(1)
                        }}
                        style={{
                          flex: 1,
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: 8,
                          background: 'transparent',
                          color: 'rgba(255,255,255,0.85)',
                          fontSize: 12,
                          padding: '8px 0',
                          cursor: 'pointer',
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        disabled={!newAddress.trim()}
                        onClick={() => setNewAddrStep(2)}
                        style={{
                          flex: 1,
                          border: 'none',
                          borderRadius: 8,
                          background: '#7B5EA7',
                          color: '#fff',
                          fontSize: 12,
                          padding: '8px 0',
                          cursor: 'pointer',
                          opacity: !newAddress.trim() ? 0.45 : 1,
                        }}
                      >
                        다음
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 10 }}>
                      받는 분 정보
                    </div>
                    <div
                      style={{
                        marginBottom: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: 'rgba(123, 94, 167, 0.35)',
                        border: '1px solid rgba(123, 94, 167, 0.5)',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.95)',
                        lineHeight: 1.5,
                      }}
                    >
                      {`${newAddress.trim()} ${newAddressDetail.trim()}`.trim() || '-'}
                    </div>
                    <input
                      type="text"
                      placeholder="이름"
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      style={{
                        width: '100%',
                        marginBottom: 8,
                        boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                    <input
                      type="tel"
                      placeholder="전화번호"
                      value={newRecipientPhone}
                      onChange={(e) => setNewRecipientPhone(e.target.value)}
                      style={{
                        width: '100%',
                        marginBottom: 8,
                        boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
                      배송지 이름
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      {(['집', '회사', '기타'] as const).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setNewAddressLabel(chip)}
                          style={{
                            flex: 1,
                            border: newAddressLabel === chip ? 'none' : '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 999,
                            background: newAddressLabel === chip ? '#7B5EA7' : 'transparent',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '6px 0',
                            cursor: 'pointer',
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setNewAddrStep(1)}
                        style={{
                          flex: 1,
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: 8,
                          background: 'transparent',
                          color: 'rgba(255,255,255,0.85)',
                          fontSize: 12,
                          padding: '8px 0',
                          cursor: 'pointer',
                        }}
                      >
                        ← 이전
                      </button>
                      <button
                        type="button"
                        disabled={
                          addressSaving ||
                          !meId ||
                          !newRecipientName.trim() ||
                          !newRecipientPhone.trim() ||
                          !newAddress.trim()
                        }
                        onClick={async () => {
                          if (!meId) return
                          setAddressSaving(true)
                          const finalAddress = newAddress.trim()
                          const finalDetail = newAddressDetail.trim() || null
                          const isDuplicate = savedAddresses.some((a) => {
                            const existingAddr = String(a.address ?? '').trim()
                            const existingDetail = a.address_detail
                              ? String(a.address_detail).trim()
                              : null
                            return existingAddr === finalAddress && existingDetail === finalDetail
                          })
                          if (isDuplicate) {
                            alert('이미 등록된 주소예요')
                            setAddressSaving(false)
                            return
                          }
                          const { data, error: insertErr } = await supabase
                            .from('shipping_addresses')
                            .insert({
                              user_id: meId,
                              recipient_name: newRecipientName.trim(),
                              phone: newRecipientPhone.trim(),
                              address: finalAddress,
                              address_detail: finalDetail,
                              label: newAddressLabel,
                              is_default: savedAddresses.length === 0,
                            })
                            .select()
                            .maybeSingle()
                          setAddressSaving(false)
                          if (insertErr || !data) {
                            alert('배송지 저장에 실패했어요')
                            return
                          }
                          const rows = await reloadSavedAddresses(meId)
                          const created =
                            (data as ShippingAddr) || rows.find((r) => r.id === (data as any).id)
                          if (created) setSelectedAddr(created)
                          setNewAddressOpen(false)
                          setNewAddrStep(1)
                          setNewRecipientName('')
                          setNewRecipientPhone('')
                          setNewAddress('')
                          setNewAddressDetail('')
                          setAddressSheetOpen(false)
                        }}
                        style={{
                          flex: 1,
                          border: 'none',
                          borderRadius: 8,
                          background: '#7B5EA7',
                          color: '#fff',
                          fontSize: 12,
                          padding: '8px 0',
                          cursor: 'pointer',
                          opacity: addressSaving ? 0.7 : 1,
                        }}
                      >
                        {addressSaving ? '저장 중...' : '저장하기'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setAddressSheetOpen(false)}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #C9A96E, #a07840)',
                color: '#000',
                fontWeight: 500,
                padding: '11px 0',
                cursor: 'pointer',
              }}
            >
              이 주소로 배송
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}