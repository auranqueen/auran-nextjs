'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  ownerProfileId: string | null
}

interface BundleItem {
  product_id: string
  name: string
  qty: number
  price: number
}

const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  margin: '0 16px 12px',
}
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'

function thisMonthDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function AreteMembershipCard({ ownerProfileId }: Props) {
  const supabase = createClient()
  const billingMonth = thisMonthDate()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<{ id: string; amount: number; status: string } | null>(null)
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([])
  const [pointBalance, setPointBalance] = useState(0)
  const [paying, setPaying] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    if (!ownerProfileId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: memberRow } = await supabase
      .from('brand_arete_members')
      .select('company_id')
      .eq('owner_id', ownerProfileId)
      .eq('status', 'active')
      .maybeSingle()
    const cid = (memberRow as { company_id?: string } | null)?.company_id || null
    setCompanyId(cid)
    if (!cid) {
      setLoading(false)
      return
    }
    const [{ data: invRow }, { data: bundleRow }, { data: pointRow }] = await Promise.all([
      supabase
        .from('brand_arete_invoices')
        .select('id, amount, status')
        .eq('company_id', cid)
        .eq('owner_id', ownerProfileId)
        .eq('billing_month', billingMonth)
        .maybeSingle(),
      supabase
        .from('brand_arete_monthly_bundles')
        .select('items')
        .eq('company_id', cid)
        .eq('billing_month', billingMonth)
        .maybeSingle(),
      supabase
        .from('brand_points')
        .select('balance')
        .eq('company_id', cid)
        .eq('owner_id', ownerProfileId)
        .eq('track', 'ARETE')
        .maybeSingle(),
    ])
    setInvoice((invRow as { id: string; amount: number; status: string } | null) || null)
    setBundleItems(((bundleRow as { items?: BundleItem[] } | null)?.items) || [])
    setPointBalance(Math.trunc(Number((pointRow as { balance?: number } | null)?.balance) || 0))
    setLoading(false)
  }, [ownerProfileId, billingMonth])

  useEffect(() => {
    void load()
  }, [load])

  const payNow = async () => {
    if (!invoice) return
    setPaying(true)
    try {
      const res = await fetch('/api/payments/brand-self/civasan/arete/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arete_invoice_id: invoice.id }),
      })
      const result = await res.json().catch(() => ({}))
      if (!result?.ok) {
        showToast('결제 실패: ' + (result?.error || '다시 시도해주세요'))
        setPaying(false)
        return
      }
      if (result.demo) {
        showToast('결제 완료!')
        setInvoice((prev) => (prev ? { ...prev, status: 'paid' } : prev))
        setPaying(false)
        return
      }
      if (result.pay_url) {
        window.location.href = result.pay_url
        return
      }
      setPaying(false)
    } catch {
      showToast('결제 중 오류가 발생했어요')
      setPaying(false)
    }
  }

  if (loading || !companyId) return null

  return (
    <div>
      {toast && (
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
            zIndex: 999,
          }}
        >
          {toast}
        </div>
      )}
      {invoice && (
        <div
          style={{
            ...CARD,
            border: `0.5px solid ${invoice.status === 'paid' ? 'rgba(76,175,80,0.3)' : 'rgba(255,193,7,0.3)'}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
            ✨ {billingMonth.slice(5, 7)}월 아레테 결제
          </div>
          <div
            style={{
              fontSize: 11,
              color: invoice.status === 'paid' ? 'rgba(76,175,80,0.8)' : 'rgba(255,193,7,0.8)',
              marginBottom: 10,
            }}
          >
            {invoice.status === 'paid' ? '✅ 결제완료' : '⏳ 미납'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' }}>
            <span style={{ color: SUB }}>결제금액</span>
            <span style={{ color: TEXT, fontWeight: 600 }}>{invoice.amount.toLocaleString()}원</span>
          </div>
          {invoice.status !== 'paid' && (
            <button
              type="button"
              onClick={payNow}
              disabled={paying}
              style={{
                width: '100%',
                marginTop: 10,
                padding: 10,
                fontSize: 13,
                borderRadius: 8,
                border: 'none',
                background: paying ? 'rgba(255,193,7,0.4)' : '#C9A96E',
                color: '#1a1520',
                fontWeight: 600,
                cursor: paying ? 'not-allowed' : 'pointer',
              }}
            >
              {paying ? '처리 중...' : '지금 결제하기'}
            </button>
          )}
          <div style={{ fontSize: 10, color: SUB, marginTop: 6, textAlign: 'center' }}>
            정액 결제만 가능해요 (포인트 사용 불가)
          </div>
        </div>
      )}
      {bundleItems.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>이번달 받으실 제품 꾸러미</div>
          {bundleItems.map((item) => (
            <div
              key={item.product_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                fontSize: 12,
                color: TEXT,
              }}
            >
              <span>{item.name}</span>
              <span style={{ color: SUB }}>{item.qty}개</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: SUB, marginTop: 8 }}>
            결제 완료 후 순차 발송돼요 — 별도 주문 필요 없어요
          </div>
        </div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>아레테 포인트</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: GOLD }}>{pointBalance.toLocaleString()}P</div>
        <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>포인트 누적잔액 · 이벤트 상품 결제시 사용 가능</div>
      </div>
    </div>
  )
}
