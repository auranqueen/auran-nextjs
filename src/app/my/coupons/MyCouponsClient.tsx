'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { isCouponExpiredForUser } from '@/lib/coupon/computeDiscount'

type Tab = 'usable' | 'used' | 'expired' | 'all'

export type CouponBoxRow = {
  id: string
  status: string
  issued_at: string | null
  used_at: string | null
  expired_at?: string | null
  coupon_id: string
  coupons: any
}

type Row = CouponBoxRow

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return '—'
  }
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function statusLabelKo(status: string): string {
  const s = String(status || '').toLowerCase()
  if (s === 'unused') return '사용 가능'
  if (s === 'used') return '사용 완료'
  if (s === 'expired') return '만료'
  return status || '—'
}

function isSpecialCoupon(c: any): boolean {
  return (c?.coupon_type || 'regular') === 'special_event'
}

function isNewRow(r: Row): boolean {
  const raw = r.issued_at
  if (!raw) return false
  const t = new Date(raw).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < 24 * 3600000
}

function canUseCouponRow(r: Row): boolean {
  const c = r.coupons
  if (!c) return false
  if (r.status === 'used' || r.status === 'expired') return false
  if (isCouponExpiredForUser({ status: r.status, expired_at: r.expired_at }, c)) return false
  return r.status === 'unused'
}

function sortRows(arr: Row[]): Row[] {
  return [...arr].sort((a, b) => {
    const ca = a.coupons
    const cb = b.coupons
    const sa = ca && isSpecialCoupon(ca) ? 1 : 0
    const sb = cb && isSpecialCoupon(cb) ? 1 : 0
    if (sa !== sb) return sb - sa
    const ta = new Date(a.issued_at || 0).getTime()
    const tb = new Date(b.issued_at || 0).getTime()
    return tb - ta
  })
}

/** KST 기준 오늘부터 만료일까지 일 수 (0=당일, 음수=만료됨) */
function kstDaysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  try {
    const end = new Date(iso)
    const fmt = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const e = fmt(end)
    const n = fmt(new Date())
    const e0 = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate())
    const n0 = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
    return Math.round((e0 - n0) / 86400000)
  } catch {
    return null
  }
}

function expiryIso(r: Row): string | null {
  return r.expired_at || r.coupons?.end_at || null
}

function ddayLabel(r: Row): string | null {
  const iso = expiryIso(r)
  const d = kstDaysUntil(iso)
  if (d === null) return null
  if (d < 0) return '만료'
  return `D-${d}`
}

function isSoonExpire(r: Row): boolean {
  if (!canUseCouponRow(r)) return false
  const iso = expiryIso(r)
  const d = kstDaysUntil(iso)
  return d !== null && d >= 0 && d <= 3
}

type MyCouponsClientProps = {
  initialRows: Row[]
  initialError: string | null
}

