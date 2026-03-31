'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
        .select('id, order_no, customer_id, status, total_amount, point_used, charge_used, coupon_discount, final_amount, earn_points, items, partner_id, owner_id, partner_commission, owner_commission, ordered_at, shipped_at, delivered_at')
        .gte('ordered_at', `${fromDate}T00:00:00`)
        .lte('ordered_at', `${toDate}T23:59:59.999`)
        .not('status', 'in', '("취소","환불")')
      if (r1.error) {
        const r2 = await supabase
          .from('orders')
          .select('id, order_no, customer_id, status, total_amount, point_used, charge_used, coupon_discount, final_amount, earn_points, items, partner_id, owner_id, ordered_at, shipped_at, delivered_at')
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
  }, [supabase, fromDate, toDate])

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
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>재구매율</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>1회 고객</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{customer.one.toLocaleString()}명 ({customer.oneP.toFixed(1)}%)</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>2회 고객</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{customer.two.toLocaleString()}명 ({customer.twoP.toFixed(1)}%)</div>
                  </div>
                  <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>3회 이상 고객</div>
                    <div className="mono" style={{ marginTop: 4, color: 'var(--gold)' }}>{customer.three.toLocaleString()}명 ({customer.threeP.toFixed(1)}%)</div>
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
    </div>
  )
}
