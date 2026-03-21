'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { isCouponExpiredForUser } from '@/lib/coupon/computeDiscount'
import { fetchUserCouponsWithCoupons } from '@/lib/coupon/fetchUserCouponsWithCoupons'

type Tab = 'usable' | 'used' | 'expired'

type Row = {
  id: string
  status: string
  issued_at: string | null
  used_at: string | null
  coupon_id: string
  coupons: any
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return '—'
  }
}

export default function MyCouponsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<Tab>('usable')
  const [brandNames, setBrandNames] = useState<Record<string, string>>({})
  const [productNames, setProductNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace('/login?redirect=/my/coupons')
        return
      }
      const { rows, error } = await fetchUserCouponsWithCoupons(supabase, auth.user.id)
      if (error) console.warn('[my/coupons]', error.message)
      setRows(rows as Row[])
      setLoading(false)
    }
    run()
  }, [supabase, router])

  useEffect(() => {
    const bids = new Set<string>()
    const pids = new Set<string>()
    for (const r of rows) {
      const c = r.coupons
      if (!c) continue
      const sc = String(c.scope || 'all').toLowerCase()
      if (sc === 'brand' && Array.isArray(c.scope_brand_ids)) {
        for (const id of c.scope_brand_ids as string[]) bids.add(id)
      }
      if (sc === 'product' && Array.isArray(c.scope_product_ids)) {
        for (const id of c.scope_product_ids as string[]) pids.add(id)
      }
    }
    ;(async () => {
      if (bids.size) {
        const { data } = await supabase.from('brands').select('id,name').in('id', Array.from(bids))
        const m: Record<string, string> = {}
        for (const b of data || []) m[b.id] = (b as { name?: string }).name || ''
        setBrandNames((prev) => ({ ...prev, ...m }))
      }
      if (pids.size) {
        const { data } = await supabase.from('products').select('id,name').in('id', Array.from(pids))
        const m: Record<string, string> = {}
        for (const p of data || []) m[p.id] = (p as { name?: string }).name || ''
        setProductNames((prev) => ({ ...prev, ...m }))
      }
    })()
  }, [rows, supabase])

  const scopeHint = (c: any) => {
    const sc = String(c.scope || 'all').toLowerCase()
    if (sc === 'brand') {
      const ids = (c.scope_brand_ids || []) as string[]
      const names = ids.map((id) => brandNames[id]).filter(Boolean)
      if (names.length) return `✓ ${names.join(' · ')} 전용`
      return '✓ 브랜드 지정 상품'
    }
    if (sc === 'product') {
      const ids = (c.scope_product_ids || []) as string[]
      const names = ids.map((id) => productNames[id]).filter(Boolean)
      if (names.length === 1) return `✓ ${names[0]} 전용`
      if (names.length > 1) return `✓ ${names[0]} 외 ${names.length - 1}종 전용`
      return '✓ 지정 상품 한정'
    }
    return '✓ 전체 상품 적용'
  }

  const discLabelFor = (c: any) => {
    const dt = (c.discount_type || (c.type === 'rate' ? 'rate' : 'amount')) as string
    const dv =
      c.discount_value != null
        ? Number(c.discount_value)
        : dt === 'rate'
          ? Number(c.discount_rate || 0)
          : Number(c.discount_amount || 0)
    return dt === 'rate' ? `${dv}% 할인` : `${dv.toLocaleString()}원 할인`
  }

  const categorized = useMemo(() => {
    const usable: Row[] = []
    const used: Row[] = []
    const expired: Row[] = []
    for (const r of rows) {
      const c = r.coupons
      if (r.status === 'used') {
        used.push(r)
        continue
      }
      if (r.status === 'expired' || (c && isCouponExpiredForUser({ status: r.status }, c))) {
        expired.push(r)
        continue
      }
      usable.push(r)
    }
    return { usable, used, expired }
  }, [rows])

  const list = tab === 'usable' ? categorized.usable : tab === 'used' ? categorized.used : categorized.expired

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="쿠폰함" right={<CustomerHeaderRight />} />
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(
            [
              ['usable', `사용 가능 ${categorized.usable.length}`],
              ['used', '사용 완료'],
              ['expired', '기간 만료'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 12,
                border: `1px solid ${tab === k ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                background: tab === k ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                color: tab === k ? '#c9a84c' : 'rgba(255,255,255,0.75)',
                fontWeight: 900,
                fontSize: 11,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : list.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '24px 0' }}>표시할 쿠폰이 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((r) => {
              const c = r.coupons
              if (!c) {
                return (
                  <div
                    key={r.id}
                    style={{
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>보유 쿠폰</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                      쿠폰 정보를 불러오지 못했어요. 아래를 눌러 다시 시도해 주세요.
                    </div>
                    <button
                      type="button"
                      onClick={() => router.refresh()}
                      style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', fontSize: 12, fontWeight: 700 }}
                    >
                      새로고침
                    </button>
                  </div>
                )
              }
              const discLabel = discLabelFor(c)
              return (
                <div
                  key={r.id}
                  style={{
                    borderRadius: 14,
                    border: '1px solid rgba(201,168,76,0.25)',
                    background: 'linear-gradient(145deg, rgba(30,34,40,0.95), rgba(18,20,24,0.98))',
                    padding: 16,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(201,168,76,0.75)', fontWeight: 900 }}>AURAN</span>
                    <span style={{ fontSize: 18 }}>🍞</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{c.name}</div>
                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '10px 0', opacity: 0.8 }} />
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold)', marginBottom: 8 }}>{discLabel}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.5,
                      paddingBottom: 8,
                      borderBottom: '1px dashed rgba(255,255,255,0.12)',
                      marginBottom: 8,
                    }}
                  >
                    {scopeHint(c)}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                    {c.description || `${Number(c.min_order || 0).toLocaleString()}원 이상 구매시`}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
                    {Number(c.min_order || 0).toLocaleString()}원 이상 구매시 · ~{fmtDate(c.end_at)}까지
                  </div>
                  {tab === 'used' && r.used_at && (
                    <div style={{ fontSize: 11, color: 'rgba(76,173,126,0.85)', marginTop: 8 }}>사용일 {fmtDate(r.used_at)}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
