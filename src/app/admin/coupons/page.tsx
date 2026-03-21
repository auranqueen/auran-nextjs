'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { endOfDay, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import './admin-coupons-datepicker.css'
import { useAdminSettings } from '@/hooks/useAdminSettings'

registerLocale('ko', ko)

type Coupon = {
  id: string
  code: string
  name: string
  type: string
  discount_amount: number | null
  discount_rate: number | null
  min_order: number | null
  issue_trigger: string | null
  is_active: boolean
  start_at: string | null
  end_at: string | null
  max_issue_count: number | null
  issued_count: number | null
  description: string | null
  scope?: string | null
}

type Stats = Record<string, { issued: number; used: number }>

type UserHit = {
  id: string
  auth_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  skin_type: string | null
}

type BrandHit = { id: string; name: string | null; logo_url: string | null }
type ProductHit = { id: string; name: string | null; retail_price: number | null; brand_id: string | null; brands: { name: string | null } | null }

export default function AdminCouponsPage() {
  const { getSettingNum } = useAdminSettings()
  const maxPctSetting = getSettingNum('coupon', 'max_percent_discount', 70)

  const [loading, setLoading] = useState(true)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [err, setErr] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ctype, setCtype] = useState<'amount' | 'rate'>('amount')
  const [discountAmount, setDiscountAmount] = useState(5000)
  const [discountRate, setDiscountRate] = useState(10)
  const [minOrder, setMinOrder] = useState(0)
  const [issueTrigger, setIssueTrigger] = useState('manual')
  const [validFrom, setValidFrom] = useState<Date | null>(null)
  const [validTo, setValidTo] = useState<Date | null>(null)
  const [maxIssue, setMaxIssue] = useState<number | ''>('')
  const [creating, setCreating] = useState(false)

  const [birthdayDaysBefore, setBirthdayDaysBefore] = useState(7)
  const [birthdayDaysAfter, setBirthdayDaysAfter] = useState(7)

  const [scopeMode, setScopeMode] = useState<'all' | 'brand' | 'product'>('all')
  const [brandQ, setBrandQ] = useState('')
  const [brandHits, setBrandHits] = useState<BrandHit[]>([])
  const [pickedBrands, setPickedBrands] = useState<BrandHit[]>([])
  const [productQ, setProductQ] = useState('')
  const [productHits, setProductHits] = useState<ProductHit[]>([])
  const [pickedProducts, setPickedProducts] = useState<ProductHit[]>([])

  const [specificUserQ, setSpecificUserQ] = useState('')
  const [specificUserHits, setSpecificUserHits] = useState<UserHit[]>([])
  const [pickedSpecificUsers, setPickedSpecificUsers] = useState<UserHit[]>([])

  const [userQ, setUserQ] = useState('')
  const [userHits, setUserHits] = useState<UserHit[]>([])
  const [pickedUser, setPickedUser] = useState<UserHit | null>(null)
  const [issueCouponId, setIssueCouponId] = useState('')
  const [issuing, setIssuing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const res = await fetch('/api/admin/coupons', { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j?.ok) {
      setErr(j?.error || j?.reason || 'load_failed')
      setLoading(false)
      return
    }
    setCoupons(j.coupons || [])
    setStats(j.stats || {})
    setIssueCouponId((prev) => prev || (j.coupons?.[0]?.id ?? ''))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const searchUsers = async () => {
    const q = userQ.trim()
    if (!q) return
    const res = await fetch(`/api/admin/coupons?user_q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j?.ok) setUserHits(j.users || [])
  }

  const searchSpecificUsers = async () => {
    const q = specificUserQ.trim()
    if (!q) return
    const res = await fetch(`/api/admin/coupons?user_q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j?.ok) setSpecificUserHits(j.users || [])
  }

  const searchBrands = async () => {
    const q = brandQ.trim()
    if (!q) return
    const res = await fetch(`/api/admin/coupons?brand_q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j?.ok) setBrandHits(j.brands || [])
  }

  const searchProducts = async () => {
    const q = productQ.trim()
    if (!q) return
    const res = await fetch(`/api/admin/coupons?product_q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j?.ok) setProductHits(j.products || [])
  }

  const createCoupon = async () => {
    if (issueTrigger === 'specific_user') {
      const okUsers = pickedSpecificUsers.filter((u) => u.auth_id)
      if (!okUsers.length) {
        setErr('특정인 발급: auth가 연결된 회원을 한 명 이상 선택하세요')
        return
      }
    }
    if (scopeMode === 'brand' && !pickedBrands.length) {
      setErr('브랜드별 적용: 브랜드를 한 개 이상 선택하세요')
      return
    }
    if (scopeMode === 'product' && !pickedProducts.length) {
      setErr('특정 상품: 상품을 한 개 이상 선택하세요')
      return
    }
    if (ctype === 'rate' && discountRate > maxPctSetting) {
      setErr(`정률은 최대 ${maxPctSetting}%까지 설정할 수 있어요`)
      return
    }

    setCreating(true)
    setErr(null)
    const scope_user_ids =
      issueTrigger === 'specific_user'
        ? pickedSpecificUsers.map((u) => u.auth_id).filter(Boolean) as string[]
        : []

    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        name,
        description,
        discount_type: ctype === 'rate' ? 'rate' : 'amount',
        discount_value: ctype === 'rate' ? discountRate : discountAmount,
        min_order: minOrder,
        issue_trigger: issueTrigger,
        start_at: validFrom ? validFrom.toISOString() : null,
        end_at: validTo ? validTo.toISOString() : null,
        max_issue_count: maxIssue === '' ? null : maxIssue,
        is_active: true,
        scope: scopeMode,
        scope_brand_ids: pickedBrands.map((b) => b.id),
        scope_product_ids: pickedProducts.map((p) => p.id),
        scope_user_ids,
        birthday_days_before: birthdayDaysBefore,
        birthday_days_after: birthdayDaysAfter,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok || !j?.ok) {
      setErr(j?.error === 'rate_too_high' ? `정률은 최대 ${j?.max ?? maxPctSetting}%` : j?.error || 'create_failed')
      return
    }
    setName('')
    setDescription('')
    setValidFrom(null)
    setValidTo(null)
    setPickedBrands([])
    setPickedProducts([])
    setPickedSpecificUsers([])
    setBrandHits([])
    setProductHits([])
    setSpecificUserHits([])
    await load()
  }

  const issueManual = async () => {
    if (!pickedUser?.auth_id || !issueCouponId) {
      setErr('회원과 쿠폰을 선택하세요')
      return
    }
    setIssuing(true)
    setErr(null)
    setSuccessMsg(null)
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'issue',
        coupon_id: issueCouponId,
        user_auth_id: pickedUser.auth_id,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setIssuing(false)
    if (!res.ok || !j?.ok) {
      const msg =
        j?.error === 'service_role_unconfigured'
          ? (j?.message as string) || 'SUPABASE_SERVICE_ROLE_KEY가 필요합니다.'
          : j?.error === 'already_issued'
            ? '이미 해당 쿠폰이 발급된 회원입니다.'
            : j?.error === 'issue_limit_reached'
              ? '쿠폰 발행 한도에 도달했습니다.'
              : (j?.error as string) || 'issue_failed'
      setErr(msg)
      return
    }
    setSuccessMsg('쿠폰이 고객 쿠폰함에 발급되었습니다.')
    window.setTimeout(() => setSuccessMsg(null), 4500)
    await load()
  }

  const scopeSummary = useCallback((c: Coupon) => {
    const s = (c.scope || 'all').toLowerCase()
    if (s === 'brand') return '브랜드 지정'
    if (s === 'product') return '상품 지정'
    return '전체'
  }, [])

  const inputStyle = useMemo(
    () => ({
      width: '100%' as const,
      marginBottom: 8,
      padding: 10,
      borderRadius: 10,
      background: 'rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: '#fff',
    }),
    []
  )

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>쿠폰 관리</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>템플릿 생성 · 발행 통계 · 수동 발급</div>
      </div>

      {successMsg && (
        <div style={{ marginBottom: 12, background: 'rgba(76,173,126,0.12)', border: '1px solid rgba(76,173,126,0.35)', borderRadius: 12, padding: 12, color: '#9ed4b8', fontSize: 13, fontWeight: 700 }}>
          {successMsg}
        </div>
      )}
      {err && (
        <div style={{ marginBottom: 12, background: 'rgba(217,79,79,0.10)', border: '1px solid rgba(217,79,79,0.25)', borderRadius: 12, padding: 12, color: '#e08080', fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', marginBottom: 10 }}>A · 기본 정보</div>
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>쿠폰명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>설명</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', marginBottom: 10 }}>B · 할인 방식</div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={ctype === 'amount'} onChange={() => setCtype('amount')} /> 정액 (원)
          </label>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={ctype === 'rate'} onChange={() => setCtype('rate')} /> 정률 (%)
          </label>
        </div>
        {ctype === 'amount' ? (
          <>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>할인 금액</label>
            <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} style={inputStyle} />
          </>
        ) : (
          <>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>할인율 (최대 {maxPctSetting}%)</label>
            <input
              type="number"
              min={0}
              max={maxPctSetting}
              value={discountRate}
              onChange={(e) => setDiscountRate(Math.min(maxPctSetting, Math.max(0, Number(e.target.value))))}
              style={inputStyle}
            />
          </>
        )}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', marginBottom: 10 }}>C · 사용 조건</div>
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>최소 주문금액 (원)</label>
        <input type="number" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} style={inputStyle} />
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>유효 시작</label>
        <DatePicker
          selected={validFrom}
          onChange={(d: Date | null) => {
            setValidFrom(d)
            if (d && validTo && validTo < d) setValidTo(d)
          }}
          showTimeSelect
          timeIntervals={15}
          dateFormat="yyyy-MM-dd HH:mm"
          locale={ko}
          placeholderText="시작일시 선택"
          className="admin-coupon-datepicker-input"
          wrapperClassName="admin-coupon-datepicker-wrap"
          popperClassName="auran-admin-datepicker-popper"
          isClearable
        />
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'block', marginTop: 8 }}>유효 종료</label>
        <DatePicker
          selected={validTo}
          onChange={(d: Date | null) => {
            if (d && validFrom && d < validFrom) {
              setValidTo(validFrom)
              return
            }
            setValidTo(d)
          }}
          showTimeSelect
          timeIntervals={15}
          dateFormat="yyyy-MM-dd HH:mm"
          locale={ko}
          placeholderText="종료일시 선택"
          className="admin-coupon-datepicker-input"
          wrapperClassName="admin-coupon-datepicker-wrap"
          popperClassName="auran-admin-datepicker-popper"
          minDate={validFrom ?? undefined}
          minTime={
            validFrom && validTo && isSameDay(validFrom, validTo)
              ? validFrom
              : undefined
          }
          maxTime={
            validFrom && validTo && isSameDay(validFrom, validTo)
              ? endOfDay(validTo)
              : undefined
          }
          isClearable
        />
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'block', marginTop: 8 }}>발행 한도 (비우면 무제한)</label>
        <input
          type="number"
          value={maxIssue}
          onChange={(e) => setMaxIssue(e.target.value === '' ? '' : Number(e.target.value))}
          style={inputStyle}
        />
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', marginBottom: 10 }}>D · 발행 조건</div>
        <select value={issueTrigger} onChange={(e) => setIssueTrigger(e.target.value)} style={{ ...inputStyle, background: '#111' }}>
          <option value="manual">수동 (manual)</option>
          <option value="signup">회원가입 (signup)</option>
          <option value="birthday">생일자 (birthday)</option>
          <option value="event">이벤트 (event)</option>
          <option value="specific_user">특정인 지정 (specific_user)</option>
        </select>

        {issueTrigger === 'birthday' && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 12, color: '#fff', marginBottom: 8 }}>생일 옵션</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>생일</span>
              <input
                type="number"
                min={0}
                value={birthdayDaysBefore}
                onChange={(e) => setBirthdayDaysBefore(Math.max(0, Number(e.target.value)))}
                style={{ width: 56, padding: 6, borderRadius: 8, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>일 전부터 발급</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>생일</span>
              <input
                type="number"
                min={0}
                value={birthdayDaysAfter}
                onChange={(e) => setBirthdayDaysAfter(Math.max(0, Number(e.target.value)))}
                style={{ width: 56, padding: 6, borderRadius: 8, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>일 후까지 유효 (표시용 · 결제 시 유효기간은 쿠폰 종료일 기준)</span>
            </div>
          </div>
        )}

        {issueTrigger === 'specific_user' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>회원 검색 (닉네임 · 이메일 · 피부타입)</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={specificUserQ}
                onChange={(e) => setSpecificUserQ(e.target.value)}
                placeholder="🔍 이름 또는 이메일 검색..."
                style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <button type="button" onClick={searchSpecificUsers} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
                검색
              </button>
            </div>
            {specificUserHits.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  if (!u.auth_id) return
                  if (pickedSpecificUsers.some((x) => x.id === u.id)) return
                  setPickedSpecificUsers((prev) => [...prev, u])
                  setSpecificUserHits([])
                  setSpecificUserQ('')
                }}
                disabled={!u.auth_id}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.2)',
                  color: u.auth_id ? '#fff' : 'rgba(255,255,255,0.35)',
                  fontSize: 12,
                }}
              >
                {u.name || '—'} · {u.email || '—'} {u.skin_type ? `· ${u.skin_type}` : ''} {!u.auth_id && '(로그인 연동 없음)'}
              </button>
            ))}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>선택된 회원</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {pickedSpecificUsers.map((u) => (
                <span
                  key={u.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(201,168,76,0.15)',
                    border: '1px solid rgba(201,168,76,0.35)',
                    fontSize: 12,
                    color: '#e8d5a8',
                  }}
                >
                  {u.name || '—'} · {u.email || '—'}
                  <button
                    type="button"
                    onClick={() => setPickedSpecificUsers((prev) => prev.filter((x) => x.id !== u.id))}
                    style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 900 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', marginBottom: 10 }}>E · 적용 범위</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={scopeMode === 'all'} onChange={() => setScopeMode('all')} /> 전체 상품
          </label>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={scopeMode === 'brand'} onChange={() => setScopeMode('brand')} /> 브랜드별
          </label>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={scopeMode === 'product'} onChange={() => setScopeMode('product')} /> 특정 상품
          </label>
        </div>

        {scopeMode === 'brand' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={brandQ}
                onChange={(e) => setBrandQ(e.target.value)}
                placeholder="🔍 브랜드 검색..."
                style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <button type="button" onClick={searchBrands} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
                검색
              </button>
            </div>
            {brandHits.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  if (pickedBrands.some((x) => x.id === b.id)) return
                  setPickedBrands((prev) => [...prev, b])
                  setBrandHits([])
                  setBrandQ('')
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                {b.name}
              </button>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {pickedBrands.map((b) => (
                <span
                  key={b.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontSize: 12,
                    color: '#fff',
                  }}
                >
                  {b.name}
                  <button
                    type="button"
                    onClick={() => setPickedBrands((prev) => prev.filter((x) => x.id !== b.id))}
                    style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {scopeMode === 'product' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                placeholder="🔍 상품명 검색..."
                style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <button type="button" onClick={searchProducts} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
                검색
              </button>
            </div>
            {productHits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (pickedProducts.some((x) => x.id === p.id)) return
                  setPickedProducts((prev) => [...prev, p])
                  setProductHits([])
                  setProductQ('')
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.2)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                {(p.brands?.name || '브랜드') + ' · ' + (p.name || '')}
              </button>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {pickedProducts.map((p) => (
                <span
                  key={p.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontSize: 12,
                    color: '#fff',
                  }}
                >
                  {p.name}
                  <button
                    type="button"
                    onClick={() => setPickedProducts((prev) => prev.filter((x) => x.id !== p.id))}
                    style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <button
          type="button"
          disabled={creating || !name.trim()}
          onClick={createCoupon}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}
        >
          {creating ? '생성 중...' : 'F · 쿠폰 생성'}
        </button>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>수동 발급</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={userQ}
            onChange={(e) => setUserQ(e.target.value)}
            placeholder="🔍 회원 검색 (이름·이메일·전화번호)"
            style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          />
          <button type="button" onClick={searchUsers} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
            검색
          </button>
        </div>
        {userHits.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setPickedUser(u)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 10,
              marginBottom: 6,
              borderRadius: 10,
              border: pickedUser?.id === u.id ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
              color: '#fff',
              fontSize: 12,
            }}
          >
            {u.name || '—'} · {u.email || '—'} {u.phone ? `· ${u.phone}` : ''} {u.auth_id ? '' : '(auth 없음)'}
          </button>
        ))}
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>쿠폰 선택</label>
        <select value={issueCouponId} onChange={(e) => setIssueCouponId(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        <button type="button" disabled={issuing} onClick={issueManual} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: 'rgba(76,173,126,0.25)', color: '#b5e6c8', fontWeight: 900 }}>
          {issuing ? '발급 중...' : '즉시 발급'}
        </button>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>쿠폰 목록</div>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coupons.map((c) => {
              const s = stats[c.id] || { issued: 0, used: 0 }
              const left = Math.max(0, s.issued - s.used)
              return (
                <div key={c.id} style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ fontWeight: 900, color: '#fff', fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{c.code}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>적용: {scopeSummary(c)} · 발행조건: {c.issue_trigger || '—'}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>
                    발행 {s.issued}장 / 사용 {s.used}장 / 잔여 {left}장
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
