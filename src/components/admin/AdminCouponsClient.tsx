'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { endOfDay, isSameDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import '@/app/admin/coupons/admin-coupons-datepicker.css'
import { useAdminSettings } from '@/hooks/useAdminSettings'
import { CUSTOMER_GRADES, getCustomerGradeLabel, TARGET_ISSUE_GRADES } from '@/lib/customerGrade'

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
  coupon_type?: string | null
  scope_brand_ids?: string[] | null
  scope_product_ids?: string[] | null
  discount_type?: string | null
  discount_value?: number | null
  created_at?: string | null
}

type Stats = Record<string, { issued: number; used: number }>

type UserHit = {
  id: string
  auth_id: string | null
  name: string | null
  email: string | null
  phone: string | null
  skin_type: string | null
  customer_grade?: string | null
}

type BrandHit = { id: string; name: string | null; logo_url: string | null }
type ProductHit = { id: string; name: string | null; retail_price: number | null; brand_id: string | null; brands: { name: string | null } | null }

type CampaignRow = {
  id: string
  coupon_id: string | null
  campaign_name: string | null
  coupon_name: string
  target_count: number
  success_count: number
  duplicate_count: number
  failed_count: number
  results: unknown
  issued_by: string | null
  issued_at: string
}

export default function AdminCouponsClient() {
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
  const [couponKind, setCouponKind] = useState<'regular' | 'special_event'>('regular')

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
  /** 수동 즉시 발급 버튼: idle | loading | done */
  const [manualIssuePhase, setManualIssuePhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [adminToast, setAdminToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [issueTab, setIssueTab] = useState<'single' | 'target' | 'all'>('single')
  const [targetSearchQ, setTargetSearchQ] = useState('')
  const [targetHits, setTargetHits] = useState<UserHit[]>([])
  const [targetAudience, setTargetAudience] = useState<UserHit[]>([])
  const [gradePick, setGradePick] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TARGET_ISSUE_GRADES.map((g) => [g.value, false]))
  )
  const [topN, setTopN] = useState(10)
  const [topNPreview, setTopNPreview] = useState<UserHit[]>([])
  const [topNLoading, setTopNLoading] = useState(false)
  const [targetCampaignName, setTargetCampaignName] = useState('3월 봄맞이 이벤트')
  const [targetIssuing, setTargetIssuing] = useState(false)
  const [targetProgress, setTargetProgress] = useState(0)

  const [allCustomerCount, setAllCustomerCount] = useState<number | null>(null)
  const [allIssuing, setAllIssuing] = useState(false)
  const [allCampaignName, setAllCampaignName] = useState('전체 회원 발급')

  const [gradeUserQ, setGradeUserQ] = useState('')
  const [gradeUserHits, setGradeUserHits] = useState<UserHit[]>([])
  const [gradePickUser, setGradePickUser] = useState<UserHit | null>(null)
  const [gradeAssign, setGradeAssign] = useState<string>('welcome')
  const [gradeSaving, setGradeSaving] = useState(false)

  const [detailPopup, setDetailPopup] = useState<{
    coupon: Coupon
    breakdown: { total: number; used: number; unused: number; expired: number }
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [campaignFrom, setCampaignFrom] = useState<Date | null>(null)
  const [campaignTo, setCampaignTo] = useState<Date | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [campaignDetail, setCampaignDetail] = useState<CampaignRow | null>(null)

  const loadCampaigns = useCallback(async () => {
    setCampaignLoading(true)
    const p = new URLSearchParams()
    if (campaignFrom) p.set('from', campaignFrom.toISOString())
    if (campaignTo) p.set('to', campaignTo.toISOString())
    const res = await fetch(`/api/admin/coupon-campaigns?${p.toString()}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    setCampaignLoading(false)
    if (res.ok && j?.ok) setCampaigns((j.campaigns || []) as CampaignRow[])
  }, [campaignFrom, campaignTo])

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
    const list = (j.coupons || []) as Coupon[]
    setCoupons(list)
    setStats(j.stats || {})
    setIssueCouponId((prev) => prev || (list[0]?.id ?? ''))
    setLoading(false)
    void loadCampaigns()
  }, [loadCampaigns])

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

  const mergeUsers = (prev: UserHit[], more: UserHit[]) => {
    const seen = new Set(prev.map((u) => u.id))
    const out = [...prev]
    for (const u of more) {
      if (!u.auth_id) continue
      if (seen.has(u.id)) continue
      seen.add(u.id)
      out.push(u)
    }
    return out
  }

  const searchTargetUsers = async () => {
    const q = targetSearchQ.trim()
    if (!q) return
    const res = await fetch(`/api/admin/coupons?user_q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j?.ok) setTargetHits(j.users || [])
  }

  const fetchTopPurchasersPreview = async () => {
    setTopNLoading(true)
    const n = Math.min(500, Math.max(1, Math.floor(topN) || 10))
    const res = await fetch(`/api/admin/coupons?top_purchasers=${n}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    setTopNLoading(false)
    if (res.ok && j?.ok) setTopNPreview((j.top_purchasers || []) as UserHit[])
    else setAdminToast({ type: 'err', text: (j?.error as string) || '상위 구매자 조회 실패' })
  }

  const addGradeMembersToTarget = async () => {
    const grades = TARGET_ISSUE_GRADES.filter((g) => gradePick[g.value]).map((g) => g.value)
    if (!grades.length) {
      setAdminToast({ type: 'err', text: '등급을 한 개 이상 선택하세요' })
      window.setTimeout(() => setAdminToast(null), 4000)
      return
    }
    const res = await fetch(`/api/admin/coupons?customer_grades=${encodeURIComponent(grades.join(','))}`, {
      credentials: 'same-origin',
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j?.ok) {
      setAdminToast({ type: 'err', text: (j?.error as string) || '등급 회원 조회 실패' })
      window.setTimeout(() => setAdminToast(null), 5000)
      return
    }
    setTargetAudience((prev) => mergeUsers(prev, (j.users || []) as UserHit[]))
  }

  const applyStatsAfterIssue = (couponId: string, successCount: number) => {
    if (successCount <= 0) return
    setStats((prev) => {
      const cur = prev[couponId] || { issued: 0, used: 0 }
      return { ...prev, [couponId]: { issued: cur.issued + successCount, used: cur.used } }
    })
    setCoupons((prev) =>
      prev.map((c) =>
        c.id === couponId ? { ...c, issued_count: (c.issued_count ?? 0) + successCount } : c
      )
    )
  }

  useEffect(() => {
    if (issueTab !== 'all') return
    void (async () => {
      const res = await fetch('/api/admin/coupons?customer_with_auth_count=1', { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j?.ok) setAllCustomerCount(typeof j.count === 'number' ? j.count : 0)
    })()
  }, [issueTab])

  const searchGradeUsers = async () => {
    const q = gradeUserQ.trim()
    if (!q) return
    const res = await fetch(`/api/admin/coupons?user_q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j?.ok) setGradeUserHits(j.users || [])
  }

  const saveCustomerGrade = async () => {
    if (!gradePickUser?.id) {
      setErr('등급을 변경할 회원을 선택하세요')
      return
    }
    setGradeSaving(true)
    setErr(null)
    setSuccessMsg(null)
    const res = await fetch('/api/admin/customer-grade', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: gradePickUser.id, customer_grade: gradeAssign }),
    })
    const j = await res.json().catch(() => ({}))
    setGradeSaving(false)
    if (!res.ok || !j?.ok) {
      const msg =
        j?.error === 'service_role_unconfigured'
          ? (j?.message as string) || 'SUPABASE_SERVICE_ROLE_KEY가 필요합니다.'
          : j?.error === 'not_customer'
            ? '고객(role=customer)만 변경할 수 있어요.'
            : (j?.error as string) || 'grade_save_failed'
      setErr(msg)
      return
    }
    setSuccessMsg('고객 등급이 저장되었습니다.')
    window.setTimeout(() => setSuccessMsg(null), 4000)
    setGradeUserHits([])
    setGradeUserQ('')
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
        coupon_type: couponKind,
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
      setErr(null)
      setAdminToast({ type: 'err', text: '회원과 쿠폰을 선택하세요' })
      window.setTimeout(() => setAdminToast(null), 4000)
      return
    }
    setManualIssuePhase('loading')
    setErr(null)
    setAdminToast(null)
    try {
      const res = await fetch('/api/admin/coupons/issue', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_id: issueCouponId,
          user_ids: [pickedUser.auth_id],
          campaign_name: '단일 발급',
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.success !== true) {
        setManualIssuePhase('idle')
        const code = j?.error as string | undefined
        const msg =
          code === 'service_role_unconfigured'
            ? 'SUPABASE_SERVICE_ROLE_KEY가 설정되어야 발급이 가능합니다.'
            : code === 'no_target_users'
              ? '대상이 없습니다.'
              : (j?.message as string) || code || '발급에 실패했습니다.'
        setAdminToast({ type: 'err', text: msg })
        window.setTimeout(() => setAdminToast(null), 6000)
        return
      }
      const summary = j.summary as { success?: number; duplicate?: number; failed?: number } | undefined
      const okN = summary?.success ?? 0
      const dupN = summary?.duplicate ?? 0
      const failN = summary?.failed ?? 0
      const couponName = coupons.find((c) => c.id === issueCouponId)?.name || '쿠폰'
      const custName = (pickedUser.name || pickedUser.email || '고객').trim()
      setManualIssuePhase('done')
      if (okN > 0) {
        setAdminToast({
          type: 'ok',
          text: `${custName}님에게 [${couponName}] 쿠폰이 발급되었습니다 🎁`,
        })
      } else if (dupN > 0) {
        setAdminToast({ type: 'err', text: '이미 발급된 쿠폰입니다.' })
      } else {
        setAdminToast({ type: 'err', text: `발급 실패 (${failN}건)` })
      }
      window.setTimeout(() => setAdminToast(null), 5500)
      window.setTimeout(() => setManualIssuePhase('idle'), 2000)
      applyStatsAfterIssue(issueCouponId, okN)
      void loadCampaigns()
    } catch {
      setManualIssuePhase('idle')
      setAdminToast({ type: 'err', text: '네트워크 오류가 발생했습니다.' })
      window.setTimeout(() => setAdminToast(null), 5000)
    }
  }

  const issueTargetBatch = async () => {
    if (!issueCouponId || !targetCampaignName.trim()) {
      setAdminToast({ type: 'err', text: '쿠폰과 캠페인명을 입력하세요' })
      window.setTimeout(() => setAdminToast(null), 4000)
      return
    }
    const ids = targetAudience.map((u) => u.auth_id).filter(Boolean) as string[]
    if (!ids.length) {
      setAdminToast({ type: 'err', text: '발급 대상 회원을 한 명 이상 선택하세요' })
      window.setTimeout(() => setAdminToast(null), 4000)
      return
    }
    const cname = coupons.find((c) => c.id === issueCouponId)?.name || '쿠폰'
    if (!window.confirm(`총 ${ids.length}명에게 [${cname}] 쿠폰을 발급하시겠습니까?`)) return
    setTargetIssuing(true)
    setTargetProgress(8)
    setAdminToast(null)
    try {
      const res = await fetch('/api/admin/coupons/issue', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_id: issueCouponId,
          user_ids: ids,
          campaign_name: targetCampaignName.trim(),
        }),
      })
      const j = await res.json().catch(() => ({}))
      setTargetProgress(100)
      setTargetIssuing(false)
      if (!res.ok || j?.success !== true) {
        setAdminToast({ type: 'err', text: (j?.error as string) || '발급 실패' })
        window.setTimeout(() => setAdminToast(null), 6000)
        return
      }
      const s = j.summary as { success: number; duplicate: number; failed: number; total: number }
      setAdminToast({
        type: 'ok',
        text: `성공 ${s.success}건 / 중복 ${s.duplicate}건 / 실패 ${s.failed}건`,
      })
      window.setTimeout(() => setAdminToast(null), 8000)
      applyStatsAfterIssue(issueCouponId, s.success)
      void loadCampaigns()
    } catch {
      setTargetIssuing(false)
      setAdminToast({ type: 'err', text: '네트워크 오류' })
      window.setTimeout(() => setAdminToast(null), 5000)
    }
  }

  const issueAllMembers = async () => {
    if (!issueCouponId || !allCampaignName.trim()) {
      setAdminToast({ type: 'err', text: '쿠폰과 캠페인명을 입력하세요' })
      return
    }
    const cname = coupons.find((c) => c.id === issueCouponId)?.name || '쿠폰'
    if (!window.confirm(`⚠️ 전체 회원(로그인 연동)에게 [${cname}] 발급을 진행합니다. 계속할까요?`)) return
    if (!window.confirm('정말로 전체 발급을 실행합니다. (되돌릴 수 없음)')) return
    setAllIssuing(true)
    setAdminToast(null)
    try {
      const res = await fetch('/api/admin/coupons/issue', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupon_id: issueCouponId,
          mode: 'all_customers',
          campaign_name: allCampaignName.trim(),
        }),
      })
      const j = await res.json().catch(() => ({}))
      setAllIssuing(false)
      if (!res.ok || j?.success !== true) {
        setAdminToast({ type: 'err', text: (j?.error as string) || '발급 실패' })
        window.setTimeout(() => setAdminToast(null), 6000)
        return
      }
      const s = j.summary as { success: number; duplicate: number; failed: number }
      setAdminToast({
        type: 'ok',
        text: `전체 발급 완료 · 성공 ${s.success} / 중복 ${s.duplicate} / 실패 ${s.failed}`,
      })
      window.setTimeout(() => setAdminToast(null), 10000)
      applyStatsAfterIssue(issueCouponId, s.success)
      void loadCampaigns()
      void (async () => {
        const r = await fetch('/api/admin/coupons?customer_with_auth_count=1', { credentials: 'same-origin' })
        const jj = await r.json().catch(() => ({}))
        if (r.ok && jj?.ok) setAllCustomerCount(jj.count ?? 0)
      })()
    } catch {
      setAllIssuing(false)
      setAdminToast({ type: 'err', text: '네트워크 오류' })
    }
  }

  const scopeSummary = useCallback((c: Coupon) => {
    const s = (c.scope || 'all').toLowerCase()
    if (s === 'brand') return '브랜드 지정'
    if (s === 'product') return '상품 지정'
    return '전체'
  }, [])

  const discSummary = useCallback((c: Coupon) => {
    const dt = (c.discount_type || (c.type === 'rate' ? 'rate' : 'amount')) as string
    const dv =
      c.discount_value != null
        ? Number(c.discount_value)
        : dt === 'rate'
          ? Number(c.discount_rate || 0)
          : Number(c.discount_amount || 0)
    return dt === 'rate' ? `${dv}% 할인` : `${dv.toLocaleString()}원 할인`
  }, [])

  const fmtAdminDate = (iso: string | null | undefined) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    } catch {
      return '—'
    }
  }

  const openCouponDetail = async (c: Coupon) => {
    setErr(null)
    setDetailLoading(true)
    setDetailPopup(null)
    const res = await fetch(`/api/admin/coupons?coupon_id=${encodeURIComponent(c.id)}`, { credentials: 'same-origin' })
    const j = await res.json().catch(() => ({}))
    setDetailLoading(false)
    if (!res.ok || !j?.ok) {
      setErr((j?.error as string) || '현황을 불러오지 못했습니다')
      return
    }
    setDetailPopup({
      coupon: j.coupon as Coupon,
      breakdown: j.breakdown as { total: number; used: number; unused: number; expired: number },
    })
  }

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
      {adminToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            maxWidth: 'min(92vw, 440px)',
            padding: '12px 16px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.45,
            boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
            border:
              adminToast.type === 'ok'
                ? '1px solid rgba(76,173,126,0.45)'
                : '1px solid rgba(217,79,79,0.4)',
            background: adminToast.type === 'ok' ? 'rgba(22,48,32,0.96)' : 'rgba(48,22,22,0.96)',
            color: adminToast.type === 'ok' ? '#c8efd8' : '#f0b0b0',
          }}
        >
          {adminToast.text}
        </div>
      )}
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
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>쿠폰 유형</div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={couponKind === 'regular'} onChange={() => setCouponKind('regular')} /> 상시 쿠폰 (regular)
          </label>
          <label style={{ fontSize: 12, color: '#fff' }}>
            <input type="radio" checked={couponKind === 'special_event'} onChange={() => setCouponKind('special_event')} /> 특별이벤트 (special_event)
          </label>
        </div>
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
        <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 4 }}>쿠폰 발급</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>Supabase auth 연동 고객(user_id) 기준 · 알림은 public.users.id 로 전송</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['single', 'target', 'all'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setIssueTab(t)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: issueTab === t ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.12)',
                background: issueTab === t ? 'rgba(201,168,76,0.15)' : 'rgba(0,0,0,0.2)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t === 'single' ? '단일 발급' : t === 'target' ? '타겟 발급' : '전체 발급'}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>쿠폰 선택</label>
        <select
          value={issueCouponId}
          onChange={(e) => setIssueCouponId(e.target.value)}
          style={{ width: '100%', marginBottom: 14, padding: 10, borderRadius: 10, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
        >
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>

        {issueTab === 'single' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#c9a84c', marginBottom: 8 }}>회원 검색 → 1명 선택 → 즉시 발급</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
                placeholder="🔍 이름 · 이메일 · 전화"
                style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <button type="button" onClick={() => void searchUsers()} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
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
                {u.name || '—'} · {u.email || '—'} · 등급 {getCustomerGradeLabel(u.customer_grade)} {u.auth_id ? '' : '(auth 없음)'}
              </button>
            ))}
            <button
              type="button"
              disabled={manualIssuePhase === 'loading'}
              onClick={() => void issueManual()}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 12,
                border: 'none',
                background: manualIssuePhase === 'done' ? 'rgba(76,173,126,0.42)' : 'rgba(76,173,126,0.25)',
                color: manualIssuePhase === 'done' ? '#d8f5e4' : '#b5e6c8',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: manualIssuePhase === 'loading' ? 'wait' : 'pointer',
              }}
            >
              {manualIssuePhase === 'loading' && <span className="auran-admin-issue-spinner" aria-hidden />}
              {manualIssuePhase === 'loading' ? '발급 중...' : manualIssuePhase === 'done' ? '✅ 발급완료' : '즉시 발급'}
            </button>
          </>
        )}

        {issueTab === 'target' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#c9a84c', marginBottom: 8 }}>① 회원 직접 검색 (체크 후 대상에 추가)</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={targetSearchQ}
                onChange={(e) => setTargetSearchQ(e.target.value)}
                placeholder="이름 · 이메일 · 전화"
                style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <button type="button" onClick={() => void searchTargetUsers()} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
                검색
              </button>
            </div>
            {targetHits.map((u) => (
              <label
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 8,
                  marginBottom: 4,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.15)',
                  fontSize: 12,
                  color: '#fff',
                  cursor: u.auth_id ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  disabled={!u.auth_id}
                  checked={targetAudience.some((x) => x.id === u.id)}
                  onChange={(e) => {
                    if (!u.auth_id) return
                    if (e.target.checked) setTargetAudience((prev) => mergeUsers(prev, [u]))
                    else setTargetAudience((prev) => prev.filter((x) => x.id !== u.id))
                  }}
                />
                <span>
                  {u.name || '—'} · {u.email || '—'} · {getCustomerGradeLabel(u.customer_grade)}
                </span>
              </label>
            ))}

            <div style={{ fontSize: 12, fontWeight: 800, color: '#c9a84c', margin: '14px 0 8px' }}>② 등급별 (체크 후 「등급 회원 추가」)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {TARGET_ISSUE_GRADES.map((g) => (
                <label key={g.value} style={{ fontSize: 12, color: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={!!gradePick[g.value]}
                    onChange={(e) => setGradePick((prev) => ({ ...prev, [g.value]: e.target.checked }))}
                  />{' '}
                  {g.label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void addGradeMembersToTarget()}
              style={{ width: '100%', padding: 10, marginBottom: 14, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.1)', color: '#e8d5a8', fontWeight: 800 }}
            >
              등급 회원 추가
            </button>

            <div style={{ fontSize: 12, fontWeight: 800, color: '#c9a84c', marginBottom: 8 }}>③ 구매 상위 N명</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <input
                type="number"
                min={1}
                max={500}
                value={topN}
                onChange={(e) => setTopN(Math.max(1, Math.min(500, Number(e.target.value) || 10)))}
                style={{ width: 80, padding: 8, borderRadius: 8, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
              />
              <button type="button" disabled={topNLoading} onClick={() => void fetchTopPurchasersPreview()} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
                {topNLoading ? '조회…' : '조회'}
              </button>
              <button
                type="button"
                onClick={() => setTargetAudience((prev) => mergeUsers(prev, topNPreview))}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(76,173,126,0.35)', background: 'rgba(76,173,126,0.12)', color: '#b5e6c8', fontWeight: 800 }}
              >
                미리보기 전체를 대상에 합치기
              </button>
            </div>
            {topNPreview.length > 0 && (
              <div style={{ maxHeight: 140, overflowY: 'auto', marginBottom: 12, padding: 8, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                {topNPreview.map((u) => (
                  <div key={u.id}>
                    {(u as UserHit & { total_spend?: number }).total_spend != null
                      ? `${(u as UserHit & { total_spend?: number }).total_spend!.toLocaleString()}원 · `
                      : ''}
                    {u.name} · {u.email}
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>캠페인명</div>
            <input
              value={targetCampaignName}
              onChange={(e) => setTargetCampaignName(e.target.value)}
              placeholder="예: 3월 봄맞이 이벤트"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <div style={{ fontSize: 12, color: '#9ed4b8', marginBottom: 8 }}>총 {targetAudience.length}명 선택됨</div>
            <div style={{ maxHeight: 160, overflowY: 'auto', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {targetAudience.map((u) => (
                  <span
                    key={u.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(201,168,76,0.12)',
                      border: '1px solid rgba(201,168,76,0.3)',
                      fontSize: 11,
                      color: '#e8d5a8',
                    }}
                  >
                    {u.name || u.email}
                    <button type="button" onClick={() => setTargetAudience((p) => p.filter((x) => x.id !== u.id))} style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 900 }}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            {targetIssuing && (
              <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${targetProgress}%`, background: 'linear-gradient(90deg, #4cad7e, #c9a84c)', transition: 'width 0.3s' }} />
              </div>
            )}
            <button
              type="button"
              disabled={targetIssuing}
              onClick={() => void issueTargetBatch()}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, rgba(76,173,126,0.35), rgba(76,173,126,0.15))', color: '#d8f5e4', fontWeight: 900 }}
            >
              {targetIssuing ? '발급 처리 중…' : `${targetAudience.length || '—'}명에게 발급하기`}
            </button>
          </>
        )}

        {issueTab === 'all' && (
          <>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 10, lineHeight: 1.5 }}>
              role=customer 이고 Supabase auth 가 연결된 <strong style={{ color: '#fff' }}>전체 회원</strong>에게 발급합니다.
              <br />
              {allCustomerCount != null ? `현재 약 ${allCustomerCount.toLocaleString()}명` : '인원 수 불러오는 중…'}
            </div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>캠페인명</label>
            <input value={allCampaignName} onChange={(e) => setAllCampaignName(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
            <button
              type="button"
              disabled={allIssuing || !issueCouponId}
              onClick={() => void issueAllMembers()}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(217,79,79,0.45)', background: 'rgba(217,79,79,0.12)', color: '#f0a0a0', fontWeight: 900 }}
            >
              {allIssuing ? '전체 발급 실행 중…' : '전체 회원에게 발급 (이중 확인)'}
            </button>
          </>
        )}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>발급 캠페인 이력</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <DatePicker
            selected={campaignFrom}
            onChange={(d: Date | null) => setCampaignFrom(d)}
            locale={ko}
            placeholderText="시작"
            className="admin-coupon-datepicker-input"
            wrapperClassName="admin-coupon-datepicker-wrap"
            popperClassName="auran-admin-datepicker-popper"
            isClearable
            showTimeSelect
            dateFormat="yyyy-MM-dd HH:mm"
          />
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>~</span>
          <DatePicker
            selected={campaignTo}
            onChange={(d: Date | null) => setCampaignTo(d)}
            locale={ko}
            placeholderText="종료"
            className="admin-coupon-datepicker-input"
            wrapperClassName="admin-coupon-datepicker-wrap"
            popperClassName="auran-admin-datepicker-popper"
            isClearable
            showTimeSelect
            dateFormat="yyyy-MM-dd HH:mm"
          />
          <button type="button" onClick={() => void loadCampaigns()} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 800 }}>
            {campaignLoading ? '…' : '조회'}
          </button>
        </div>
        {campaigns.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>이력이 없습니다. (마이그레이션 033 적용 후 저장됩니다)</div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.55)', textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>캠페인</th>
                  <th style={{ padding: 8 }}>쿠폰</th>
                  <th style={{ padding: 8 }}>대상</th>
                  <th style={{ padding: 8 }}>성공</th>
                  <th style={{ padding: 8 }}>중복</th>
                  <th style={{ padding: 8 }}>실패</th>
                  <th style={{ padding: 8 }}>일시</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setCampaignDetail(row)}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: 8, color: '#fff', maxWidth: 120 }}>{row.campaign_name || '—'}</td>
                    <td style={{ padding: 8, color: 'rgba(255,255,255,0.85)' }}>{row.coupon_name}</td>
                    <td style={{ padding: 8 }}>{row.target_count}</td>
                    <td style={{ padding: 8, color: '#4cad7e' }}>{row.success_count}</td>
                    <td style={{ padding: 8 }}>{row.duplicate_count}</td>
                    <td style={{ padding: 8, color: '#e08080' }}>{row.failed_count}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.55)' }}>{fmtAdminDate(row.issued_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', marginBottom: 6 }}>고객 등급 변경</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.45 }}>
          멤버십 등급 (users.customer_grade) — 타겟 발급의 등급 필터와 동일합니다.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={gradeUserQ}
            onChange={(e) => setGradeUserQ(e.target.value)}
            placeholder="이름 · 이메일 · 전화로 검색"
            style={{ flex: 1, padding: 10, borderRadius: 10, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          />
          <button type="button" onClick={searchGradeUsers} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800 }}>
            검색
          </button>
        </div>
        {gradeUserHits.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => {
              setGradePickUser(u)
              setGradeAssign(u.customer_grade && CUSTOMER_GRADES.some((g) => g.value === u.customer_grade) ? (u.customer_grade as string) : 'welcome')
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 10,
              marginBottom: 6,
              borderRadius: 10,
              border: gradePickUser?.id === u.id ? '1px solid rgba(201,168,76,0.5)' : '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
              color: '#fff',
              fontSize: 12,
            }}
          >
            {u.name || '—'} · {u.email || '—'} · 등급 {getCustomerGradeLabel(u.customer_grade)}
          </button>
        ))}
        {gradePickUser && (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>선택: {gradePickUser.name || gradePickUser.email}</div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>변경할 등급</label>
            <select
              value={gradeAssign}
              onChange={(e) => setGradeAssign(e.target.value)}
              style={{ width: '100%', marginTop: 6, marginBottom: 10, padding: 10, borderRadius: 10, background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
            >
              {CUSTOMER_GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={gradeSaving}
              onClick={saveCustomerGrade}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'rgba(201,168,76,0.25)', color: '#f0e6c8', fontWeight: 900 }}
            >
              {gradeSaving ? '저장 중...' : '등급 저장'}
            </button>
          </div>
        )}
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
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 900, color: '#fff', fontSize: 13 }}>{c.name}</div>
                      {(c.coupon_type || 'regular') === 'special_event' && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(201,168,76,0.2)', color: '#e8d5a8', border: '1px solid rgba(201,168,76,0.35)' }}>
                          특별이벤트
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{c.code}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>적용: {scopeSummary(c)} · 발행조건: {c.issue_trigger || '—'}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>
                      발행 {s.issued}장 / 사용 {s.used}장 / 잔여 {left}장
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openCouponDetail(c)}
                    style={{
                      flexShrink: 0,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid rgba(201,168,76,0.45)',
                      background: 'rgba(201,168,76,0.12)',
                      color: '#e8d5a8',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      alignSelf: 'center',
                    }}
                  >
                    현황
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {(detailLoading || detailPopup) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => {
              setDetailPopup(null)
              setDetailLoading(false)
            }}
            style={{
              position: 'absolute',
              inset: 0,
              border: 'none',
              margin: 0,
              background: 'rgba(0,0,0,0.6)',
              cursor: 'pointer',
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#1a1a1a',
              padding: 18,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>쿠폰 현황</div>
              <button
                type="button"
                onClick={() => {
                  setDetailPopup(null)
                  setDetailLoading(false)
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {detailLoading ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', padding: '20px 0' }}>불러오는 중...</div>
            ) : detailPopup ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{detailPopup.coupon.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>{detailPopup.coupon.code}</div>

                <div style={{ borderRadius: 12, border: '1px solid rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.08)', padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#c9a84c', marginBottom: 10 }}>발급 · 사용 집계</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                    <div>총 발급(보유 건수)</div>
                    <div style={{ textAlign: 'right', fontWeight: 800 }}>{detailPopup.breakdown.total.toLocaleString()}건</div>
                    <div>사용 완료</div>
                    <div style={{ textAlign: 'right', fontWeight: 800, color: '#4cad7e' }}>{detailPopup.breakdown.used.toLocaleString()}건</div>
                    <div>미사용</div>
                    <div style={{ textAlign: 'right', fontWeight: 800 }}>{detailPopup.breakdown.unused.toLocaleString()}건</div>
                    <div>만료</div>
                    <div style={{ textAlign: 'right', fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>{detailPopup.breakdown.expired.toLocaleString()}건</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>세부 정보</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.88)' }}>
                  <AdminDetailRow label="할인" value={discSummary(detailPopup.coupon)} />
                  <AdminDetailRow label="최소 주문" value={`${Number(detailPopup.coupon.min_order || 0).toLocaleString()}원`} />
                  <AdminDetailRow
                    label="유형"
                    value={(detailPopup.coupon.coupon_type || 'regular') === 'special_event' ? '특별이벤트' : '상시'}
                  />
                  <AdminDetailRow label="적용 범위" value={scopeSummary(detailPopup.coupon)} />
                  {(detailPopup.coupon.scope || 'all').toLowerCase() === 'brand' && (
                    <AdminDetailRow label="브랜드 ID 수" value={`${(detailPopup.coupon.scope_brand_ids || []).length}개`} />
                  )}
                  {(detailPopup.coupon.scope || 'all').toLowerCase() === 'product' && (
                    <AdminDetailRow label="상품 ID 수" value={`${(detailPopup.coupon.scope_product_ids || []).length}개`} />
                  )}
                  <AdminDetailRow label="발행 조건" value={detailPopup.coupon.issue_trigger || '—'} />
                  <AdminDetailRow
                    label="발행 한도(템플릿)"
                    value={detailPopup.coupon.max_issue_count == null ? '무제한' : `${detailPopup.coupon.max_issue_count.toLocaleString()}장`}
                  />
                  <AdminDetailRow label="발행 누적(카운터)" value={`${(detailPopup.coupon.issued_count ?? 0).toLocaleString()}장`} />
                  <AdminDetailRow label="활성" value={detailPopup.coupon.is_active ? '예' : '아니오'} />
                  <AdminDetailRow label="유효 시작" value={fmtAdminDate(detailPopup.coupon.start_at)} />
                  <AdminDetailRow label="유효 종료" value={fmtAdminDate(detailPopup.coupon.end_at)} />
                  <AdminDetailRow label="등록일" value={fmtAdminDate(detailPopup.coupon.created_at)} />
                  {detailPopup.coupon.description ? (
                    <div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>설명</div>
                      <div style={{ lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}>{detailPopup.coupon.description}</div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailPopup(null)
                    setDetailLoading(false)
                  }}
                  style={{
                    width: '100%',
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {campaignDetail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setCampaignDetail(null)}
            style={{ position: 'absolute', inset: 0, border: 'none', margin: 0, background: 'rgba(0,0,0,0.65)', cursor: 'pointer' }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 460,
              maxHeight: '85vh',
              overflowY: 'auto',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#1a1a1a',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>캠페인 상세</div>
              <button
                type="button"
                onClick={() => setCampaignDetail(null)}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 10 }}>
              {campaignDetail.campaign_name} · {campaignDetail.coupon_name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
              성공 {campaignDetail.success_count} / 중복 {campaignDetail.duplicate_count} / 실패 {campaignDetail.failed_count} · {fmtAdminDate(campaignDetail.issued_at)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#c9a84c', marginBottom: 8 }}>회원별 결과 (auth user_id)</div>
            <div style={{ maxHeight: 360, overflowY: 'auto', fontSize: 11 }}>
              {Array.isArray(campaignDetail.results) ? (
                (campaignDetail.results as { user_id?: string; status?: string; message?: string }[]).map((r, i) => (
                  <div
                    key={`${r.user_id}-${i}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>{r.user_id}</span>
                    <span style={{ color: r.status === 'success' ? '#4cad7e' : r.status === 'already_issued' ? '#e8d5a8' : '#e08080' }}>{r.status}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.45)' }}>결과 없음</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCampaignDetail(null)}
              style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontWeight: 800 }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>{label}</span>
      <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}