export function MyCouponsClient({ initialRows, initialError }: MyCouponsClientProps) {
  const supabase = createClient()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [tab, setTab] = useState<Tab>('usable')
  const [brandNames, setBrandNames] = useState<Record<string, string>>({})
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<Row | null>(null)

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    if (initialError) console.warn('[my/coupons]', initialError)
  }, [initialError])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') router.refresh()
    })
    return () => sub.subscription.unsubscribe()
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
      if (r.status === 'expired' || (c && isCouponExpiredForUser({ status: r.status, expired_at: r.expired_at }, c))) {
        expired.push(r)
        continue
      }
      usable.push(r)
    }
    return { usable, used, expired }
  }, [rows])

  const list = useMemo(() => {
    if (tab === 'all') return sortRows(rows)
    if (tab === 'usable') return sortRows(categorized.usable)
    if (tab === 'used') return sortRows(categorized.used)
    return sortRows(categorized.expired)
  }, [tab, rows, categorized])

  const tabCounts = useMemo(
    () => ({
      all: rows.length,
      usable: categorized.usable.length,
      used: categorized.used.length,
      expired: categorized.expired.length,
    }),
    [rows, categorized]
  )

  const tabs: { k: Tab; label: string }[] = [
    { k: 'usable', label: `사용가능 ${tabCounts.usable}` },
    { k: 'used', label: `사용완료 ${tabCounts.used}` },
    { k: 'expired', label: `기간만료 ${tabCounts.expired}` },
    { k: 'all', label: `전체 ${tabCounts.all}` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="쿠폰함" right={<CustomerHeaderRight />} />
      <div style={{ padding: '12px 16px 0' }}>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 14,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          {tabs.map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                flex: '0 0 auto',
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${tab === k ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                background: tab === k ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                color: tab === k ? '#c9a84c' : 'rgba(255,255,255,0.75)',
                fontWeight: 900,
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '24px 0' }}>표시할 쿠폰이 없어요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((r) => {
              const c = r.coupons
              const special = !!(c && isSpecialCoupon(c))
              const isNew = isNewRow(r)
              if (!c) {
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetail(r)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setDetail(r)
                      }
                    }}
                    style={{
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      padding: 16,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>보유 쿠폰</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                      쿠폰 정보를 불러오지 못했어요. 탭하면 상세(발급 내역)를 볼 수 있어요.
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void router.refresh()
                      }}
                      style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', fontSize: 12, fontWeight: 700 }}
                    >
                      새로고침
                    </button>
                  </div>
                )
              }
              const discLabel = discLabelFor(c)
              const urgent = isSoonExpire(r)
              const borderStyle = urgent
                ? '2px solid rgba(217,79,79,0.95)'
                : special
                  ? '2px solid rgba(212,175,106,0.95)'
                  : '1px solid rgba(201,168,76,0.25)'
              const bgStyle = special
                ? 'linear-gradient(145deg, rgba(40,36,28,0.98), rgba(18,20,24,0.98))'
                : 'linear-gradient(145deg, rgba(30,34,40,0.95), rgba(18,20,24,0.98))'

              const showUse = canUseCouponRow(r)
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetail(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetail(r)
                    }
                  }}
                  style={{
                    borderRadius: 14,
                    border: borderStyle,
                    boxShadow: special ? '0 0 0 1px rgba(212,175,106,0.15), 0 8px 24px rgba(0,0,0,0.35)' : undefined,
                    background: bgStyle,
                    padding: 16,
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(201,168,76,0.75)', fontWeight: 900 }}>AURAN</span>
                      {special && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, rgba(212,175,106,0.25), rgba(180,140,60,0.15))',
                            border: '1px solid rgba(212,175,106,0.55)',
                            color: '#f0e2b8',
                          }}
                        >
                          🎁 특별이벤트
                        </span>
                      )}
                      {isNew && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '3px 6px',
                            borderRadius: 6,
                            background: 'rgba(217,79,79,0.85)',
                            color: '#fff',
                            letterSpacing: 0.5,
                          }}
                        >
                          NEW
                        </span>
                      )}
                      {urgent && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '3px 6px',
                            borderRadius: 6,
                            background: 'rgba(217,79,79,0.35)',
                            border: '1px solid rgba(217,79,79,0.85)',
                            color: '#ffb4b4',
                            letterSpacing: 0.5,
                          }}
                        >
                          ⚡ 곧 만료
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 18 }}>{special ? '🎁' : '🍞'}</span>
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
                    {ddayLabel(r) ? (
                      <span style={{ color: urgent ? '#ff8a8a' : 'var(--gold)', fontWeight: 900, marginRight: 6 }}>{ddayLabel(r)}</span>
                    ) : null}
                    최소 {Number(c.min_order || 0).toLocaleString()}원 · 만료 {fmtDate(expiryIso(r))}
                  </div>
                  {tab === 'used' && r.used_at && (
                    <div style={{ fontSize: 11, color: 'rgba(76,173,126,0.85)', marginTop: 8 }}>사용일 {fmtDate(r.used_at)}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 10 }}>탭하여 상세 보기</div>
                  {showUse ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push('/products')
                      }}
                      style={{
                        marginTop: 12,
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg, #c9a84c, #a8863a)',
                        color: '#111',
                        fontWeight: 900,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      사용하기
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setDetail(null)}
            style={{
              position: 'absolute',
              inset: 0,
              border: 'none',
              margin: 0,
              padding: 0,
              background: 'rgba(0,0,0,0.55)',
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 0,
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'linear-gradient(180deg, #1e2328 0%, #121418 100%)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '16px 16px 28px',
              boxSizing: 'border-box',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.25)', margin: '0 auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', lineHeight: 1.35 }}>
                {detail.coupons?.name || '쿠폰 상세'}
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                style={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {detail.coupons ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {isSpecialCoupon(detail.coupons) && (
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 8px', borderRadius: 8, background: 'rgba(212,175,106,0.2)', border: '1px solid rgba(212,175,106,0.45)', color: '#f0e2b8' }}>
                      특별이벤트
                    </span>
                  )}
                  {!isSpecialCoupon(detail.coupons) && (
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
                      상시 쿠폰
                    </span>
                  )}
                  {isNewRow(detail) && (
                    <span style={{ fontSize: 10, fontWeight: 900, padding: '4px 8px', borderRadius: 8, background: 'rgba(217,79,79,0.85)', color: '#fff' }}>
                      NEW
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', marginBottom: 16 }}>{discLabelFor(detail.coupons)}</div>

                <DetailBlock title="할인 · 사용 조건">
                  <DetailLine label="최소 주문" value={`${Number(detail.coupons.min_order || 0).toLocaleString()}원 이상`} />
                  <DetailLine label="적용 범위" value={scopeHint(detail.coupons)} />
                  {detail.coupons.description ? (
                    <DetailLine label="안내" value={String(detail.coupons.description)} />
                  ) : null}
                </DetailBlock>

                <DetailBlock title="쿠폰 정보">
                  {detail.coupons.code ? <DetailLine label="쿠폰 코드" value={String(detail.coupons.code)} /> : null}
                  <DetailLine
                    label="유효 기간(템플릿)"
                    value={`${detail.coupons.start_at ? fmtDateTime(detail.coupons.start_at as string) : '—'} ~ ${detail.coupons.end_at ? fmtDateTime(detail.coupons.end_at as string) : '—'}`}
                  />
                </DetailBlock>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>쿠폰 템플릿 정보를 불러오지 못했습니다. 네트워크 후 다시 시도해 주세요.</div>
            )}

            <DetailBlock title="내 쿠폰 발급 내역">
              <DetailLine label="상태" value={statusLabelKo(detail.status)} />
              <DetailLine label="발급일시" value={fmtDateTime(detail.issued_at)} />
              {detail.expired_at ? <DetailLine label="개별 만료" value={fmtDateTime(detail.expired_at)} /> : null}
              {detail.used_at ? <DetailLine label="사용일시" value={fmtDateTime(detail.used_at)} /> : null}
            </DetailBlock>

            <button
              type="button"
              onClick={() => setDetail(null)}
              style={{
                width: '100%',
                marginTop: 8,
                padding: 14,
                borderRadius: 12,
                border: '1px solid rgba(201,168,76,0.35)',
                background: 'rgba(201,168,76,0.12)',
                color: '#c9a84c',
                fontWeight: 900,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <DashboardBottomNav role="customer" />
    </div>
  )
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(201,168,76,0.85)', marginBottom: 8, letterSpacing: 0.5 }}>{title}</div>
      <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

function DetailLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: mono ? 11 : 13,
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.45,
          fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  )
}
