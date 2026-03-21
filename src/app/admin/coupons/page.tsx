'use client'

import { useCallback, useEffect, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { endOfDay, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import './admin-coupons-datepicker.css'

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
}

type Stats = Record<string, { issued: number; used: number }>

type UserHit = { id: string; auth_id: string | null; name: string | null; email: string | null; phone: string | null }

export default function AdminCouponsPage() {
  const [loading, setLoading] = useState(true)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [err, setErr] = useState<string | null>(null)

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

  const createCoupon = async () => {
    setCreating(true)
    setErr(null)
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        name,
        description,
        type: ctype,
        discount_amount: discountAmount,
        discount_rate: discountRate,
        min_order: minOrder,
        issue_trigger: issueTrigger,
        start_at: validFrom ? validFrom.toISOString() : null,
        end_at: validTo ? validTo.toISOString() : null,
        max_issue_count: maxIssue === '' ? null : maxIssue,
        is_active: true,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok || !j?.ok) {
      setErr(j?.error || 'create_failed')
      return
    }
    setName('')
    setValidFrom(null)
    setValidTo(null)
    await load()
  }

  const issueManual = async () => {
    if (!pickedUser?.auth_id || !issueCouponId) {
      setErr('회원과 쿠폰을 선택하세요')
      return
    }
    setIssuing(true)
    setErr(null)
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
      setErr(j?.error || 'issue_failed')
      return
    }
    await load()
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>쿠폰 관리</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>템플릿 생성 · 발행 통계 · 수동 발급</div>
      </div>

      {err && (
        <div style={{ marginBottom: 12, background: 'rgba(217,79,79,0.10)', border: '1px solid rgba(217,79,79,0.25)', borderRadius: 12, padding: 12, color: '#e08080', fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>쿠폰 생성</div>
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>쿠폰명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>설명</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={ctype === 'amount'} onChange={() => setCtype('amount')} /> 정액
          </label>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={ctype === 'rate'} onChange={() => setCtype('rate')} /> 정률
          </label>
        </div>
        {ctype === 'amount' ? (
          <>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>할인 금액(원)</label>
            <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
          </>
        ) : (
          <>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>할인율(%)</label>
            <input type="number" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
          </>
        )}
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>최소 주문금액</label>
        <input type="number" value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>발행 조건</label>
        <select value={issueTrigger} onChange={(e) => setIssueTrigger(e.target.value)} style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
          <option value="manual">수동</option>
          <option value="signup">회원가입</option>
          <option value="event">이벤트</option>
          <option value="birthday">생일</option>
        </select>
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
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>유효 종료</label>
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
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>발행 한도 (비우면 무제한)</label>
        <input
          type="number"
          value={maxIssue}
          onChange={(e) => setMaxIssue(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
        />
        <button type="button" disabled={creating || !name.trim()} onClick={createCoupon} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>
          {creating ? '생성 중...' : '쿠폰 생성'}
        </button>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>수동 발급</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="이메일/이름 검색" style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} />
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
            {u.name || '—'} · {u.email || '—'} {u.auth_id ? '' : '(auth 없음)'}
          </button>
        ))}
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>쿠폰</label>
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
