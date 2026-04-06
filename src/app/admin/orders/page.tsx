'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { confirmOrderById } from '@/lib/orders/confirmOrder'

type TabKey = '전체' | '주문확인' | '발송준비' | '배송중' | '배송완료' | '취소/환불'

type OrderRow = {
  id: string
  order_no: string
  status: string
  total_amount?: number | null
  final_amount?: number | null
  coupon_discount?: number | null
  point_used?: number | null
  points_used?: number | null
  payment_method?: string | null
  tracking_no?: string | null
  courier?: string | null
  ordered_at?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  confirmed_at?: string | null
  auto_confirm_at?: string | null
  customer_id?: string | null
  admin_order_notes?: string | null
  customer_memo?: string | null
  users?: { customer_grade?: string | null } | null
}

const SELECT_FULL =
  'id, order_no, status, total_amount, final_amount, coupon_discount, points_used, payment_method, tracking_no, courier, ordered_at, shipped_at, delivered_at, confirmed_at, auto_confirm_at, admin_order_notes, customer_id, customer_memo, users!orders_customer_id_fkey(customer_grade, profiles(full_name, username, email, grade))'
const SELECT_FULL_NOUSER =
  'id, order_no, status, total_amount, final_amount, coupon_discount, points_used, payment_method, tracking_no, courier, ordered_at, shipped_at, delivered_at, confirmed_at, auto_confirm_at, admin_order_notes, customer_id, customer_memo'
const SELECT_FALLBACK =
  'id, order_no, status, total_amount, final_amount, coupon_discount, point_used, tracking_no, courier, ordered_at, shipped_at, delivered_at, confirmed_at, auto_confirm_at, customer_id'

