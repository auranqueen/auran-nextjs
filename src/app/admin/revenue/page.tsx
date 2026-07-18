'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CustomerCampaignPanel from './_components/CustomerCampaignPanel'
import AdminBrandProductFeeCard from '@/components/admin/AdminBrandProductFeeCard'

type TabKey = '매출현황' | '제품분석' | '고객분석' | '유입경로' | '쿠폰/토스트'

export default function AdminRevenuePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('매출현황')
  const [period, setPeriod] = useState<'오늘' | '이번주' | '이번달' | '올해' | '날짜지정'>('이번달')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [userCoupons, setUserCoupons] = useState<any[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [productSearchDraft, setProductSearchDraft] = useState('')
  const [dateFromDraft, setDateFromDraft] = useState('')
  const [dateToDraft, setDateToDraft] = useState('')
  const [dateFocusFrom, setDateFocusFrom] = useState(false)
  const [dateFocusTo, setDateFocusTo] = useState(false)
  const [churnOpen, setChurnOpen] = useState(false)
  const [customerFilterDraft, setCustomerFilterDraft] = useState('amount_top')
  const [customerFilter, setCustomerFilter] = useState('amount_top')
  const [customerPanelId, setCustomerPanelId] = useState<string | null>(null)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [showCampaignPanel, setShowCampaignPanel] = useState(false)

  useEffect(() => {
    const t = new Date()
    const first = new Date(t.getFullYear(), t.getMonth(), 1)
    const f = first.toISOString().slice(0, 10)
    const e = t.toISOString().slice(0, 10)
    setFromDate(f)
    setToDate(e)
    setDateFromDraft(f)
    setDateToDraft(e)
  }, [])

  useEffect(() => {
    const run = async () => {
      if (!fromDate || !toDate) return
      setLoading(true)
      let data: any[] | null = null
      let r1 = await supabase
        .from('orders')
        .select('id, order_no, customer_id, status, total_amount, point_used, charge_used, coupon_discount, final_amount, earn_points, items, partner_id, owner_id, partner_commission, owner_commission, ordered_at, shipped_at, delivered_at, profiles(grade, email, username, full_name)')
        .eq('payment_applied', true)
        .gte('ordered_at', `${fromDate}T00:00:00`)
        .lte('ordered_at', `${toDate}T23:59:59.999`)
        .not('status', 'in', '("취소","환불")')
      if (r1.error) {
        const r2 = await supabase
          .from('orders')
          .select('id, order_no, customer_id, status, total_amount, point_used, charge_used, coupon_discount, final_amount, earn_points, items, partner_id, owner_id, ordered_at, shipped_at, delivered_at')
          .eq('payment_applied', true)
          .gte('ordered_at', `${fromDate}T00:00:00`)
          .lte('ordered_at', `${toDate}T23:59:59.999`)
          .not('status', 'in', '("취소","환불")')
        data = r2.data || []
      } else {
        data = r1.data || []
      }
      const uc = await supabase.from('user_coupons').select('id, user_id, coupon_id, issued_at, used_at, expired_at')
      setOrders(data || [])
      setUserCoupons(uc.data || [])
      setLoading(false)
    }
    void run()
  }, [fromDate, toDate])

  const stats = useMemo(() => {
    let n = 0
    let sumTotal = 0
    let sumCoupon = 0
    let sumToast = 0
    let sumFinal = 0
    let chargeCnt = 0
    let chargeAmt = 0
    let toastCnt = 0
    let toastAmt = 0
    let normalCnt = 0
    let normalAmt = 0
    for (const o of orders) {
      n++
      const ta = Number(o.total_amount ?? 0) || 0
      const cd = Number(o.coupon_discount ?? 0) || 0
      const pt = Number(o.point_used ?? 0) || 0
      const fa = Number(o.final_amount ?? 0) || 0
      const ch = Number(o.charge_used ?? 0) || 0
      sumTotal += ta
      sumCoupon += cd
      sumToast += pt
      sumFinal += fa
      if (ch > 0) {
        chargeCnt++
        chargeAmt += ch
      }
      if (pt > 0) {
        toastCnt++
        toastAmt += pt
      }
      if (ch <= 0 && pt <= 0) {
        normalCnt++
        normalAmt += fa
      }
    }
    return { n, sumTotal, sumCoupon, sumToast, sumFinal, chargeCnt, chargeAmt, toastCnt, toastAmt, normalCnt, normalAmt }
  }, [orders])

  const weekday = useMemo(() => {
    const names = ['월', '화', '수', '목', '금', '토', '일']
    const out = [
      { name: '월', v: 0 },
      { name: '화', v: 0 },
      { name: '수', v: 0 },
      { name: '목', v: 0 },
      { name: '금', v: 0 },
      { name: '토', v: 0 },
      { name: '일', v: 0 },
    ]
    for (const o of orders) {
      if (!o.ordered_at) continue
      const d = new Date(o.ordered_at).getDay()
      const idx = d === 0 ? 6 : d - 1
      out[idx].v += Number(o.final_amount ?? 0) || 0
    }
    const max = Math.max(1, ...out.map((x) => x.v))
    return out.map((x) => ({ ...x, max, isTop: x.v === Math.max(...out.map((y) => y.v)) && x.v > 0, label: names.find((n) => n === x.name) || x.name }))
  }, [orders])

  const timeDist = useMemo(() => {
    const a = { key: '오전(6-12)', n: 0 }
    const b = { key: '오후(12-18)', n: 0 }
    const c = { key: '저녁(18-24)', n: 0 }
    const d = { key: '새벽(0-6)', n: 0 }
    for (const o of orders) {
      if (!o.ordered_at) continue
      const h = new Date(o.ordered_at).getHours()
      if (h >= 6 && h < 12) a.n++
      else if (h >= 12 && h < 18) b.n++
      else if (h >= 18 && h < 24) c.n++
      else d.n++
    }
    const total = Math.max(1, orders.length)
    return [a, b, c, d].map((x) => ({ ...x, p: (x.n / total) * 100 }))
  }, [orders])

  const productMap = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; rev: number; cnt: number; total: number; coupon: number; toast: number; final: number }>()
    for (const o of orders) {
      const arr = Array.isArray(o.items) ? o.items : []
      if (!arr.length) continue
      let gross = 0
      for (const it of arr) {
        const p = Number(it?.price ?? 0) || 0
        const q = Number(it?.quantity ?? 1) || 1
        gross += p * q
      }
      for (const it of arr) {
        const name = String(it?.name ?? '-').trim() || '-'
        const p = Number(it?.price ?? 0) || 0
        const q = Number(it?.quantity ?? 1) || 1
        const line = p * q
        const ratio = gross > 0 ? line / gross : 0
        const prev = map.get(name) || { name, qty: 0, rev: 0, cnt: 0, total: 0, coupon: 0, toast: 0, final: 0 }
        prev.qty += q
        prev.rev += line
        prev.cnt += 1
        prev.total += Number(o.total_amount ?? 0) * ratio || 0
        prev.coupon += Number(o.coupon_discount ?? 0) * ratio || 0
        prev.toast += Number(o.point_used ?? 0) * ratio || 0
        prev.final += Number(o.final_amount ?? 0) * ratio || 0
        map.set(name, prev)
      }
    }
    return map
  }, [orders])

  const productList = useMemo(() => Array.from(productMap.values()).sort((a, b) => b.rev - a.rev), [productMap])

  const productSearchStats = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return { qty: 0, total: 0, coupon: 0, toast: 0, final: 0, has: false }
    let qty = 0
    let total = 0
    let coupon = 0
    let toast = 0
    let final = 0
    for (const p of productList) {
      if (!String(p.name).toLowerCase().includes(q)) continue
      qty += p.qty
      total += p.total
      coupon += p.coupon
      toast += p.toast
      final += p.final
    }
    return { qty, total, coupon, toast, final, has: true }
  }, [productQuery, productList])

  const customer = useMemo(() => {
    const by = new Map<string, Date[]>()
    for (const o of orders) {
      const cid = String(o.customer_id ?? '').trim()
      if (!cid || !o.ordered_at) continue
      const d = new Date(o.ordered_at)
      const prev = by.get(cid) || []
      prev.push(d)
      by.set(cid, prev)
    }
    let one = 0
    let two = 0
    let three = 0
    let intervalTotal = 0
    let intervalCnt = 0
    const churnList: string[] = []
    const now = Date.now()
    for (const [cid, ds] of Array.from(by.entries())) {
      ds.sort((a, b) => a.getTime() - b.getTime())
      if (ds.length === 1) one++
      else if (ds.length === 2) two++
      else three++
      if (ds.length >= 2) {
        for (let i = 1; i < ds.length; i++) {
          intervalTotal += (ds[i].getTime() - ds[i - 1].getTime()) / (1000 * 60 * 60 * 24)
          intervalCnt++
        }
      }
      const last = ds[ds.length - 1]?.getTime() || 0
      if (now - last >= 90 * 24 * 60 * 60 * 1000) churnList.push(cid)
    }
    const all = Math.max(1, one + two + three)
    return {
      one,
      two,
      three,
      oneP: (one / all) * 100,
      twoP: (two / all) * 100,
      threeP: (three / all) * 100,
      avgGap: intervalCnt > 0 ? intervalTotal / intervalCnt : 0,
      churnList,
    }
  }, [orders])

  const customerSearchResult = useMemo(() => {
    type Row = {
      id: string
      display: string
      grade: string
      n: number
      totalAmt: number
      coupon: number
      toast: number
      final: number
      lastAt: number
      firstAt: number
    }
    const agg = new Map<string, Row>()
    for (const o of orders) {
      const cid = String(o.customer_id ?? '').trim()
      if (!cid) continue
      const ta = Number(o.total_amount ?? 0) || 0
      const cd = Number(o.coupon_discount ?? 0) || 0
      const pt = Number(o.point_used ?? 0) || 0
      const fa = Number(o.final_amount ?? 0) || 0
      const t = o.ordered_at ? new Date(o.ordered_at).getTime() : 0
      const pr = Array.isArray((o as any).profiles) ? (o as any).profiles[0] : (o as any).profiles
      const un = String(pr?.username ?? '').trim()
      const em = String(pr?.email ?? '').trim()
      const display = un || (em.includes('@') ? em.split('@')[0] : em) || cid.slice(0, 8)
      const grade = String(pr?.grade ?? '').trim()
      let x = agg.get(cid)
      if (!x) {
        x = { id: cid, display, grade, n: 0, totalAmt: 0, coupon: 0, toast: 0, final: 0, lastAt: 0, firstAt: t || Number.POSITIVE_INFINITY }
      }
      if (!x.display && display) x.display = display
      if (!x.grade && grade) x.grade = grade
      x.n++
      x.totalAmt += ta
      x.coupon += cd
      x.toast += pt
      x.final += fa
      if (t > x.lastAt) x.lastAt = t
      if (t > 0 && t < x.firstAt) x.firstAt = t
      agg.set(cid, x)
    }
    const allRows: Row[] = []
    for (const x of Array.from(agg.values())) {
      if (x.firstAt === Number.POSITIVE_INFINITY) x.firstAt = 0
      allRows.push(x)
    }
    const now = Date.now()
    const d90 = 90 * 24 * 60 * 60 * 1000
    const d30 = 30 * 24 * 60 * 60 * 1000
    const isChurn = (r: Row) => r.lastAt > 0 && now - r.lastAt >= d90
    const mark = (r: Row) => {
      let em = ''
      if (isChurn(r)) em += '🔴'
      if (r.n >= 2) em += '🔄'
      else if (r.n === 1) em += '🆕'
      return em
    }
    let filtered = allRows.slice()
    if (customerFilter === 'repurchase') filtered = filtered.filter((r) => r.n >= 2)
    if (customerFilter === 'single') filtered = filtered.filter((r) => r.n === 1)
    if (customerFilter === 'churn90') filtered = filtered.filter((r) => isChurn(r))
    if (customerFilter === 'new30') filtered = filtered.filter((r) => r.firstAt > 0 && now - r.firstAt <= d30)
    if (customerFilter === 'vip_lumiere_up') filtered = filtered.filter((r) => ['LUMIÈRE', 'REINE', 'NOIR', 'CÉLESTE'].includes(r.grade))
    if (customerFilter === 'top_noir_celeste') filtered = filtered.filter((r) => ['NOIR', 'CÉLESTE'].includes(r.grade))
    let sorted = filtered.slice()
    if (customerFilter === 'amount_top') sorted.sort((a, b) => b.final - a.final)
    else if (customerFilter === 'order_cnt_top') sorted.sort((a, b) => b.n - a.n || b.final - a.final)
    else if (customerFilter === 'recent') sorted.sort((a, b) => b.lastAt - a.lastAt)
    else if (customerFilter === 'churn90') sorted.sort((a, b) => a.lastAt - b.lastAt)
    else if (customerFilter === 'repurchase') sorted.sort((a, b) => b.final - a.final)
    else if (customerFilter === 'single') sorted.sort((a, b) => b.final - a.final)
    else if (customerFilter === 'toast_top') sorted.sort((a, b) => b.toast - a.toast || b.final - a.final)
    else if (customerFilter === 'coupon_top') sorted.sort((a, b) => b.coupon - a.coupon || b.final - a.final)
    else if (customerFilter === 'new30') sorted.sort((a, b) => b.firstAt - a.firstAt)
    else if (customerFilter === 'vip_lumiere_up') sorted.sort((a, b) => b.final - a.final)
    else if (customerFilter === 'top_noir_celeste') sorted.sort((a, b) => b.final - a.final)
    const top = sorted.slice(0, 20)
    const cnt = top.length
    const sumFinal = top.reduce((s, r) => s + r.final, 0)
    const sumN = top.reduce((s, r) => s + r.n, 0)
    return {
      top,
      mark,
      kpi: {
        cnt,
        avgBuy: cnt > 0 ? sumFinal / cnt : 0,
        avgOrders: cnt > 0 ? sumN / cnt : 0,
        totalContrib: sumFinal,
      },
    }
  }, [orders, customerFilter])

  const customerPanelOrders = useMemo(() => {
    if (!customerPanelId) return []
    return orders
      .filter((o) => String(o.customer_id ?? '') === customerPanelId)
      .slice()
      .sort((a, b) => {
        const ta = a.ordered_at ? new Date(a.ordered_at).getTime() : 0
        const tb = b.ordered_at ? new Date(b.ordered_at).getTime() : 0
        return tb - ta
      })
  }, [orders, customerPanelId])

  const customerPanelMeta = useMemo(() => {
    if (!customerPanelId) return { display: '-', grade: '-', firstAt: 0, lastAt: 0 }
    let display = customerPanelId.slice(0, 8)
    let grade = '-'
    let firstAt = 0
    let lastAt = 0
    for (const o of customerPanelOrders) {
      const pr = Array.isArray((o as any).profiles) ? (o as any).profiles[0] : (o as any).profiles
      const un = String(pr?.username ?? '').trim()
      const em = String(pr?.email ?? '').trim()
      const d = un || (em.includes('@') ? em.split('@')[0] : em) || customerPanelId.slice(0, 8)
      const g = String(pr?.grade ?? '').trim()
      if (d && display === customerPanelId.slice(0, 8)) display = d
      if (g && grade === '-') grade = g
      const t = o.ordered_at ? new Date(o.ordered_at).getTime() : 0
      if (t > lastAt) lastAt = t
      if (t > 0 && (firstAt === 0 || t < firstAt)) firstAt = t
    }
    return { display, grade, firstAt, lastAt }
  }, [customerPanelId, customerPanelOrders])

  const inflow = useMemo(() => {
    const pm = new Map<string, { id: string; n: number; sales: number; comm: number }>()
    const om = new Map<string, { id: string; n: number; sales: number; comm: number }>()
    for (const o of orders) {
      const p = String(o.partner_id ?? '').trim()
      const w = String(o.owner_id ?? '').trim()
      const fa = Number(o.final_amount ?? 0) || 0
      if (p) {
        const prev = pm.get(p) || { id: p, n: 0, sales: 0, comm: 0 }
        prev.n++
        prev.sales += fa
        prev.comm += Number((o as any).partner_commission ?? 0) || 0
        pm.set(p, prev)
      }
      if (w) {
        const prev = om.get(w) || { id: w, n: 0, sales: 0, comm: 0 }
        prev.n++
        prev.sales += fa
        prev.comm += Number((o as any).owner_commission ?? 0) || 0
        om.set(w, prev)
      }
    }
    return {
      partner: Array.from(pm.values()).sort((a, b) => b.sales - a.sales).slice(0, 10),
      owner: Array.from(om.values()).sort((a, b) => b.sales - a.sales).slice(0, 10),
    }
  }, [orders])

  const couponToast = useMemo(() => {
    const used = orders.filter((o) => (Number(o.coupon_discount ?? 0) || 0) > 0)
    const usedN = used.length
    const usedSum = used.reduce((s, o) => s + (Number(o.coupon_discount ?? 0) || 0), 0)
    const avg = usedN > 0 ? usedSum / usedN : 0
    const now = Date.now()
    const issued = userCoupons.length
    const usedUc = userCoupons.filter((x) => x.used_at).length
    const expiredUnused = userCoupons.filter((x) => !x.used_at && x.expired_at && new Date(x.expired_at).getTime() < now).length
    const useRate = issued > 0 ? (usedUc / issued) * 100 : 0
    const toastUsed = orders.reduce((s, o) => s + (Number(o.point_used ?? 0) || 0), 0)
    const toastEarn = orders.reduce((s, o) => s + (Number(o.earn_points ?? 0) || 0), 0)
    const toastRate = toastEarn > 0 ? (toastUsed / toastEarn) * 100 : 0
    return { usedN, usedSum, avg, issued, usedUc, expiredUnused, useRate, toastUsed, toastEarn, toastRate }
  }, [orders, userCoupons])

  const tabs: TabKey[] = ['매출현황', '제품분석', '고객분석', '유입경로', '쿠폰/토스트']

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>매출/통계 분석</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>실제 주문/쿠폰 데이터 기반 집계</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {(['오늘', '이번주', '이번달', '올해', '날짜지정'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className="btn"
            onClick={() => {
              setPeriod(p)
              const t = new Date()
              if (p === '오늘') {
                const s = t.toISOString().slice(0, 10)
                setFromDate(s)
                setToDate(s)
              } else if (p === '이번주') {
                const wd = (t.getDay() + 6) % 7
                const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - wd)
                setFromDate(mon.toISOString().slice(0, 10))
                setToDate(t.toISOString().slice(0, 10))
              } else if (p === '이번달') {
                const first = new Date(t.getFullYear(), t.getMonth(), 1)
                setFromDate(first.toISOString().slice(0, 10))
                setToDate(t.toISOString().slice(0, 10))
              } else if (p === '올해') {
                setFromDate(`${t.getFullYear()}-01-01`)
                setToDate(`${t.getFullYear()}-12-31`)
              } else if (p === '날짜지정') {
                setDateFromDraft(fromDate)
                setDateToDraft(toDate)
              }
            }}
            style={{
              border: period === p ? '1px solid #7B5EA7' : '1px solid var(--border)',
              color: period === p ? '#7B5EA7' : 'var(--text2)',
              background: period === p ? 'rgba(123,94,167,0.14)' : 'var(--bg3)',
            }}
          >
            {p}
          </button>
        ))}
      </div>
      {period === '날짜지정' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 18, lineHeight: 1, color: '#7B5EA7' }} aria-hidden>
            📅
          </span>
          <input
            type="date"
            value={dateFromDraft}
            onChange={(e) => setDateFromDraft(e.target.value)}
            onFocus={() => setDateFocusFrom(true)}
            onBlur={() => setDateFocusFrom(false)}
            style={{
              background: 'var(--bg3)',
              border: dateFocusFrom ? '1px solid #A78BFA' : '1px solid #7B5EA7',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 12,
              padding: '8px 12px',
              outline: 'none',
              boxShadow: dateFocusFrom ? '0 0 0 2px rgba(123,94,167,0.35)' : 'none',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>~</span>
          <input
            type="date"
            value={dateToDraft}
            onChange={(e) => setDateToDraft(e.target.value)}
            onFocus={() => setDateFocusTo(true)}
            onBlur={() => setDateFocusTo(false)}
            style={{
              background: 'var(--bg3)',
              border: dateFocusTo ? '1px solid #A78BFA' : '1px solid #7B5EA7',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: 12,
              padding: '8px 12px',
              outline: 'none',
              boxShadow: dateFocusTo ? '0 0 0 2px rgba(123,94,167,0.35)' : 'none',
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setFromDate(dateFromDraft)
              setToDate(dateToDraft)
            }}
            style={{
              background: '#7B5EA7',
              color: '#fff',
              border: '1px solid #7B5EA7',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 8,
            }}
          >
            조회
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className="btn"
            onClick={() => setTab(t)}
            style={{
              border: tab === t ? '1px solid var(--gold)' : '1px solid var(--border)',
              color: tab === t ? 'var(--gold)' : 'var(--text2)',
              background: tab === t ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {tab === '매출현황' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 주문 건수</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 18 }}>{stats.n.toLocaleString()}건</div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>정가 합계</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 18 }}>₩{stats.sumTotal.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>쿠폰 할인 합계</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 18 }}>₩{stats.sumCoupon.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>토스트 사용 합계</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 18 }}>{stats.sumToast.toLocaleString()}T</div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>실결제 합계</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 900, fontSize: 20 }}>₩{stats.sumFinal.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>충전 결제</div>
                  <div className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>건수 {stats.chargeCnt.toLocaleString()}건</div>
                  <div className="mono" style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700 }}>₩{stats.chargeAmt.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>토스트 사용 결제</div>
                  <div className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>건수 {stats.toastCnt.toLocaleString()}건</div>
                  <div className="mono" style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700 }}>{stats.toastAmt.toLocaleString()}T</div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>일반 결제</div>
                  <div className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>건수 {stats.normalCnt.toLocaleString()}건</div>
                  <div className="mono" style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700 }}>₩{stats.normalAmt.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>요일별 매출</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, alignItems: 'end', minHeight: 160 }}>
                  {weekday.map((w) => (
                    <div key={w.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 40,
                          height: `${Math.max(6, Math.round((w.v / w.max) * 120))}px`,
                          background: w.isTop ? 'var(--gold)' : 'rgba(255,255,255,0.28)',
                          borderRadius: 6,
                        }}
                      />
                      <div style={{ fontSize: 11, color: w.isTop ? 'var(--gold)' : 'var(--text2)', fontWeight: w.isTop ? 700 : 500 }}>{w.label}</div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>
                        ₩{w.v.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>시간대별 주문 분포</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  {timeDist.map((t) => (
                    <div key={t.key} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{t.key}</div>
                      <div className="mono" style={{ marginTop: 4, color: 'var(--text)', fontSize: 12 }}>
                        {t.n.toLocaleString()}건
                      </div>
                      <div className="mono" style={{ marginTop: 2, color: 'var(--gold)', fontSize: 12 }}>
                        {t.p.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <AdminBrandProductFeeCard />
            </>
          ) : null}

          {tab === '제품분석' ? (
            <>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>제품 검색</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <input
                    value={productSearchDraft}
                    onChange={(e) => setProductSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setProductQuery(productSearchDraft.trim())
                    }}
                    placeholder="제품명 검색"
                    style={{ flex: '1 1 200px', minWidth: 160, maxWidth: 360, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '8px 10px', outline: 'none' }}
                  />
                  <button type="button" className="btn btn-bl" onClick={() => setProductQuery(productSearchDraft.trim())}>
                    🔍 검색
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 10 }}>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 판매량</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{productSearchStats.qty.toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 정가</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>₩{Math.round(productSearchStats.total).toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 쿠폰</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>₩{Math.round(productSearchStats.coupon).toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 토스트</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{Math.round(productSearchStats.toast).toLocaleString()}T</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 실결제</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>₩{Math.round(productSearchStats.final).toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>전체 제품 판매 순위 TOP 10</div>
                <table>
                  <thead>
                    <tr>
                      <th>제품명</th>
                      <th>판매건수</th>
                      <th>매출 합계</th>
                      <th>전체 대비 %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productList.slice(0, 10).map((p) => (
                      <tr key={p.name}>
                        <td>{p.name || '-'}</td>
                        <td className="mono">{p.qty.toLocaleString()}</td>
                        <td className="mono">₩{Math.round(p.rev).toLocaleString()}</td>
                        <td className="mono">{stats.sumFinal > 0 ? ((p.final / stats.sumFinal) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    ))}
                    {productList.length === 0 ? (
                      <tr>
                        <td colSpan={4}>데이터 없음</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {tab === '고객분석' ? (
            <>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>고객 검색</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <select
                    value={customerFilterDraft}
                    onChange={(e) => setCustomerFilterDraft(e.target.value)}
                    style={{ minWidth: 260, maxWidth: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12, padding: '8px 10px', outline: 'none' }}
                  >
                    <option value="amount_top">구매금액 TOP (실결제 합계 높은 순)</option>
                    <option value="order_cnt_top">주문횟수 TOP (주문 많은 순)</option>
                    <option value="recent">최근 구매순 (ordered_at 최신순)</option>
                    <option value="churn90">90일 미구매 (이탈 위험)</option>
                    <option value="repurchase">재구매 고객 (2회 이상)</option>
                    <option value="single">1회 구매 고객 (단구매)</option>
                    <option value="toast_top">토스트 많이 쓴 고객 (point_used 합계)</option>
                    <option value="coupon_top">쿠폰 많이 쓴 고객 (coupon_discount 합계)</option>
                    <option value="new30">신규 고객 (최근 30일 첫구매)</option>
                    <option value="vip_lumiere_up">LUMIÈRE 이상 VIP 고객</option>
                    <option value="top_noir_celeste">NOIR/CÉLESTE 최상위 고객</option>
                  </select>
                  <button type="button" className="btn btn-bl" onClick={() => setCustomerFilter(customerFilterDraft)}>
                    🔍 검색
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 해당 고객 수</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>
                    {customerSearchResult.kpi.cnt.toLocaleString()}명
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>평균 구매액</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>
                    ₩{Math.round(customerSearchResult.kpi.avgBuy).toLocaleString()}
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>평균 주문횟수</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>
                    {customerSearchResult.kpi.avgOrders.toFixed(1)}회
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '2px solid var(--gold)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 매출 기여</div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 16 }}>
                    ₩{Math.round(customerSearchResult.kpi.totalContrib).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>고객 순위 TOP 20</div>
                  <button type="button" className="btn btn-bl" disabled={selectedCustomerIds.length === 0} onClick={() => setShowCampaignPanel(true)}>
                    선택 고객 캠페인 ({selectedCustomerIds.length})
                  </button>
                </div>
                {showCampaignPanel && (
                  <CustomerCampaignPanel selectedCustomerIds={selectedCustomerIds} onClose={() => setShowCampaignPanel(false)} />
                )}
                <table>
                  <thead>
                    <tr>
                      <th></th>
                      <th>순위</th>
                      <th>고객명</th>
                      <th>등급</th>
                      <th>총주문수</th>
                      <th>정가합계</th>
                      <th>쿠폰할인</th>
                      <th>토스트</th>
                      <th>실결제합계</th>
                      <th>마지막구매일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerSearchResult.top.map((r, i) => (
                      <tr key={r.id} onClick={() => setCustomerPanelId(r.id)} style={{ cursor: 'pointer' }}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(r.id)}
                            onChange={() => setSelectedCustomerIds(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id])}
                          />
                        </td>
                        <td className="mono">{i + 1}</td>
                        <td className="mono">
                          {r.display} <span style={{ fontSize: 14 }}>{customerSearchResult.mark(r)}</span>
                        </td>
                        <td>
                          <span
                            className="mono"
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: 999,
                              fontSize: 10,
                              border: '1px solid var(--border)',
                              background:
                                r.grade === 'CÉLESTE'
                                  ? 'var(--gold)'
                                  : r.grade === 'NOIR'
                                    ? '#111'
                                    : r.grade === 'REINE'
                                      ? 'rgba(201,168,76,.2)'
                                      : r.grade === 'LUMIÈRE'
                                        ? 'rgba(123,94,167,.25)'
                                        : r.grade === 'VELVET'
                                          ? 'rgba(80,120,255,.25)'
                                          : r.grade === 'BLOOM'
                                            ? 'rgba(70,150,90,.25)'
                                            : 'rgba(255,255,255,.12)',
                              color:
                                r.grade === 'CÉLESTE'
                                  ? '#111'
                                  : r.grade === 'NOIR'
                                    ? 'var(--gold)'
                                    : r.grade === 'REINE'
                                      ? 'var(--gold)'
                                      : r.grade === 'LUMIÈRE'
                                        ? '#B79CE7'
                                        : r.grade === 'VELVET'
                                          ? '#9DB5FF'
                                          : r.grade === 'BLOOM'
                                            ? '#9AE0AB'
                                            : 'var(--text2)',
                            }}
                          >
                            {r.grade || '-'}
                          </span>
                        </td>
                        <td className="mono">{r.n.toLocaleString()}</td>
                        <td className="mono">₩{Math.round(r.totalAmt).toLocaleString()}</td>
                        <td className="mono">₩{Math.round(r.coupon).toLocaleString()}</td>
                        <td className="mono">{Math.round(r.toast).toLocaleString()}T</td>
                        <td className="mono" style={{ color: 'var(--gold)', fontWeight: 700 }}>
                          ₩{Math.round(r.final).toLocaleString()}
                        </td>
                        <td className="mono">{r.lastAt ? new Date(r.lastAt).toLocaleString('ko-KR') : '—'}</td>
                      </tr>
                    ))}
                    {customerSearchResult.top.length === 0 ? (
                      <tr>
                        <td colSpan={10}>데이터 없음</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>재구매율 (전체 구매 고객)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>1회</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{customer.one.toLocaleString()}명 ({customer.oneP.toFixed(1)}%)</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>2회</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{customer.two.toLocaleString()}명 ({customer.twoP.toFixed(1)}%)</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>3회 이상</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)', fontWeight: 900, fontSize: 15 }}>
                      {customer.three.toLocaleString()}명 ({customer.threeP.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>이탈 위험 고객 (90일 이상 미구매)</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{customer.churnList.length.toLocaleString()}명</div>
                  </div>
                  <button type="button" className="btn btn-gy" onClick={() => setChurnOpen(true)}>
                    목록 보기
                  </button>
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>평균 구매 간격</div>
                <div className="mono" style={{ marginTop: 6, color: 'var(--gold)', fontSize: 16 }}>{customer.avgGap.toFixed(1)}일</div>
              </div>
            </>
          ) : null}

          {tab === '유입경로' ? (
            <>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>파트너스 유입 TOP 10</div>
                <table>
                  <thead>
                    <tr>
                      <th>partner_id</th>
                      <th>유입 주문수</th>
                      <th>총 매출</th>
                      <th>커미션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflow.partner.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.id.slice(0, 8)}</td>
                        <td className="mono">{r.n.toLocaleString()}</td>
                        <td className="mono">₩{r.sales.toLocaleString()}</td>
                        <td className="mono">₩{r.comm.toLocaleString()}</td>
                      </tr>
                    ))}
                    {inflow.partner.length === 0 ? (
                      <tr>
                        <td colSpan={4}>데이터 없음</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>원장님 유입 TOP 10</div>
                <table>
                  <thead>
                    <tr>
                      <th>owner_id</th>
                      <th>유입 주문수</th>
                      <th>총 매출</th>
                      <th>커미션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflow.owner.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{r.id.slice(0, 8)}</td>
                        <td className="mono">{r.n.toLocaleString()}</td>
                        <td className="mono">₩{r.sales.toLocaleString()}</td>
                        <td className="mono">₩{r.comm.toLocaleString()}</td>
                      </tr>
                    ))}
                    {inflow.owner.length === 0 ? (
                      <tr>
                        <td colSpan={4}>데이터 없음</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {tab === '쿠폰/토스트' ? (
            <>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>쿠폰 통계 (orders)</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>쿠폰 사용 주문 수: {couponToast.usedN.toLocaleString()}건</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>총 쿠폰 할인 금액: ₩{couponToast.usedSum.toLocaleString()}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>평균 쿠폰 할인액: ₩{Math.round(couponToast.avg).toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>user_coupons 통계</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>총 발급 수: {couponToast.issued.toLocaleString()}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>사용 수: {couponToast.usedUc.toLocaleString()}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>미사용 만료 수: {couponToast.expiredUnused.toLocaleString()}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>사용률: {couponToast.useRate.toFixed(1)}%</div>
              </div>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>토스트 통계 (orders)</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>총 토스트 사용: {couponToast.toastUsed.toLocaleString()}T</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>총 토스트 적립: {couponToast.toastEarn.toLocaleString()}T</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>사용률: {couponToast.toastRate.toFixed(1)}%</div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {churnOpen ? (
        <div
          onClick={() => setChurnOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>90일 이상 미구매 고객</div>
              <button type="button" className="btn btn-gy" onClick={() => setChurnOpen(false)}>
                닫기
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customer.churnList.map((id) => (
                <div key={id} className="mono" style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px' }}>
                  {id}
                </div>
              ))}
              {customer.churnList.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>없음</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {customerPanelId ? (
        <div
          onClick={() => setCustomerPanelId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              height: '100vh',
              width: 380,
              background: 'var(--bg2)',
              borderLeft: '1px solid var(--border2)',
              borderTop: '2px solid var(--gold)',
              zIndex: 51,
              overflowY: 'auto',
              padding: 24,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>고객 구매 히스토리</div>
            <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)' }}>
              고객ID {customerPanelId.slice(0, 8)} · {customerPanelMeta.display}
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                className="mono"
                style={{
                  display: 'inline-block',
                  padding: '5px 11px',
                  borderRadius: 999,
                  fontSize: 12,
                  border: '1px solid var(--border)',
                  background:
                    customerPanelMeta.grade === 'CÉLESTE'
                      ? 'var(--gold)'
                      : customerPanelMeta.grade === 'NOIR'
                        ? '#111'
                        : customerPanelMeta.grade === 'REINE'
                          ? 'rgba(201,168,76,.2)'
                          : customerPanelMeta.grade === 'LUMIÈRE'
                            ? 'rgba(123,94,167,.25)'
                            : customerPanelMeta.grade === 'VELVET'
                              ? 'rgba(80,120,255,.25)'
                              : customerPanelMeta.grade === 'BLOOM'
                                ? 'rgba(70,150,90,.25)'
                                : 'rgba(255,255,255,.12)',
                  color:
                    customerPanelMeta.grade === 'CÉLESTE'
                      ? '#111'
                      : customerPanelMeta.grade === 'NOIR'
                        ? 'var(--gold)'
                        : customerPanelMeta.grade === 'REINE'
                          ? 'var(--gold)'
                          : customerPanelMeta.grade === 'LUMIÈRE'
                            ? '#B79CE7'
                            : customerPanelMeta.grade === 'VELVET'
                              ? '#9DB5FF'
                              : customerPanelMeta.grade === 'BLOOM'
                                ? '#9AE0AB'
                                : 'var(--text2)',
                }}
              >
                {customerPanelMeta.grade || '-'}
              </span>
            </div>
            <div className="mono" style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)' }}>
              첫 구매일 {customerPanelMeta.firstAt ? new Date(customerPanelMeta.firstAt).toLocaleString('ko-KR') : '-'}
            </div>
            <div className="mono" style={{ marginTop: 3, fontSize: 10, color: 'var(--text3)' }}>
              마지막 구매일 {customerPanelMeta.lastAt ? new Date(customerPanelMeta.lastAt).toLocaleString('ko-KR') : '-'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 14 }}>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>총 주문</div>
                <div className="mono" style={{ marginTop: 4, color: 'var(--text)' }}>
                  {customerPanelOrders.length.toLocaleString()}건
                </div>
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>정가 합계</div>
                <div className="mono" style={{ marginTop: 4, color: 'var(--text)' }}>
                  ₩{customerPanelOrders.reduce((s, o) => s + (Number(o.total_amount ?? 0) || 0), 0).toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>쿠폰 할인 합계</div>
                <div className="mono" style={{ marginTop: 4, color: 'var(--text)' }}>
                  ₩{customerPanelOrders.reduce((s, o) => s + (Number(o.coupon_discount ?? 0) || 0), 0).toLocaleString()}
                </div>
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>토스트 사용 합계</div>
                <div className="mono" style={{ marginTop: 4, color: 'var(--text)' }}>
                  {customerPanelOrders.reduce((s, o) => s + (Number(o.point_used ?? 0) || 0), 0).toLocaleString()}T
                </div>
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 9 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>실결제 합계</div>
                <div className="mono" style={{ marginTop: 4, color: 'var(--gold)', fontWeight: 700 }}>
                  ₩{customerPanelOrders.reduce((s, o) => s + (Number(o.final_amount ?? 0) || 0), 0).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>주문번호</th>
                    <th>상태</th>
                    <th>실결제</th>
                    <th>주문일</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPanelOrders.map((o) => (
                    <tr key={o.id}>
                      <td
                        className="mono"
                        style={{ cursor: 'pointer' }}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(String(o.order_no ?? ''))
                          } catch {}
                        }}
                      >
                        {o.order_no}
                      </td>
                      <td>
                        <span
                          className={
                            o.status === '배송완료'
                              ? 'b b-gd'
                              : o.status === '배송중'
                                ? 'b b-pu'
                                : o.status === '발송준비'
                                  ? 'b b-bl'
                                  : o.status === '취소' || o.status === '환불' || o.status === '취소/환불'
                                    ? 'b b-re'
                                    : 'b b-gy'
                          }
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="mono">₩{Number(o.final_amount ?? 0).toLocaleString()}</td>
                      <td className="mono">{o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : '—'}</td>
                    </tr>
                  ))}
                  {customerPanelOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4}>주문 없음</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-bl" onClick={() => (window.location.href = '/admin/coupons')}>
                ✉️ 쿠폰 발송
              </button>
              <button type="button" className="btn btn-gy" onClick={() => setCustomerPanelId(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
