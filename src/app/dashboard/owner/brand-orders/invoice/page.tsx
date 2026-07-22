'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import {
  calcPouchTier,
  expandOrderItemsToLines,
  pouchTierLabel,
  type InvoiceLineRow,
} from '@/lib/brand/brandBilling'
import { billingCycleRange } from '@/lib/billing/aggregateBrandBilling'

const CIVASAN_BRAND_ID = '60413ded-91f4-4004-b677-ae684cb0677e'
const INVOICE_PAY_API = '/api/payments/brand-self/civasan/invoice/create'
const SYNC_API = '/api/owner/brand-billing-invoice/sync'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'

type BillingInvoice = {
  id: string
  brand_id: string
  total_amount: number
  points_total: number
  pouch_tier: number | null
  status: 'unpaid' | 'paid'
  paid_at: string | null
  billing_month: string
}

function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 사이클 [start, end) → "M월 D일 ~ M월 D일" (end 전날 = 25일) */
function formatCyclePeriodLabel(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const last = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1)
  return `${s.getMonth() + 1}월 ${s.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`
}

function BrandOrdersInvoiceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [ym, setYm] = useState(currentYm())
  const [lines, setLines] = useState<InvoiceLineRow[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [pointsTotal, setPointsTotal] = useState(0)
  const [pouchTier, setPouchTier] = useState<number | null>(null)
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null)
  const [payappActive, setPayappActive] = useState(false)
  const [brandName, setBrandName] = useState('시바산')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<'form' | 'success'>('form')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalStep('form')
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login?role=owner')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (!profile?.id) {
      showToast('프로필을 불러올 수 없어요')
      setLoading(false)
      return
    }

    const [y, m] = ym.split('-').map(Number)
    const billingMonth = `${y}-${String(m).padStart(2, '0')}-01`
    const { startIso, endIso } = billingCycleRange(new Date(y, m - 1, 1))

    const { data: brandRow } = await supabase
      .from('brands')
      .select('id, name, payapp_active')
      .eq('id', CIVASAN_BRAND_ID)
      .maybeSingle()

    setBrandName(String(brandRow?.name || '시바산'))
    setPayappActive(Boolean(brandRow?.payapp_active))

    const { data: orderRows } = await supabase
      .from('brand_orders')
      .select('id, created_at, items, total_amount, points_earned')
      .eq('profile_id', profile.id)
      .eq('brand_id', CIVASAN_BRAND_ID)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true })

    const orders = orderRows || []
    const expanded = expandOrderItemsToLines(orders)
    const sumAmount = orders.reduce((s, o) => s + Math.trunc(Number(o.total_amount) || 0), 0)
    const sumPoints = orders.reduce((s, o) => s + Math.trunc(Number(o.points_earned) || 0), 0)
    const tier = calcPouchTier(sumAmount)

    setLines(expanded)
    setTotalAmount(sumAmount)
    setPointsTotal(sumPoints)
    setPouchTier(tier)

    const syncRes = await fetch(SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        brand_id: CIVASAN_BRAND_ID,
        billing_month: billingMonth,
        total_amount: sumAmount,
        points_total: sumPoints,
      }),
    })
    const syncJson = await syncRes.json().catch(() => ({}))
    if (syncJson?.ok && syncJson.invoice) {
      setInvoice(syncJson.invoice as BillingInvoice)
    } else {
      const { data: existing } = await supabase
        .from('brand_billing_invoices')
        .select('id, brand_id, total_amount, points_total, pouch_tier, status, paid_at, billing_month')
        .eq('owner_id', profile.id)
        .eq('brand_id', CIVASAN_BRAND_ID)
        .eq('billing_month', billingMonth)
        .maybeSingle()
      setInvoice((existing as BillingInvoice | null) || null)
    }

    setLoading(false)
  }, [router, supabase, ym])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (searchParams.get('paid') === '1') {
      showToast('결제가 완료됐어요')
      void load()
    }
  }, [searchParams, load])

  const submitPayment = async () => {
    if (!invoice?.id) {
      showToast('청구서 정보가 없어요')
      return
    }
    if (invoice.status === 'paid') {
      showToast('이미 결제된 청구서예요')
      return
    }
    if (totalAmount <= 0) {
      showToast('이번 달 발주 내역이 없어요')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(INVOICE_PAY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ invoice_id: invoice.id }),
      })
      const json = await res.json().catch(() => ({}))

      if (json?.ok && json?.pay_url) {
        window.location.href = json.pay_url as string
        return
      }
      if (json?.ok && json?.demo) {
        setModalStep('success')
        await load()
        return
      }

      showToast(json?.error === 'already_paid' ? '이미 결제됐어요' : '결제 요청 실패')
      closeModal()
    } finally {
      setBusy(false)
    }
  }

  const pouchMsg = pouchTierLabel(pouchTier)
  const isPaid = invoice?.status === 'paid'
  const [cy, cm] = ym.split('-').map(Number)
  const cycleRange = billingCycleRange(new Date(cy, cm - 1, 1))
  const cycleLabel = formatCyclePeriodLabel(cycleRange.startIso, cycleRange.endIso)

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}

      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>월 청구서</div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <input
          type="month"
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT }}
        />
        <div style={{ fontSize: 12, color: SUB, marginTop: 8 }}>{brandName} · {cycleLabel}</div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {lines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: SUB, fontSize: 14 }}>이 청구 기간 발주 내역이 없어요</div>
        ) : (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 40px 56px 64px', gap: 6, padding: '8px 10px', background: LIGHT, fontSize: 10, color: SUB, fontWeight: 600 }}>
              <span>날짜</span><span>제품</span><span>수량</span><span>단가</span><span>소계</span>
            </div>
            {lines.map((row, i) => (
              <div key={`${row.order_id}-${i}`} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 40px 56px 64px', gap: 6, padding: '8px 10px', borderTop: `1px solid ${BORDER}`, fontSize: 11, color: TEXT }}>
                <span style={{ color: SUB }}>{row.date}</span>
                <span>{row.name}</span>
                <span>{row.qty}</span>
                <span>₩{row.unit_price.toLocaleString()}</span>
                <span>₩{row.line_amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: SUB }}>합계금액</span>
            <span style={{ fontWeight: 600, color: PURPLE }}>₩{totalAmount.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: SUB }}>적립 예정 T</span>
            <span style={{ color: '#1E6B40' }}>{pointsTotal.toLocaleString()}T</span>
          </div>
          {pouchMsg && (
            <div style={{ fontSize: 12, color: PURPLE, marginTop: 8, padding: '8px 10px', borderRadius: 8, background: `${PURPLE}10` }}>
              🎁 {pouchMsg}
            </div>
          )}
          {isPaid && (
            <div style={{ fontSize: 12, color: '#1E6B40', marginTop: 8 }}>✓ 결제 완료</div>
          )}
        </div>

        {!isPaid && totalAmount > 0 && (
          <button
            type="button"
            onClick={() => { setModalStep('form'); setModalOpen(true) }}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            {payappActive ? '결제하기' : '체험 결제하기 (데모)'}
          </button>
        )}
      </div>

      {modalOpen && (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget && modalStep === 'form' && !busy) closeModal() }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 14, padding: 20, border: `1px solid ${BORDER}` }}>
            {modalStep === 'form' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{brandName} 월청구서</div>
                  <button type="button" onClick={closeModal} disabled={busy} style={{ background: 'none', border: 'none', fontSize: 22, color: SUB, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>{cycleLabel} · {payappActive ? '실결제' : '데모 (실과금 없음)'}</div>
                <div style={{ padding: 14, borderRadius: 10, background: LIGHT, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>결제 금액</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: TEXT }}>₩{totalAmount.toLocaleString()}</div>
                </div>
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>카드번호</div>
                  <input readOnly placeholder="1234 5678 9012 3456" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>장식용 · 실제 검증 없음</div>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={closeModal} disabled={busy} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: SUB, cursor: 'pointer' }}>취소</button>
                  <button type="button" onClick={() => void submitPayment()} disabled={busy} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
                    {busy ? '처리 중…' : '결제하기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: PURPLE, marginBottom: 6 }}>결제 완료</div>
                  <div style={{ fontSize: 12, color: SUB }}>데모 모드 · 실제 과금 없음</div>
                </div>
                <button type="button" onClick={() => { closeModal(); void load() }} style={{ width: '100%', marginTop: 12, padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  확인
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <DashboardBottomNav role="owner" />
    </div>
  )
}

export default function BrandOrdersInvoicePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>불러오는 중...</div>}>
      <BrandOrdersInvoiceContent />
    </Suspense>
  )
}