export default function AdminOrdersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [tab, setTab] = useState<TabKey>('주문확인')

  const [modalId, setModalId] = useState<string | null>(null)
  const [modalCourier, setModalCourier] = useState('CJ대한통운')
  const [modalTracking, setModalTracking] = useState('')
  const [modalMsg, setModalMsg] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [giftCheck, setGiftCheck] = useState(false)
  const [giftText, setGiftText] = useState('')
  const [cardCheck, setCardCheck] = useState(false)
  const [cardText, setCardText] = useState('')
  const [internalMemo, setInternalMemo] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPreview, setBulkPreview] = useState<{ order_no: string; courier: string; tracking_no: string }[]>([])
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkFileKey, setBulkFileKey] = useState(0)
  const [memoDetailId, setMemoDetailId] = useState<string | null>(null)
  const [memoDraft, setMemoDraft] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [autoConfirmDays, setAutoConfirmDays] = useState(7)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [shipBulkIds, setShipBulkIds] = useState<string[] | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchCat, setSearchCat] = useState('')
  const [searchText, setSearchText] = useState('')
  const [searchPayPick, setSearchPayPick] = useState('')
  const [searchStatusPick, setSearchStatusPick] = useState('')
  const [searchAmountPick, setSearchAmountPick] = useState('')
  const [appliedSearch, setAppliedSearch] = useState<{ t: string; v?: string }>({ t: 'none' })
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [printPreviewMode, setPrintPreviewMode] = useState(false)
  const [printPeriodTab, setPrintPeriodTab] = useState<'오늘' | '이번주' | '이번달' | '연도별' | '날짜지정'>('이번달')
  const [printYear, setPrintYear] = useState(2026)
  const [printDf, setPrintDf] = useState('')
  const [printDt, setPrintDt] = useState('')
  const [printScope, setPrintScope] = useState<'tab' | 'all' | 'pick'>('tab')
  const [printPick, setPrintPick] = useState<Record<string, boolean>>({
    주문확인: true,
    발송준비: true,
    배송중: true,
    배송완료: true,
    취소: true,
    환불: true,
  })
  const [printCol, setPrintCol] = useState({
    order_no: true,
    customer: true,
    status: true,
    pay: true,
    total: true,
    coupon: true,
    toast: true,
    final: true,
    tracking: true,
    ordered: true,
    adminMemo: false,
    customerMemo: false,
  })
  const [printIncludeStats, setPrintIncludeStats] = useState(true)

  const current = useMemo(() => rows.find((r) => r.id === modalId) || null, [modalId, rows])
  const memoOrder = useMemo(() => rows.find((r) => r.id === memoDetailId) || null, [memoDetailId, rows])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      let data: OrderRow[] | null = null
      const r1 = await supabase.from('orders').select(SELECT_FULL).eq('payment_applied', true).order('ordered_at', { ascending: false }).limit(500)
      let fetchError = r1.error
      data = (r1.data as OrderRow[] | null) ?? null
      if (fetchError) {
        const r1b = await supabase.from('orders').select(SELECT_FULL_NOUSER).eq('payment_applied', true).order('ordered_at', { ascending: false }).limit(500)
        data = (r1b.data as OrderRow[] | null) ?? null
        fetchError = r1b.error
      }
      if (fetchError) {
        const r2 = await supabase.from('orders').select(SELECT_FALLBACK).eq('payment_applied', true).order('ordered_at', { ascending: false }).limit(500)
        data = (r2.data as OrderRow[] | null) ?? null
        fetchError = r2.error
      }
      if (fetchError) {
        console.error('admin orders fetch', fetchError)
        setRows([])
      } else {
        setRows(data || [])
      }
      const { data: autoRow } = await supabase.from('admin_settings').select('value').eq('category', 'order').eq('key', 'auto_confirm_days').maybeSingle()
      setAutoConfirmDays(Math.max(1, Math.floor(Number((autoRow as { value?: string } | null)?.value ?? 7))))
      setLoading(false)
    }
    void run()
  }, [])

  const filtered = useMemo(() => {
    let list = rows || []
    list = list.filter((r) => {
      if (tab === '전체') return true
      if (tab === '취소/환불') return r.status === '취소' || r.status === '환불' || r.status === '취소/환불'
      return r.status === tab
    })
    if (dateFrom) {
      const t0 = new Date(dateFrom + 'T00:00:00').getTime()
      list = list.filter((r) => r.ordered_at && new Date(r.ordered_at).getTime() >= t0)
    }
    if (dateTo) {
      const t1 = new Date(dateTo + 'T23:59:59.999').getTime()
      list = list.filter((r) => r.ordered_at && new Date(r.ordered_at).getTime() <= t1)
    }
    if (appliedSearch.t !== 'none' && appliedSearch.v) {
      const v = appliedSearch.v
      if (appliedSearch.t === 'order_no') {
        const q = v.toLowerCase()
        list = list.filter((r) => String(r.order_no).toLowerCase().includes(q))
      } else if (appliedSearch.t === 'customer_id') {
        const q = v.toLowerCase()
        list = list.filter((r) => String(r.customer_id ?? '').toLowerCase().includes(q))
      } else if (appliedSearch.t === 'payment') {
        list = list.filter((r) => {
          const pay = String((r as any).payment_method ?? '')
          if (v === '카드') return /카드|card/i.test(pay)
          if (v === '무통장') return /무통장|무통|입금|bank|transfer/i.test(pay)
          if (v === '토스트페이') return /토스트|toast/i.test(pay)
          return false
        })
      } else if (appliedSearch.t === 'status') {
        list = list.filter((r) => r.status === v)
      } else if (appliedSearch.t === 'amount') {
        list = list.filter((r) => {
          const fa = Number(r.final_amount ?? 0) || 0
          if (v === '3만원대') return fa >= 30000 && fa < 40000
          if (v === '5만원대') return fa >= 50000 && fa < 60000
          if (v === '10만 이상') return fa >= 100000
          return false
        })
      }
    }
    return list
  }, [rows, tab, dateFrom, dateTo, appliedSearch])

  const stats = useMemo(() => {
    let n = 0
    let sumTotal = 0
    let sumCoupon = 0
    let sumToast = 0
    let sumFinal = 0
    for (const r of filtered) {
      n++
      sumTotal += Number(r.total_amount ?? 0) || 0
      sumCoupon += Number(r.coupon_discount ?? 0) || 0
      sumToast += Number((r as any).points_used ?? r.point_used ?? 0) || 0
      sumFinal += Number(r.final_amount ?? 0) || 0
    }
    return { n, sumTotal, sumCoupon, sumToast, sumFinal }
  }, [filtered])

  const historyOrders = useMemo(() => {
    if (!historyCustomerId) return []
    return (rows || [])
      .filter((r) => r.customer_id === historyCustomerId)
      .slice()
      .sort((a, b) => {
        const ta = a.ordered_at ? new Date(a.ordered_at).getTime() : 0
        const tb = b.ordered_at ? new Date(b.ordered_at).getTime() : 0
        return ta - tb
      })
  }, [rows, historyCustomerId])

  const historyStats = useMemo(() => {
    let n = 0
    let sumTotal = 0
    let sumCoupon = 0
    let sumToast = 0
    let sumFinal = 0
    for (const r of historyOrders) {
      n++
      sumTotal += Number(r.total_amount ?? 0) || 0
      sumCoupon += Number(r.coupon_discount ?? 0) || 0
      sumToast += Number((r as any).points_used ?? r.point_used ?? 0) || 0
      sumFinal += Number(r.final_amount ?? 0) || 0
    }
    return { n, sumTotal, sumCoupon, sumToast, sumFinal }
  }, [historyOrders])

  const historyHeaderDisplay = useMemo(() => {
    if (!historyCustomerId) return ''
    const r = rows.find((x) => x.customer_id === historyCustomerId)
    if (!r) return String(historyCustomerId).slice(0, 8)
    const prT = (r as any).profiles
    const pTop = Array.isArray(prT) ? prT[0] : prT
    const uEmb = (r as any).users
    const uOne = Array.isArray(uEmb) ? uEmb[0] : uEmb
    const prN = uOne?.profiles
    const prof = (Array.isArray(prN) ? prN[0] : prN) || pTop
    const un = String(prof?.username ?? '').trim()
    if (un) return un
    const em = String(prof?.email ?? '').trim()
    const at = em.indexOf('@')
    if (at > 0) return em.slice(0, at)
    if (em) return em
    const cid = String(r.customer_id ?? '')
    return cid ? cid.slice(0, 8) : '—'
  }, [historyCustomerId, rows])

  const printRows = useMemo(() => {
    let list = rows || []
    if (printDf) {
      const t0 = new Date(printDf + 'T00:00:00').getTime()
      list = list.filter((r) => r.ordered_at && new Date(r.ordered_at).getTime() >= t0)
    }
    if (printDt) {
      const t1 = new Date(printDt + 'T23:59:59.999').getTime()
      list = list.filter((r) => r.ordered_at && new Date(r.ordered_at).getTime() <= t1)
    }
    if (printScope === 'tab') {
      if (tab === '전체') {
        /* no-op */
      } else if (tab === '취소/환불') {
        list = list.filter((r) => r.status === '취소' || r.status === '환불' || r.status === '취소/환불')
      } else {
        list = list.filter((r) => r.status === tab)
      }
    } else if (printScope === 'pick') {
      list = list.filter((r) => {
        const st = r.status
        if (st === '취소/환불') return printPick['취소'] || printPick['환불']
        return !!printPick[st]
      })
    }
    return list
      .slice()
      .sort((a, b) => {
        const ta = a.ordered_at ? new Date(a.ordered_at).getTime() : 0
        const tb = b.ordered_at ? new Date(b.ordered_at).getTime() : 0
        return tb - ta
      })
  }, [rows, printDf, printDt, printScope, printPick, tab])

  const printStats = useMemo(() => {
    let n = 0
    let sumTotal = 0
    let sumCoupon = 0
    let sumToast = 0
    let sumFinal = 0
    for (const r of printRows) {
      n++
      sumTotal += Number(r.total_amount ?? 0) || 0
      sumCoupon += Number(r.coupon_discount ?? 0) || 0
      sumToast += Number((r as any).points_used ?? r.point_used ?? 0) || 0
      sumFinal += Number(r.final_amount ?? 0) || 0
    }
    return { n, sumTotal, sumCoupon, sumToast, sumFinal }
  }, [printRows])

  const openShipModal = (o: OrderRow, bulkTargetIds?: string[] | null) => {
    setShipBulkIds(bulkTargetIds && bulkTargetIds.length ? bulkTargetIds : null)
    setModalId(o.id)
    setModalCourier(o.courier || 'CJ대한통운')
    setModalTracking((o.tracking_no || '').trim())
    setGiftCheck(false)
    setGiftText('')
    setCardCheck(false)
    setCardText('')
    setInternalMemo(String((o as any).admin_order_notes || '').trim())
    setModalMsg(
      `[AURAN] 주문이 발송됐습니다.\n` +
        `운송장번호: ${(o.tracking_no || '').trim() ? String(o.tracking_no) : '(입력 후 자동 반영)'}\n` +
        `주문번호: ${o.order_no}\n\n` +
        `배송조회: https://auran.kr/track/\n` +
        `문의: support@auran.kr`
    )
  }

  const tryNotifyCustomer = async (customerId: string | null | undefined, title: string, body: string) => {
    if (!customerId) return
    const res = await supabase.from('notifications').insert({
      user_id: customerId,
      type: 'shipping',
      title,
      body,
      icon: '🚚',
      is_read: false,
      created_at: new Date().toISOString(),
    })
    if (res.error) {
      // ignore (table or RLS might block)
    }
  }

  const shipFromModal = async () => {
    const idList = shipBulkIds && shipBulkIds.length ? shipBulkIds : modalId ? [modalId] : []
    const firstRow = idList.length ? rows.find((r) => r.id === idList[0]) : null
    if (!idList.length || !firstRow) return
    if (!modalTracking.trim()) {
      alert('운송장 번호를 입력해주세요')
      return
    }
    setModalSaving(true)
    const courier = modalCourier
    const tracking = modalTracking.trim()
    const now = new Date().toISOString()
    let extraMsg = ''
    if (giftCheck && giftText.trim()) extraMsg += `\n\n[증정] ${giftText.trim()}`
    if (cardCheck && cardText.trim()) extraMsg += `\n\n[선물 카드] ${cardText.trim()}`
    const notesPayload = [
      internalMemo.trim(),
      giftCheck && giftText.trim() ? `[증정] ${giftText.trim()}` : '',
      cardCheck && cardText.trim() ? `[선물카드] ${cardText.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    try {
      let err = (
        await supabase
          .from('orders')
          .update({
            status: '배송중',
            tracking_no: tracking,
            courier,
            shipped_at: now,
            admin_order_notes: notesPayload,
          } as any)
          .in('id', idList)
      ).error
      if (err) {
        const r2 = await supabase.from('orders').update({ status: '배송중', tracking_no: tracking, courier, shipped_at: now }).in('id', idList)
        err = r2.error
        if (err) {
          alert(err.message)
          return
        }
      }
      const idSet = new Set(idList)
      for (const rid of idList) {
        const ro = rows.find((r) => r.id === rid)
        if (!ro) continue
        const notifyBody =
          `[AURAN] 주문이 발송됐습니다.\n` +
          `운송장번호: ${tracking}\n` +
          `주문번호: ${ro.order_no}\n\n` +
          `배송조회: https://auran.kr/track/\n` +
          `문의: support@auran.kr` +
          extraMsg
        await tryNotifyCustomer(ro.customer_id, '🚚 발송 안내', notifyBody)
      }
      setRows((prev) =>
        prev.map((r) =>
          idSet.has(r.id) ? { ...r, status: '배송중', tracking_no: tracking, courier, shipped_at: now, admin_order_notes: notesPayload } : r
        )
      )
      setModalId(null)
      setShipBulkIds(null)
      setSelectedIds(new Set())
      setTab('배송중')
      setToastMsg(`${idList.length}건 처리됐습니다`)
      window.setTimeout(() => setToastMsg(''), 2500)
    } finally {
      setModalSaving(false)
    }
  }

  const markDelivered = async (id: string) => {
    const deliveredAt = new Date().toISOString()
    const autoAt = new Date(Date.now() + autoConfirmDays * 86400000).toISOString()
    const { error } = await supabase.from('orders').update({ status: '배송완료', delivered_at: deliveredAt, auto_confirm_at: autoAt } as any).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: '배송완료', delivered_at: deliveredAt, auto_confirm_at: autoAt } : r)))
    setTab('배송완료')
  }

  const moveToPrep = async (id: string) => {
    const { error } = await supabase.from('orders').update({ status: '발송준비' }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: '발송준비' } : r)))
    setTab('발송준비')
  }

  const bulkMoveToPrep = async () => {
    const ids = Array.from(selectedIds).filter((id) => rows.some((r) => r.id === id && r.status === '주문확인'))
    if (!ids.length) {
      alert('주문확인 상태인 주문을 선택해주세요')
      return
    }
    const { error } = await supabase.from('orders').update({ status: '발송준비' }).in('id', ids)
    if (error) {
      alert(error.message)
      return
    }
    const idSet = new Set(ids)
    setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, status: '발송준비' } : r)))
    setSelectedIds(new Set())
    setTab('발송준비')
    setToastMsg(`${ids.length}건 처리됐습니다`)
    window.setTimeout(() => setToastMsg(''), 2500)
  }

  const bulkAutoConfirm = async () => {
    const targets = rows.filter((r) => {
      if (r.status !== '배송완료') return false
      const base = new Date(r.delivered_at || r.shipped_at || r.ordered_at || '').getTime()
      if (!base) return false
      const remain = autoConfirmDays - Math.floor((Date.now() - base) / 86400000)
      return remain <= 0
    })
    if (!targets.length) {
      setToastMsg('자동확정 대상이 없습니다')
      window.setTimeout(() => setToastMsg(''), 2000)
      return
    }
    for (const t of targets) {
      await confirmOrderById(supabase as any, t.id)
    }
    setRows((prev) =>
      prev.map((r) => (targets.some((t) => t.id === r.id) ? { ...r, status: '구매확정', confirmed_at: new Date().toISOString() } : r))
    )
    setToastMsg(`${targets.length}건 자동확정 처리`)
    window.setTimeout(() => setToastMsg(''), 2500)
  }

  const downloadCsv = () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const lines = [
      ['주문번호', '상태', '결제수단', '정가', '쿠폰할인', '토스트', '실결제', '주문일', '운송장'].join(','),
      ...filtered.map((r) => {
        const pay = String((r as any).payment_method ?? '').trim() || '-'
        const ta = Number(r.total_amount ?? 0) || 0
        const cd = Number(r.coupon_discount ?? 0) || 0
        const pt = Number((r as any).points_used ?? r.point_used ?? 0) || 0
        const fa = Number(r.final_amount ?? 0) || 0
        const dt = r.ordered_at ? new Date(r.ordered_at).toLocaleString('ko-KR') : ''
        const track = r.status === '배송중' || r.status === '배송완료' ? `${r.courier || ''} ${r.tracking_no || ''}`.trim() : ''
        return [esc(r.order_no), esc(r.status), esc(pay), String(ta), String(cd), String(pt), String(fa), esc(dt), esc(track)].join(',')
      }),
    ]
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadCjCsv = () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const cjRows = filtered.filter((r) => r.status === '주문확인' || r.status === '발송준비')
    const lines = [
      ['받는분', '받는분전화번호', '받는분주소', '품명', '수량', '주문번호', '고객메모'].join(','),
      ...cjRows.map((r) => [esc('-'), esc('-'), esc('-'), esc('AURAN 주문'), '1', esc(r.order_no), esc('-')].join(',')),
    ]
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cj_songjang_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadPrintCsv = () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const hdrs: string[] = []
    if (printCol.order_no) hdrs.push('주문번호')
    if (printCol.customer) hdrs.push('고객명')
    if (printCol.status) hdrs.push('주문상태')
    if (printCol.pay) hdrs.push('결제수단')
    if (printCol.total) hdrs.push('정가')
    if (printCol.coupon) hdrs.push('쿠폰할인')
    if (printCol.toast) hdrs.push('토스트사용')
    if (printCol.final) hdrs.push('실결제')
    if (printCol.tracking) hdrs.push('운송장번호')
    if (printCol.ordered) hdrs.push('주문일')
    if (printCol.adminMemo) hdrs.push('본사메모')
    if (printCol.customerMemo) hdrs.push('고객메모')
    const lines = [
      hdrs.join(','),
      ...printRows.map((r) => {
        const prT = (r as any).profiles
        const pTop = Array.isArray(prT) ? prT[0] : prT
        const uEmb = (r as any).users
        const uOne = Array.isArray(uEmb) ? uEmb[0] : uEmb
        const prN = uOne?.profiles
        const prof = (Array.isArray(prN) ? prN[0] : prN) || pTop
        const em0 = String(prof?.email ?? '').trim()
        const custDisp =
          String(prof?.username ?? '').trim() ||
          (em0.indexOf('@') > 0 ? em0.slice(0, em0.indexOf('@')) : em0) ||
          (r.customer_id ? String(r.customer_id).slice(0, 8) : '—')
        const pay = String((r as any).payment_method ?? '').trim() || '-'
        const ta = Number(r.total_amount ?? 0) || 0
        const cd = Number(r.coupon_discount ?? 0) || 0
        const pt = Number((r as any).points_used ?? r.point_used ?? 0) || 0
        const fa = Number(r.final_amount ?? 0) || 0
        const dt = r.ordered_at ? new Date(r.ordered_at).toLocaleString('ko-KR') : ''
        const track = `${r.courier || ''} ${r.tracking_no || ''}`.trim()
        const cells: string[] = []
        if (printCol.order_no) cells.push(esc(r.order_no))
        if (printCol.customer) cells.push(esc(custDisp))
        if (printCol.status) cells.push(esc(r.status))
        if (printCol.pay) cells.push(esc(pay))
        if (printCol.total) cells.push(String(ta))
        if (printCol.coupon) cells.push(String(cd))
        if (printCol.toast) cells.push(String(pt))
        if (printCol.final) cells.push(String(fa))
        if (printCol.tracking) cells.push(esc(track))
        if (printCol.ordered) cells.push(esc(dt))
        if (printCol.adminMemo) cells.push(esc(String((r as any).admin_order_notes || '').trim()))
        if (printCol.customerMemo) cells.push(esc(String((r as any).customer_memo || '').trim()))
        return cells.join(',')
      }),
    ]
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders_print_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const applyBulkTracking = async () => {
    if (!bulkPreview.length) return
    setBulkBusy(true)
    setBulkResult(null)
    let ok = 0
    let fail = 0
    const now = new Date().toISOString()
    const updates: { id: string; tracking: string; courier: string }[] = []
    for (const row of bulkPreview) {
      const o = rows.find((r) => String(r.order_no).trim() === String(row.order_no).trim())
      if (!o) {
        fail++
        continue
      }
      const courier = (row.courier || '').trim() || 'CJ대한통운'
      const tracking = String(row.tracking_no).trim()
      if (!tracking) {
        fail++
        continue
      }
      const { error } = await supabase.from('orders').update({ status: '배송중', tracking_no: tracking, courier, shipped_at: now }).eq('id', o.id)
      if (error) {
        fail++
        continue
      }
      const body =
        `[AURAN] 주문이 발송됐습니다.\n` +
        `운송장번호: ${tracking}\n` +
        `주문번호: ${o.order_no}\n\n` +
        `배송조회: https://auran.kr/track/\n` +
        `문의: support@auran.kr`
      await tryNotifyCustomer(o.customer_id, '🚚 발송 안내', body)
      ok++
      updates.push({ id: o.id, tracking, courier })
    }
    if (updates.length) {
      setRows((prev) =>
        prev.map((r) => {
          const u = updates.find((x) => x.id === r.id)
          return u ? { ...r, status: '배송중', tracking_no: u.tracking, courier: u.courier, shipped_at: now } : r
        })
      )
    }
    setBulkResult(`처리 완료: 성공 ${ok}건 / 실패 ${fail}건`)
    if (ok > 0) setTab('배송중')
    setBulkBusy(false)
  }

  const tabs: TabKey[] = ['주문확인', '발송준비', '배송중', '배송완료', '취소/환불', '전체']

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">📦 주문 통합 관리</div>
            <div className="card-sub">탭 필터 · 최근 500건</div>
          </div>
          <div className="card-acts">
            <button type="button" className="btn btn-bl" onClick={downloadCsv}>
              ⬇ CSV 다운로드
            </button>
            <button
              type="button"
              className="btn btn-bl"
              onClick={() => {
                setPrintOpen(true)
                setPrintPreviewMode(false)
                const t = new Date()
                const first = new Date(t.getFullYear(), t.getMonth(), 1)
                setPrintPeriodTab('이번달')
                setPrintDf(first.toISOString().slice(0, 10))
                setPrintDt(t.toISOString().slice(0, 10))
                setPrintYear(t.getFullYear())
              }}
            >
              🖨️ 출력
            </button>
            <button type="button" className="btn btn-bl" onClick={downloadCjCsv}>
              📦 CJ송장 양식 다운
            </button>
            {tab === '배송완료' ? (
              <button type="button" className="btn btn-gr" onClick={() => void bulkAutoConfirm()}>
                D-0 자동확정 처리
              </button>
            ) : null}
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>주문일</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, padding: '6px 8px' }} />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>~</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, padding: '6px 8px' }} />
            <button
              type="button"
              className="btn btn-gy"
              onClick={() => {
                const t = new Date()
                const s = t.toISOString().slice(0, 10)
                setDateFrom(s)
                setDateTo(s)
              }}
            >
              오늘
            </button>
            <button
              type="button"
              className="btn btn-gy"
              onClick={() => {
                const t = new Date()
                const wd = (t.getDay() + 6) % 7
                const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - wd)
                setDateFrom(mon.toISOString().slice(0, 10))
                setDateTo(t.toISOString().slice(0, 10))
              }}
            >
              이번주
            </button>
            <button
              type="button"
              className="btn btn-gy"
              onClick={() => {
                const t = new Date()
                const first = new Date(t.getFullYear(), t.getMonth(), 1)
                setDateFrom(first.toISOString().slice(0, 10))
                setDateTo(t.toISOString().slice(0, 10))
              }}
            >
              이번달
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>통합검색</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <select
                value={searchCat}
                onChange={(e) => {
                  setSearchCat(e.target.value)
                  setSearchPayPick('')
                  setSearchStatusPick('')
                  setSearchAmountPick('')
                  setSearchText('')
                }}
                style={{ minWidth: 160, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '8px 10px', outline: 'none' }}
              >
                <option value="">검색 카테고리</option>
                <option value="order_no">주문번호</option>
                <option value="customer_id">고객ID</option>
                <option value="payment">결제수단 (카드 / 무통장 / 토스트페이)</option>
                <option value="status">주문상태 (주문확인 / 발송준비 / 배송중 / 배송완료 / 취소 / 환불)</option>
                <option value="amount">금액대 (3만원대 / 5만원대 / 10만원 이상)</option>
              </select>
              {searchCat === 'order_no' || searchCat === 'customer_id' ? (
                <>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder={searchCat === 'order_no' ? '주문번호' : '고객ID'}
                    style={{ flex: 1, minWidth: 160, maxWidth: 360, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '8px 10px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-bl"
                    onClick={() => {
                      if (!searchCat || !searchText.trim()) return
                      setAppliedSearch({ t: searchCat, v: searchText.trim() })
                    }}
                  >
                    🔍 검색
                  </button>
                </>
              ) : null}
              {searchCat === 'payment' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['카드', '무통장', '토스트페이'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="btn"
                      onClick={() => setSearchPayPick(p)}
                      style={{
                        border: searchPayPick === p ? '1px solid var(--gold)' : '1px solid var(--border)',
                        color: searchPayPick === p ? 'var(--gold)' : 'var(--text2)',
                        background: searchPayPick === p ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
                        fontSize: 11,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : null}
              {searchCat === 'status' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['주문확인', '발송준비', '배송중', '배송완료', '취소', '환불'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="btn"
                      onClick={() => setSearchStatusPick(s)}
                      style={{
                        border: searchStatusPick === s ? '1px solid var(--gold)' : '1px solid var(--border)',
                        color: searchStatusPick === s ? 'var(--gold)' : 'var(--text2)',
                        background: searchStatusPick === s ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
                        fontSize: 11,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {searchCat === 'amount' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['3만원대', '5만원대', '10만 이상'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className="btn"
                      onClick={() => setSearchAmountPick(a)}
                      style={{
                        border: searchAmountPick === a ? '1px solid var(--gold)' : '1px solid var(--border)',
                        color: searchAmountPick === a ? 'var(--gold)' : 'var(--text2)',
                        background: searchAmountPick === a ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
                        fontSize: 11,
                      }}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="btn btn-gr"
                onClick={() => {
                  if (!searchCat) return
                  if (searchCat === 'order_no' || searchCat === 'customer_id') {
                    if (!searchText.trim()) return
                    setAppliedSearch({ t: searchCat, v: searchText.trim() })
                    return
                  }
                  if (searchCat === 'payment') {
                    if (!searchPayPick) return
                    setAppliedSearch({ t: 'payment', v: searchPayPick })
                    return
                  }
                  if (searchCat === 'status') {
                    if (!searchStatusPick) return
                    setAppliedSearch({ t: 'status', v: searchStatusPick })
                    return
                  }
                  if (searchCat === 'amount') {
                    if (!searchAmountPick) return
                    setAppliedSearch({ t: 'amount', v: searchAmountPick })
                  }
                }}
              >
                검색
              </button>
              <button
                type="button"
                className="btn btn-gy"
                onClick={() => {
                  setSearchCat('')
                  setSearchText('')
                  setSearchPayPick('')
                  setSearchStatusPick('')
                  setSearchAmountPick('')
                  setAppliedSearch({ t: 'none' })
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid var(--border)' }}>
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

        <div style={{ padding: '0 14px 12px', borderBottom: '1px solid var(--border)', display: tab === '발송준비' ? 'block' : 'none' }}>
          <button
            type="button"
            className="btn btn-bl"
            onClick={() => {
              setBulkOpen((v) => !v)
              if (bulkOpen) {
                setBulkPreview([])
                setBulkResult(null)
              }
            }}
          >
            📥 송장 일괄 업로드
          </button>
          {bulkOpen ? (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>CSV: 주문번호, 택배사, 송장번호 (첫 행 헤더)</div>
              <input
                key={bulkFileKey}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setBulkFileKey((k) => k + 1)
                  if (!f) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const text = String(reader.result || '').replace(/^\uFEFF/, '')
                    const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
                    if (rawLines.length < 2) {
                      setBulkPreview([])
                      setBulkResult('파일에 데이터가 없습니다.')
                      return
                    }
                    const parseLine = (line: string) => {
                      const cells: string[] = []
                      let c = ''
                      let q = false
                      for (let i = 0; i < line.length; i++) {
                        const ch = line[i]
                        if (ch === '"') {
                          q = !q
                          continue
                        }
                        if (ch === ',' && !q) {
                          cells.push(c.trim())
                          c = ''
                          continue
                        }
                        c += ch
                      }
                      cells.push(c.trim())
                      return cells.map((x) => x.replace(/^"(.*)"$/, '$1'))
                    }
                    const head = parseLine(rawLines[0])
                    const iNo = head.findIndex((h) => h.includes('주문번호'))
                    const iCr = head.findIndex((h) => h.includes('택배'))
                    const iTr = head.findIndex((h) => h.includes('송장'))
                    if (iNo < 0 || iCr < 0 || iTr < 0) {
                      setBulkPreview([])
                      setBulkResult('헤더에 주문번호, 택배사, 송장번호 컬럼이 필요합니다.')
                      return
                    }
                    const out: { order_no: string; courier: string; tracking_no: string }[] = []
                    for (let li = 1; li < rawLines.length; li++) {
                      const cells = parseLine(rawLines[li])
                      if (cells.length < Math.max(iNo, iCr, iTr) + 1) continue
                      const order_no = (cells[iNo] || '').trim()
                      const courier = (cells[iCr] || '').trim()
                      const tracking_no = (cells[iTr] || '').trim()
                      if (!order_no || !tracking_no) continue
                      out.push({ order_no, courier, tracking_no })
                    }
                    setBulkPreview(out)
                    setBulkResult(out.length ? `미리보기 ${out.length}건` : '유효한 행이 없습니다.')
                  }
                  reader.readAsText(f, 'UTF-8')
                }}
                style={{ fontSize: 11, color: 'var(--text2)' }}
              />
              {bulkPreview.length > 0 ? (
                <div style={{ marginTop: 10, maxHeight: 220, overflow: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>주문번호</th>
                        <th>택배사</th>
                        <th>송장번호</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((b, i) => (
                        <tr key={i}>
                          <td className="mono" style={{ fontSize: 10 }}>
                            {b.order_no}
                          </td>
                          <td style={{ fontSize: 10 }}>{b.courier}</td>
                          <td className="mono" style={{ fontSize: 10 }}>
                            {b.tracking_no}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button type="button" className="btn btn-gr" disabled={bulkBusy || !bulkPreview.length} onClick={() => void applyBulkTracking()}>
                  {bulkBusy ? '처리 중...' : '일괄 적용'}
                </button>
                {bulkResult ? <span style={{ fontSize: 11, color: 'var(--text2)' }}>{bulkResult}</span> : null}
              </div>
            </div>
          ) : null}
        </div>

        {selectedIds.size > 0 ? (
          <div
            style={{
              padding: '10px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid var(--border)',
              background: 'rgba(201,168,76,.06)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>{selectedIds.size}건 선택됨</span>
            <button type="button" className="btn btn-bl" onClick={() => void bulkMoveToPrep()}>
              📦 일괄 발송준비
            </button>
            <button
              type="button"
              className="btn btn-gr"
              onClick={() => {
                const prepIds = Array.from(selectedIds).filter((id) => rows.some((r) => r.id === id && r.status === '발송준비'))
                if (!prepIds.length) {
                  alert('발송준비 상태인 주문을 선택해주세요')
                  return
                }
                const o = rows.find((r) => r.id === prepIds[0])
                if (!o) return
                openShipModal(o, prepIds)
              }}
            >
              ✅ 일괄 발송완료
            </button>
            <button type="button" className="btn btn-gy" onClick={() => setSelectedIds(new Set())}>
              ❌ 선택 해제
            </button>
          </div>
        ) : null}

        {loading ? (
          <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
                    onChange={() => {
                      const fids = filtered.map((r) => r.id)
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        const allOn = fids.length > 0 && fids.every((id) => next.has(id))
                        if (allOn) {
                          fids.forEach((id) => next.delete(id))
                        } else {
                          fids.forEach((id) => next.add(id))
                        }
                        return next
                      })
                    }}
                  />
                </th>
                <th style={{ width: 28 }}>VIP</th>
                <th>고객ID</th>
                <th>주문번호</th>
                <th>상태</th>
                <th>결제수단</th>
                <th>정가</th>
                <th>쿠폰할인</th>
                <th>토스트</th>
                <th>실결제</th>
                <th>운송장</th>
                <th>주문일</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const pay = String((o as any).payment_method ?? '').trim() || '-'
                const cd = Number(o.coupon_discount ?? 0) || 0
                const toastPts = Number((o as any).points_used ?? o.point_used ?? 0) || 0
                const trk = String(o.tracking_no || '').trim()
                const cr = String(o.courier || '').trim()
                let trackHref = ''
                if (trk) {
                  if (cr.includes('CJ') || cr.includes('대한통운')) trackHref = `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trk)}`
                  else if (cr.includes('한진')) trackHref = `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trk)}`
                  else if (cr.includes('롯데')) trackHref = `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trk)}`
                  else if (cr.includes('우체국')) trackHref = `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trk)}`
                  else if (cr.includes('로젠')) trackHref = `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trk)}`
                }
                const trackCell =
                  o.status === '배송중' || o.status === '배송완료' ? (
                    <span className="mono" style={{ fontSize: 10 }}>
                      {(o.courier || '-') + ' · '}
                      {trackHref ? (
                        <a href={trackHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                          {trk}
                        </a>
                      ) : (
                        trk || '-'
                      )}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text3)' }}>—</span>
                  )
                const staleOrder =
                  o.status === '주문확인' &&
                  !!o.ordered_at &&
                  Date.now() - new Date(o.ordered_at).getTime() >= 3 * 24 * 60 * 60 * 1000
                const shipRef = o.shipped_at || o.ordered_at || ''
                const shipLate =
                  o.status === '배송중' &&
                  !!shipRef &&
                  Date.now() - new Date(shipRef).getTime() >= 7 * 24 * 60 * 60 * 1000
                const rowWarn = staleOrder || shipLate
                const st = o.status
                const stCls =
                  st === '배송완료'
                    ? 'b b-gd'
                    : st === '배송중'
                      ? 'b b-pu'
                      : st === '발송준비'
                        ? 'b b-bl'
                        : st === '취소' || st === '환불' || st === '취소/환불'
                          ? 'b b-re'
                          : 'b b-gy'
                const prT = (o as any).profiles
                const pTop = Array.isArray(prT) ? prT[0] : prT
                const uEmb = (o as any).users
                const uOne = Array.isArray(uEmb) ? uEmb[0] : uEmb
                const prN = uOne?.profiles
                const prof = (Array.isArray(prN) ? prN[0] : prN) || pTop
                const ug = String(uOne?.customer_grade ?? prof?.grade ?? (o as any).profiles?.grade ?? '').trim()
                const isVip = ug === 'NOIR' || ug === 'CÉLESTE' || ug === 'CELESTE'
                const em0 = String(prof?.email ?? '').trim()
                const custDisp =
                  String(prof?.username ?? '').trim() ||
                  (em0.indexOf('@') > 0 ? em0.slice(0, em0.indexOf('@')) : em0) ||
                  (o.customer_id ? String(o.customer_id).slice(0, 8) : '—')
                return (
                  <tr key={o.id} style={{ background: rowWarn ? 'rgba(255,80,80,0.07)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(o.id)) next.delete(o.id)
                            else next.add(o.id)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 14 }}>{isVip ? '💜' : ''}</td>
                    <td className="mono" style={{ fontSize: 9, maxWidth: 120 }}>
                      {o.customer_id ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => setHistoryCustomerId(o.customer_id!)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setHistoryCustomerId(o.customer_id!)
                          }}
                          style={{ color: 'var(--gold)', cursor: 'pointer', wordBreak: 'break-all' }}
                        >
                          {custDisp}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="mono">
                      {rowWarn ? (
                        <span
                          title={
                            staleOrder && shipLate
                              ? '주문확인 3일+ · 배송중 7일+'
                              : staleOrder
                                ? '주문확인 3일 이상 경과'
                                : '배송중 7일 이상 경과'
                          }
                          style={{ marginRight: 2 }}
                        >
                          🔴
                        </span>
                      ) : null}
                      {o.order_no}
                    </td>
                    <td>
                      <span className={stCls}>{o.status}</span>
                      {o.status === '배송완료' ? (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: (() => {
                              const base = new Date(o.delivered_at || o.shipped_at || o.ordered_at || '').getTime()
                              const remain = autoConfirmDays - Math.floor((Date.now() - base) / 86400000)
                              if (remain <= 3) return 'rgba(255,100,100,0.2)'
                              if (remain <= 6) return 'rgba(201,169,110,0.2)'
                              return 'rgba(255,255,255,0.12)'
                            })(),
                            color: (() => {
                              const base = new Date(o.delivered_at || o.shipped_at || o.ordered_at || '').getTime()
                              const remain = autoConfirmDays - Math.floor((Date.now() - base) / 86400000)
                              if (remain <= 3) return '#ff9d9d'
                              if (remain <= 6) return '#C9A96E'
                              return 'rgba(255,255,255,0.7)'
                            })(),
                          }}
                        >
                          {(() => {
                            const base = new Date(o.delivered_at || o.shipped_at || o.ordered_at || '').getTime()
                            const remain = autoConfirmDays - Math.floor((Date.now() - base) / 86400000)
                            return `D-${Math.max(0, remain)}`
                          })()}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ fontSize: 11 }}>{pay}</td>
                    <td className="mono">₩{Number(o.total_amount ?? 0).toLocaleString()}</td>
                    <td className="mono">₩{cd.toLocaleString()}</td>
                    <td className="mono">{toastPts.toLocaleString()}T</td>
                    <td className="mono" style={{ color: 'var(--gold)' }}>
                      ₩{Number(o.final_amount ?? 0).toLocaleString()}
                    </td>
                    <td>{trackCell}</td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {o.status === '주문확인' ? (
                          <button type="button" className="btn btn-bl" onClick={() => void moveToPrep(o.id)}>
                            📦 발송준비로
                          </button>
                        ) : null}
                        {o.status === '발송준비' ? (
                          <button type="button" className="btn btn-gr" onClick={() => openShipModal(o)}>
                            🚚 발송처리
                          </button>
                        ) : null}
                        {o.status === '배송중' ? (
                          <button type="button" className="btn btn-gd" onClick={() => void markDelivered(o.id)}>
                            ✅ 발송완료
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-gy"
                          onClick={() => {
                            setMemoDetailId(o.id)
                            setMemoDraft(String((o as any).admin_order_notes || ''))
                          }}
                        >
                          📋
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ color: 'var(--text3)' }}>
                    주문이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}

        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text2)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span className="mono">
            총 {stats.n}건 | 정가 합계 ₩{stats.sumTotal.toLocaleString()} | 쿠폰할인 합계 ₩{stats.sumCoupon.toLocaleString()} | 토스트 합계{' '}
            {stats.sumToast.toLocaleString()}T | 실결제 합계 <span style={{ color: 'var(--gold)' }}>₩{stats.sumFinal.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {modalId && current && (
        <div
          onClick={() => {
            setModalId(null)
            setShipBulkIds(null)
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderTop: '2px solid var(--gold)', borderRadius: 14, padding: 26, minWidth: 460, maxWidth: 600, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>🚚 발송 처리</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} className="mono">
                  {current.order_no}
                  {shipBulkIds && shipBulkIds.length > 1 ? ` · 외 ${shipBulkIds.length - 1}건 동일 송장` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalId(null)
                  setShipBulkIds(null)
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>택배사</div>
                <select value={modalCourier} onChange={(e) => setModalCourier(e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '8px 11px', outline: 'none' }}>
                  {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '로젠택배'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>운송장 번호</div>
                <input value={modalTracking} onChange={(e) => setModalTracking(e.target.value)} placeholder="운송장 번호" style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '8px 11px', outline: 'none', fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={giftCheck} onChange={(e) => setGiftCheck(e.target.checked)} />
              증정 여부
            </label>
            {giftCheck ? (
              <textarea
                value={giftText}
                onChange={(e) => setGiftText(e.target.value)}
                rows={2}
                placeholder="증정 내용"
                style={{
                  width: '100%',
                  marginTop: 8,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '8px 11px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            ) : null}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={cardCheck} onChange={(e) => setCardCheck(e.target.checked)} />
              선물 카드 문구
            </label>
            {cardCheck ? (
              <textarea
                value={cardText}
                onChange={(e) => setCardText(e.target.value)}
                rows={2}
                placeholder="카드 문구"
                style={{
                  width: '100%',
                  marginTop: 8,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '8px 11px',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            ) : null}

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>본사 내부 메모 (비공개)</div>
              <textarea
                value={internalMemo}
                onChange={(e) => setInternalMemo(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '10px 11px',
                  outline: 'none',
                  lineHeight: 1.6,
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>고객 알림 문구 (직접 수정 가능)</div>
              <textarea
                value={modalMsg}
                onChange={(e) => setModalMsg(e.target.value)}
                rows={6}
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '10px 11px', outline: 'none', lineHeight: 1.7, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-gy"
                onClick={() => {
                  setModalId(null)
                  setShipBulkIds(null)
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-gy"
                onClick={async () => {
                  try {
                    let extraMsg = ''
                    if (giftCheck && giftText.trim()) extraMsg += `\n\n[증정] ${giftText.trim()}`
                    if (cardCheck && cardText.trim()) extraMsg += `\n\n[선물 카드] ${cardText.trim()}`
                    await navigator.clipboard.writeText(modalMsg + extraMsg)
                  } catch {}
                }}
              >
                💬 문구 복사
              </button>
              <button type="button" className="btn btn-gr" onClick={() => void shipFromModal()} disabled={modalSaving} style={{ opacity: modalSaving ? 0.7 : 1 }}>
                {modalSaving ? '처리 중...' : '🚚 발송 완료 + 알림 기록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {memoDetailId && memoOrder && (
        <div
          onClick={() => setMemoDetailId(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderTop: '2px solid var(--gold)', borderRadius: 14, padding: 26, minWidth: 420, maxWidth: 560, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>📋 주문 메모</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} className="mono">
                  {memoOrder.order_no}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
                  <span className={memoOrder.status === '배송완료' ? 'b b-gd' : memoOrder.status === '배송중' ? 'b b-pu' : memoOrder.status === '발송준비' ? 'b b-bl' : memoOrder.status === '취소' || memoOrder.status === '환불' || memoOrder.status === '취소/환불' ? 'b b-re' : 'b b-gy'}>{memoOrder.status}</span>
                  {' · '}
                  {String((memoOrder as any).payment_method ?? '').trim() || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10, lineHeight: 1.7 }}>
                  정가 ₩{Number(memoOrder.total_amount ?? 0).toLocaleString()} → 쿠폰할인 -₩{Number(memoOrder.coupon_discount ?? 0).toLocaleString()} → 토스트 -{Number((memoOrder as any).points_used ?? memoOrder.point_used ?? 0).toLocaleString()}T → 실결제{' '}
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>₩{Number(memoOrder.final_amount ?? 0).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>운송장</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {(() => {
                      const trk = String(memoOrder.tracking_no || '').trim()
                      const cr = String(memoOrder.courier || '').trim()
                      let trackHref = ''
                      if (trk) {
                        if (cr.includes('CJ') || cr.includes('대한통운')) trackHref = `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(trk)}`
                        else if (cr.includes('한진')) trackHref = `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(trk)}`
                        else if (cr.includes('롯데')) trackHref = `https://www.lotteglogis.com/open/tracking?invno=${encodeURIComponent(trk)}`
                        else if (cr.includes('우체국')) trackHref = `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(trk)}`
                        else if (cr.includes('로젠')) trackHref = `https://www.ilogen.com/m/personal/trace/${encodeURIComponent(trk)}`
                      }
                      if (memoOrder.status === '배송중' || memoOrder.status === '배송완료') {
                        return (
                          <span className="mono" style={{ fontSize: 11 }}>
                            {(memoOrder.courier || '-') + ' · '}
                            {trackHref ? (
                              <a href={trackHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
                                {trk}
                              </a>
                            ) : (
                              trk || '-'
                            )}
                          </span>
                        )
                      }
                      return <span style={{ color: 'var(--text3)' }}>—</span>
                    })()}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setMemoDetailId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>본사 내부 메모</div>
              <textarea
                value={memoDraft}
                onChange={(e) => setMemoDraft(e.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '10px 11px',
                  outline: 'none',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>고객 메모</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, padding: '10px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, minHeight: 44 }}>
                {String((memoOrder as any).customer_memo || '').trim() || '-'}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-gy" onClick={() => setMemoDetailId(null)}>
                닫기
              </button>
              <button
                type="button"
                className="btn btn-gr"
                disabled={memoSaving}
                style={{ opacity: memoSaving ? 0.7 : 1 }}
                onClick={() => {
                  void (async () => {
                    if (!memoDetailId) return
                    setMemoSaving(true)
                    try {
                      const { error } = await supabase.from('orders').update({ admin_order_notes: memoDraft } as any).eq('id', memoDetailId)
                      if (error) {
                        alert(error.message)
                        return
                      }
                      setRows((prev) => prev.map((r) => (r.id === memoDetailId ? { ...r, admin_order_notes: memoDraft } : r)))
                      setToastMsg('저장됐습니다')
                      window.setTimeout(() => setToastMsg(''), 2500)
                    } finally {
                      setMemoSaving(false)
                    }
                  })()
                }}
              >
                {memoSaving ? '저장 중...' : '메모 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyCustomerId ? (
        <div
          onClick={() => setHistoryCustomerId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 125,
            background: 'rgba(0,0,0,.45)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(400px, 100vw)',
              height: '100%',
              background: 'var(--bg2)',
              borderLeft: '1px solid var(--border)',
              overflowY: 'auto',
              padding: '18px 16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>고객 주문 히스토리</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{historyHeaderDisplay}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, wordBreak: 'break-all' }}>
                  {historyCustomerId}
                </div>
              </div>
              <button type="button" onClick={() => setHistoryCustomerId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: '1 1 120px', padding: '10px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 4 }}>총 주문</div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{historyStats.n}건</div>
              </div>
              <div style={{ flex: '1 1 120px', padding: '10px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 4 }}>정가 합계</div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>
                  ₩{historyStats.sumTotal.toLocaleString()}
                </div>
              </div>
              <div style={{ flex: '1 1 120px', padding: '10px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 4 }}>쿠폰 할인 합계</div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>
                  ₩{historyStats.sumCoupon.toLocaleString()}
                </div>
              </div>
              <div style={{ flex: '1 1 120px', padding: '10px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 4 }}>토스트 사용 합계</div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>
                  {historyStats.sumToast.toLocaleString()}T
                </div>
              </div>
              <div style={{ flex: '1 1 120px', padding: '10px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 4 }}>실결제 합계</div>
                <div className="mono" style={{ fontWeight: 700, color: 'var(--gold)' }}>
                  ₩{historyStats.sumFinal.toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyOrders.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>최근 500건 로드 범위에 해당 고객 주문이 없습니다.</div>
              ) : null}
              {historyOrders.map((h) => (
                <div
                  key={h.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setMemoDetailId(h.id)
                    setMemoDraft(String((h as any).admin_order_notes || ''))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setMemoDetailId(h.id)
                      setMemoDraft(String((h as any).admin_order_notes || ''))
                    }
                  }}
                  style={{
                    padding: '10px 10px',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <div className="mono" style={{ color: 'var(--gold)', marginBottom: 4 }}>
                    {h.order_no}
                  </div>
                  <div style={{ color: 'var(--text2)' }}>
                    {h.status} · ₩{Number(h.final_amount ?? 0).toLocaleString()}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                    {h.ordered_at ? new Date(h.ordered_at).toLocaleString('ko-KR') : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {printOpen ? (
        <div
          onClick={() => {
            setPrintOpen(false)
            setPrintPreviewMode(false)
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `@media print { body * { visibility: hidden !important; } #print-area, #print-area * { visibility: visible !important; } #print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: #fff !important; color: #000 !important; } .print-hide { display: none !important; } }`,
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderTop: '2px solid var(--gold)',
              borderRadius: 14,
              padding: 22,
              minWidth: 360,
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: printPreviewMode ? 'none' : 'block',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>🖨️ 출력 설정</div>
              <button
                type="button"
                onClick={() => {
                  setPrintOpen(false)
                  setPrintPreviewMode(false)
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>기간 선택</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {(['오늘', '이번주', '이번달', '연도별', '날짜지정'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPrintPeriodTab(p)
                    const t = new Date()
                    if (p === '오늘') {
                      const s = t.toISOString().slice(0, 10)
                      setPrintDf(s)
                      setPrintDt(s)
                    } else if (p === '이번주') {
                      const wd = (t.getDay() + 6) % 7
                      const mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - wd)
                      setPrintDf(mon.toISOString().slice(0, 10))
                      setPrintDt(t.toISOString().slice(0, 10))
                    } else if (p === '이번달') {
                      const first = new Date(t.getFullYear(), t.getMonth(), 1)
                      setPrintDf(first.toISOString().slice(0, 10))
                      setPrintDt(t.toISOString().slice(0, 10))
                    } else if (p === '연도별') {
                      const y = printYear
                      setPrintDf(`${y}-01-01`)
                      setPrintDt(`${y}-12-31`)
                    }
                  }}
                  style={{
                    border: printPeriodTab === p ? '1px solid var(--gold)' : '1px solid var(--border)',
                    color: printPeriodTab === p ? 'var(--gold)' : 'var(--text2)',
                    background: printPeriodTab === p ? 'rgba(201,168,76,.12)' : 'var(--bg3)',
                    fontSize: 11,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            {printPeriodTab === '연도별' ? (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 8 }}>연도</span>
                <select
                  value={printYear}
                  onChange={(e) => {
                    const y = Number(e.target.value)
                    setPrintYear(y)
                    setPrintPeriodTab('연도별')
                    setPrintDf(`${y}-01-01`)
                    setPrintDt(`${y}-12-31`)
                  }}
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '6px 10px' }}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input
                type="date"
                value={printDf}
                onChange={(e) => {
                  setPrintDf(e.target.value)
                  setPrintPeriodTab('날짜지정')
                }}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, padding: '6px 8px' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>~</span>
              <input
                type="date"
                value={printDt}
                onChange={(e) => {
                  setPrintDt(e.target.value)
                  setPrintPeriodTab('날짜지정')
                }}
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 11, padding: '6px 8px' }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>출력 범위</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={printScope === 'tab'} onChange={() => setPrintScope('tab')} />
                현재 탭 기준 ({tab})
              </label>
              <label style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={printScope === 'all'} onChange={() => setPrintScope('all')} />
                전체 상태
              </label>
              <label style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={printScope === 'pick'} onChange={() => setPrintScope('pick')} />
                상태 다중 선택
              </label>
              {printScope === 'pick' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 22 }}>
                  {['주문확인', '발송준비', '배송중', '배송완료', '취소', '환불'].map((st) => (
                    <label key={st} style={{ fontSize: 11, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={!!printPick[st]}
                        onChange={() => setPrintPick((prev) => ({ ...prev, [st]: !prev[st] }))}
                      />
                      {st}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>출력 항목</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {(
                [
                  ['order_no', '주문번호'],
                  ['customer', '고객명'],
                  ['status', '주문상태'],
                  ['pay', '결제수단'],
                  ['total', '정가'],
                  ['coupon', '쿠폰할인'],
                  ['toast', '토스트사용'],
                  ['final', '실결제'],
                  ['tracking', '운송장번호'],
                  ['ordered', '주문일'],
                  ['adminMemo', '본사메모'],
                  ['customerMemo', '고객메모'],
                ] as [keyof typeof printCol, string][]
              ).map(([k, lab]) => (
                <label key={k} style={{ fontSize: 11, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={printCol[k]}
                    onChange={() => setPrintCol((prev) => ({ ...prev, [k]: !prev[k] }))}
                  />
                  {lab}
                </label>
              ))}
            </div>
            <label style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <input type="checkbox" checked={printIncludeStats} onChange={(e) => setPrintIncludeStats(e.target.checked)} />
              합계 통계 포함 (총 N건, 실결제 합계 등)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-bl" onClick={() => setPrintPreviewMode(true)}>
                미리보기
              </button>
              <button type="button" className="btn btn-gy" onClick={() => downloadPrintCsv()}>
                CSV 다운로드
              </button>
              <button
                type="button"
                className="btn btn-gr"
                onClick={() => {
                  setPrintPreviewMode(true)
                  window.setTimeout(() => window.print(), 400)
                }}
              >
                🖨️ 인쇄
              </button>
            </div>
          </div>
          {printPreviewMode ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 141,
                background: 'rgba(0,0,0,.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ width: 'min(900px, 100%)', maxHeight: '92vh', overflow: 'auto' }}>
                <div id="print-area" style={{ background: '#fff', color: '#000', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, marginBottom: 12 }}>AURAN</div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    출력일시:{' '}
                    {new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    조회기간: {printDf || '—'} ~ {printDt || '—'}
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 14 }}>총 {printStats.n}건</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, color: '#000' }}>
                    <thead>
                      <tr>
                        {printCol.order_no ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>주문번호</th> : null}
                        {printCol.customer ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>고객명</th> : null}
                        {printCol.status ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>주문상태</th> : null}
                        {printCol.pay ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>결제수단</th> : null}
                        {printCol.total ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>정가</th> : null}
                        {printCol.coupon ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>쿠폰할인</th> : null}
                        {printCol.toast ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>토스트</th> : null}
                        {printCol.final ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>실결제</th> : null}
                        {printCol.tracking ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>운송장번호</th> : null}
                        {printCol.ordered ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>주문일</th> : null}
                        {printCol.adminMemo ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>본사메모</th> : null}
                        {printCol.customerMemo ? <th style={{ border: '1px solid #000', padding: 6, background: '#f5f5f5' }}>고객메모</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {printRows.map((o) => {
                        const prT = (o as any).profiles
                        const pTop = Array.isArray(prT) ? prT[0] : prT
                        const uEmb = (o as any).users
                        const uOne = Array.isArray(uEmb) ? uEmb[0] : uEmb
                        const prN = uOne?.profiles
                        const prof = (Array.isArray(prN) ? prN[0] : prN) || pTop
                        const em0 = String(prof?.email ?? '').trim()
                        const custDisp =
                          String(prof?.username ?? '').trim() ||
                          (em0.indexOf('@') > 0 ? em0.slice(0, em0.indexOf('@')) : em0) ||
                          (o.customer_id ? String(o.customer_id).slice(0, 8) : '—')
                        const pay = String((o as any).payment_method ?? '').trim() || '-'
                        const ta = Number(o.total_amount ?? 0) || 0
                        const cd = Number(o.coupon_discount ?? 0) || 0
                        const pt = Number((o as any).points_used ?? o.point_used ?? 0) || 0
                        const fa = Number(o.final_amount ?? 0) || 0
                        const dt = o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : '—'
                        const track = `${o.courier || ''} ${o.tracking_no || ''}`.trim()
                        return (
                          <tr key={o.id}>
                            {printCol.order_no ? <td style={{ border: '1px solid #000', padding: 5 }}>{o.order_no}</td> : null}
                            {printCol.customer ? <td style={{ border: '1px solid #000', padding: 5 }}>{custDisp}</td> : null}
                            {printCol.status ? <td style={{ border: '1px solid #000', padding: 5 }}>{o.status}</td> : null}
                            {printCol.pay ? <td style={{ border: '1px solid #000', padding: 5 }}>{pay}</td> : null}
                            {printCol.total ? <td style={{ border: '1px solid #000', padding: 5 }}>₩{ta.toLocaleString()}</td> : null}
                            {printCol.coupon ? <td style={{ border: '1px solid #000', padding: 5 }}>₩{cd.toLocaleString()}</td> : null}
                            {printCol.toast ? <td style={{ border: '1px solid #000', padding: 5 }}>{pt.toLocaleString()}T</td> : null}
                            {printCol.final ? <td style={{ border: '1px solid #000', padding: 5 }}>₩{fa.toLocaleString()}</td> : null}
                            {printCol.tracking ? <td style={{ border: '1px solid #000', padding: 5 }}>{track || '—'}</td> : null}
                            {printCol.ordered ? <td style={{ border: '1px solid #000', padding: 5 }}>{dt}</td> : null}
                            {printCol.adminMemo ? (
                              <td style={{ border: '1px solid #000', padding: 5, maxWidth: 140, wordBreak: 'break-all' }}>{String((o as any).admin_order_notes || '').trim() || '—'}</td>
                            ) : null}
                            {printCol.customerMemo ? (
                              <td style={{ border: '1px solid #000', padding: 5, maxWidth: 140, wordBreak: 'break-all' }}>{String((o as any).customer_memo || '').trim() || '—'}</td>
                            ) : null}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {printIncludeStats ? (
                    <div style={{ marginTop: 16, fontSize: 11, lineHeight: 1.7, borderTop: '1px solid #000', paddingTop: 10 }}>
                      총 주문 {printStats.n}건 | 정가 합계 ₩{printStats.sumTotal.toLocaleString()} | 쿠폰할인 ₩{printStats.sumCoupon.toLocaleString()} | 토스트 {printStats.sumToast.toLocaleString()}T | 실결제 합계 ₩
                      {printStats.sumFinal.toLocaleString()}
                    </div>
                  ) : null}
                </div>
                <div
                  className="print-hide"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'flex-end', background: 'var(--bg2)', padding: 12, borderRadius: 8 }}
                >
                  <button type="button" className="btn btn-gy" onClick={() => setPrintPreviewMode(false)}>
                    ← 설정으로
                  </button>
                  <button type="button" className="btn btn-gr" onClick={() => window.print()}>
                    🖨️ 인쇄
                  </button>
                  <button type="button" className="btn btn-bl" onClick={() => downloadPrintCsv()}>
                    CSV 다운로드
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {toastMsg ? (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            padding: '12px 20px',
            background: 'rgba(201,168,76,0.95)',
            color: 'var(--bg)',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          }}
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  )
}
