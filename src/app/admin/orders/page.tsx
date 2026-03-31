'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  customer_id?: string | null
  admin_order_notes?: string | null
  customer_memo?: string | null
}

const SELECT_FULL =
  'id, order_no, status, total_amount, final_amount, coupon_discount, points_used, payment_method, tracking_no, courier, ordered_at, shipped_at, admin_order_notes, customer_id, customer_memo'
const SELECT_FALLBACK =
  'id, order_no, status, total_amount, final_amount, coupon_discount, point_used, tracking_no, courier, ordered_at, shipped_at, customer_id'

export default function AdminOrdersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [tab, setTab] = useState<TabKey>('전체')

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

  const current = useMemo(() => rows.find((r) => r.id === modalId) || null, [modalId, rows])
  const memoOrder = useMemo(() => rows.find((r) => r.id === memoDetailId) || null, [memoDetailId, rows])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      let data: OrderRow[] | null = null
      const r1 = await supabase.from('orders').select(SELECT_FULL).order('ordered_at', { ascending: false }).limit(500)
      let fetchError = r1.error
      data = (r1.data as OrderRow[] | null) ?? null
      if (fetchError) {
        const r2 = await supabase.from('orders').select(SELECT_FALLBACK).order('ordered_at', { ascending: false }).limit(500)
        data = (r2.data as OrderRow[] | null) ?? null
        fetchError = r2.error
      }
      if (fetchError) {
        console.error('admin orders fetch', fetchError)
        setRows([])
      } else {
        setRows(data || [])
      }
      setLoading(false)
    }
    void run()
  }, [supabase])

  const filtered = useMemo(() => {
    return (rows || []).filter((r) => {
      if (tab === '전체') return true
      if (tab === '취소/환불') return r.status === '취소' || r.status === '환불'
      return r.status === tab
    })
  }, [rows, tab])

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

  const openShipModal = (o: OrderRow) => {
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
    if (!modalId || !current) return
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
    const notifyBody = modalMsg + extraMsg
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
          .eq('id', modalId)
      ).error
      if (err) {
        const r2 = await supabase.from('orders').update({ status: '배송중', tracking_no: tracking, courier, shipped_at: now }).eq('id', modalId)
        err = r2.error
        if (err) {
          alert(err.message)
          return
        }
      }
      await tryNotifyCustomer(current.customer_id, '🚚 발송 안내', notifyBody.replace('(입력 후 자동 반영)', tracking))
      setRows((prev) =>
        prev.map((r) =>
          r.id === modalId ? { ...r, status: '배송중', tracking_no: tracking, courier, shipped_at: now, admin_order_notes: notesPayload } : r
        )
      )
      setModalId(null)
      setTab((t) => (t === '주문확인' || t === '발송준비' ? '배송중' : t))
    } finally {
      setModalSaving(false)
    }
  }

  const markDelivered = async (id: string) => {
    const { error } = await supabase.from('orders').update({ status: '배송완료', delivered_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: '배송완료', delivered_at: new Date().toISOString() } : r)))
  }

  const moveToPrep = async (id: string) => {
    const { error } = await supabase.from('orders').update({ status: '발송준비' }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: '발송준비' } : r)))
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
    setBulkBusy(false)
  }

  const tabs: TabKey[] = ['전체', '주문확인', '발송준비', '배송중', '배송완료', '취소/환불']

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
            <button type="button" className="btn btn-bl" onClick={downloadCjCsv}>
              📦 CJ송장 양식 다운
            </button>
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
              {t === '배송완료' ? '발송완료' : t}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 14px 12px', borderBottom: '1px solid var(--border)' }}>
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

        {loading ? (
          <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <table>
            <thead>
              <tr>
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
                const stale =
                  (o.status === '주문확인' || o.status === '발송준비') &&
                  !!o.ordered_at &&
                  Date.now() - new Date(o.ordered_at).getTime() >= 3 * 24 * 60 * 60 * 1000
                const st = o.status
                const stCls =
                  st === '배송완료'
                    ? 'b b-gd'
                    : st === '배송중'
                      ? 'b b-pu'
                      : st === '발송준비'
                        ? 'b b-bl'
                        : st === '취소' || st === '환불'
                          ? 'b b-re'
                          : 'b b-gy'
                return (
                  <tr key={o.id} style={{ background: stale ? 'rgba(255,80,80,0.07)' : undefined }}>
                    <td className="mono">
                      {stale ? (
                        <span title="주문 후 3일 이상 미발송" style={{ marginRight: 2 }}>
                          🔴
                        </span>
                      ) : null}
                      {o.order_no}
                    </td>
                    <td>
                      <span className={stCls}>{o.status}</span>
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
                  <td colSpan={10} style={{ color: 'var(--text3)' }}>
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
          onClick={() => setModalId(null)}
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
                </div>
              </div>
              <button type="button" onClick={() => setModalId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}>
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
              <button type="button" className="btn btn-gy" onClick={() => setModalId(null)}>
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
          style={{ position: 'fixed', inset: 0, zIndex: 105, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderTop: '2px solid var(--gold)', borderRadius: 14, padding: 26, minWidth: 420, maxWidth: 520, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>📋 주문 메모</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} className="mono">
                  {memoOrder.order_no}
                </div>
              </div>
              <button type="button" onClick={() => setMemoDetailId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>고객 메모</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, padding: '10px 11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, minHeight: 44 }}>
                {String((memoOrder as any).customer_memo || '').trim() || '-'}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
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
