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
  delivered_at?: string | null
  customer_id?: string | null
  admin_order_notes?: string | null
  users?: { name?: string | null; customer_grade?: string | null } | null
}

export default function AdminOrdersPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [tab, setTab] = useState<TabKey>('전체')

  const [shipModalId, setShipModalId] = useState<string | null>(null)
  const [shipCourier, setShipCourier] = useState('CJ대한통운')
  const [shipTracking, setShipTracking] = useState('')
  const [shipInternalMemo, setShipInternalMemo] = useState('')
  const [shipModalMsg, setShipModalMsg] = useState('')
  const [shipGiftCheck, setShipGiftCheck] = useState(false)
  const [shipGiftText, setShipGiftText] = useState('')
  const [shipCardCheck, setShipCardCheck] = useState(false)
  const [shipCardText, setShipCardText] = useState('')
  const [shipPrevCount, setShipPrevCount] = useState<number | null>(null)
  const [shipSaving, setShipSaving] = useState(false)

  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*, users(name, customer_grade)')
        .order('ordered_at', { ascending: false })
        .limit(500)
      if (error) {
        console.error('admin orders fetch', error)
        setRows([])
        setLoading(false)
        return
      }
      setRows((data || []) as any)
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
      const ta = Number(r.total_amount ?? 0) || 0
      const cd = Number(r.coupon_discount ?? 0) || 0
      const pt = Number((r as any).points_used ?? r.point_used ?? 0) || 0
      const fa = Number(r.final_amount ?? 0) || 0
      sumTotal += ta
      sumCoupon += cd
      sumToast += pt
      sumFinal += fa
    }
    return { n, sumTotal, sumCoupon, sumToast, sumFinal }
  }, [filtered])

  const currentShip = useMemo(() => rows.find((r) => r.id === shipModalId) || null, [rows, shipModalId])
  const currentDetail = useMemo(() => rows.find((r) => r.id === detailId) || null, [rows, detailId])

  const openShipModal = (o: OrderRow) => {
    setShipModalId(o.id)
    setShipCourier(o.courier || 'CJ대한통운')
    setShipTracking((o.tracking_no || '').trim())
    setShipInternalMemo(String((o as any).admin_order_notes || '').trim())
    setShipGiftCheck(false)
    setShipGiftText('')
    setShipCardCheck(false)
    setShipCardText('')
    setShipPrevCount(null)
    setShipModalMsg(
      `[AURAN] 주문이 발송됐습니다.\n` +
        `운송장번호: ${(o.tracking_no || '').trim() ? String(o.tracking_no) : '(입력 후 자동 반영)'}\n` +
        `주문번호: ${o.order_no}\n\n` +
        `배송조회: https://auran.kr/track/\n` +
        `문의: support@auran.kr`
    )
    void (async () => {
      if (!o.customer_id) {
        setShipPrevCount(0)
        return
      }
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', o.customer_id)
        .neq('id', o.id)
      setShipPrevCount(count ?? 0)
    })()
  }

  const shipFromModal = async () => {
    if (!shipModalId || !currentShip) return
    if (!shipTracking.trim()) {
      alert('운송장 번호를 입력해주세요')
      return
    }
    setShipSaving(true)
    const courier = shipCourier
    const tracking = shipTracking.trim()
    const now = new Date().toISOString()
    let extraMsg = ''
    if (shipGiftCheck && shipGiftText.trim()) extraMsg += `\n\n[증정] ${shipGiftText.trim()}`
    if (shipCardCheck && shipCardText.trim()) extraMsg += `\n\n[선물 카드] ${shipCardText.trim()}`
    const notifyBody = shipModalMsg + extraMsg
    const notesPayload = [
      shipInternalMemo.trim(),
      shipGiftCheck && shipGiftText.trim() ? `[증정] ${shipGiftText.trim()}` : '',
      shipCardCheck && shipCardText.trim() ? `[선물카드] ${shipCardText.trim()}` : '',
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
            ...(notesPayload ? { admin_order_notes: notesPayload } : {}),
          } as any)
          .eq('id', shipModalId)
      ).error
      if (err) {
        const r2 = await supabase.from('orders').update({ status: '배송중', tracking_no: tracking, courier, shipped_at: now }).eq('id', shipModalId)
        err = r2.error
        if (err) {
          alert(err.message)
          return
        }
      }
      if (currentShip.customer_id) {
        await supabase.from('notifications').insert({
          user_id: currentShip.customer_id,
          type: 'shipping',
          title: '🚚 발송 안내',
          body: notifyBody.replace('(입력 후 자동 반영)', tracking),
          icon: '🚚',
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === shipModalId ? { ...r, status: '배송중', tracking_no: tracking, courier, shipped_at: now, admin_order_notes: notesPayload || (r as any).admin_order_notes } : r
        )
      )
      setShipModalId(null)
    } finally {
      setShipSaving(false)
    }
  }

  const markDelivered = async (id: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: '배송완료', delivered_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: '배송완료', delivered_at: new Date().toISOString() } : r)))
  }

  const downloadCsv = () => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const lines = [
      ['주문번호', '고객명', '상태', '실결제', '주문일', '운송장'].join(','),
      ...filtered.map((r) => {
        const name = r.users?.name || ''
        const fa = Number(r.final_amount ?? 0) || 0
        const dt = r.ordered_at ? new Date(r.ordered_at).toLocaleString('ko-KR') : ''
        const track = r.status === '배송중' || r.status === '배송완료' ? `${r.courier || ''} ${r.tracking_no || ''}`.trim() : ''
        return [esc(r.order_no), esc(name), esc(r.status), String(fa), esc(dt), esc(track)].join(',')
      }),
    ]
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const tabs: TabKey[] = ['전체', '주문확인', '발송준비', '배송중', '배송완료', '취소/환불']

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-hdr">
          <div>
            <div className="card-title">📦 주문 통합 관리</div>
            <div className="card-sub">탭으로 필터 · 최근 500건</div>
          </div>
          <div className="card-acts">
            <button type="button" className="btn btn-bl" onClick={downloadCsv}>
              ⬇ 엑셀(CSV) 다운로드
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
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>고객명</th>
                <th>등급</th>
                <th>결제수단</th>
                <th>정가</th>
                <th>쿠폰할인</th>
                <th>토스트</th>
                <th>실결제</th>
                <th>상태</th>
                <th>운송장</th>
                <th>주문일</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const pay = String((o as any).payment_method ?? '').trim() || '—'
                const cd = Number(o.coupon_discount ?? 0) || 0
                const toastPts = Number((o as any).points_used ?? o.point_used ?? 0) || 0
                const trackCell =
                  o.status === '배송중' || o.status === '배송완료' ? (
                    <span className="mono" style={{ fontSize: 10 }}>
                      {(o.courier || '-') + ' · ' + (o.tracking_no || '-')}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text3)' }}>—</span>
                  )
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
                  <tr key={o.id}>
                    <td className="mono">{o.order_no}</td>
                    <td>{o.users?.name || '—'}</td>
                    <td>
                      <span className="b b-tl">{String(o.users?.customer_grade || 'welcome')}</span>
                    </td>
                    <td style={{ fontSize: 11 }}>{pay}</td>
                    <td className="mono">₩{Number(o.total_amount ?? 0).toLocaleString()}</td>
                    <td className="mono">₩{cd.toLocaleString()}</td>
                    <td className="mono">{toastPts.toLocaleString()}T</td>
                    <td className="mono" style={{ color: 'var(--gold)' }}>
                      ₩{Number(o.final_amount ?? 0).toLocaleString()}
                    </td>
                    <td>
                      <span className={stCls}>{o.status}</span>
                    </td>
                    <td>{trackCell}</td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {o.status === '주문확인' || o.status === '발송준비' ? (
                          <button type="button" className="btn btn-gr" onClick={() => openShipModal(o)}>
                            🚚 발송처리
                          </button>
                        ) : null}
                        {o.status === '배송중' ? (
                          <button type="button" className="btn btn-gd" onClick={() => void markDelivered(o.id)}>
                            ✅ 배송완료
                          </button>
                        ) : null}
                        <button type="button" className="btn btn-bl" onClick={() => setDetailId(o.id)}>
                          📋 상세
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ color: 'var(--text3)' }}>
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

      {shipModalId && currentShip ? (
        <div
          onClick={() => setShipModalId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderTop: '2px solid var(--gold)',
              borderRadius: 14,
              padding: 26,
              minWidth: 480,
              maxWidth: 640,
              width: '92%',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>🚚 발송 처리</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} className="mono">
                  {currentShip.order_no}
                </div>
              </div>
              <button type="button" onClick={() => setShipModalId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}>
                ×
              </button>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
              고객: <span style={{ color: 'var(--text)' }}>{currentShip.users?.name || '—'}</span>{' '}
              <span className="b b-tl">{String(currentShip.users?.customer_grade || 'welcome')}</span>
              <div style={{ marginTop: 6 }}>이전 구매 횟수(동일 고객 기타 주문): {shipPrevCount === null ? '…' : `${shipPrevCount}건`}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>택배사</div>
                <select
                  value={shipCourier}
                  onChange={(e) => setShipCourier(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    color: 'var(--text)',
                    fontSize: 12,
                    padding: '8px 11px',
                    outline: 'none',
                  }}
                >
                  {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '로젠택배'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>운송장 번호</div>
                <input
                  value={shipTracking}
                  onChange={(e) => setShipTracking(e.target.value)}
                  placeholder="운송장 번호"
                  style={{
                    width: '100%',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    color: 'var(--text)',
                    fontSize: 12,
                    padding: '8px 11px',
                    outline: 'none',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={shipGiftCheck} onChange={(e) => setShipGiftCheck(e.target.checked)} />
              증정 포함
            </label>
            {shipGiftCheck ? (
              <textarea
                value={shipGiftText}
                onChange={(e) => setShipGiftText(e.target.value)}
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
              <input type="checkbox" checked={shipCardCheck} onChange={(e) => setShipCardCheck(e.target.checked)} />
              선물 카드 발송
            </label>
            {shipCardCheck ? (
              <textarea
                value={shipCardText}
                onChange={(e) => setShipCardText(e.target.value)}
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
                value={shipInternalMemo}
                onChange={(e) => setShipInternalMemo(e.target.value)}
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
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>고객 알림 문구</div>
              <textarea
                value={shipModalMsg}
                onChange={(e) => setShipModalMsg(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '10px 11px',
                  outline: 'none',
                  lineHeight: 1.7,
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-gy" onClick={() => setShipModalId(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn btn-gy"
                onClick={async () => {
                  try {
                    let extraMsg = ''
                    if (shipGiftCheck && shipGiftText.trim()) extraMsg += `\n\n[증정] ${shipGiftText.trim()}`
                    if (shipCardCheck && shipCardText.trim()) extraMsg += `\n\n[선물 카드] ${shipCardText.trim()}`
                    await navigator.clipboard.writeText(shipModalMsg + extraMsg)
                  } catch {}
                }}
              >
                문구복사
              </button>
              <button type="button" className="btn btn-gr" onClick={() => void shipFromModal()} disabled={shipSaving} style={{ opacity: shipSaving ? 0.7 : 1 }}>
                {shipSaving ? '처리 중...' : '🚚 발송완료+알림기록'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailId && currentDetail ? (
        <div
          onClick={() => setDetailId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderTop: '2px solid var(--gold)',
              borderRadius: 14,
              padding: 26,
              minWidth: 400,
              maxWidth: 520,
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>📋 주문 상세</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} className="mono">
                  {currentDetail.order_no}
                </div>
              </div>
              <button type="button" onClick={() => setDetailId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>
                주문일: {currentDetail.ordered_at ? new Date(currentDetail.ordered_at).toLocaleString('ko-KR') : '—'}
              </div>
              <div>
                고객: {currentDetail.users?.name || '—'}{' '}
                <span className="b b-tl">{String(currentDetail.users?.customer_grade || 'welcome')}</span>
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 6 }}>금액</div>
                <div>정가: ₩{Number(currentDetail.total_amount ?? 0).toLocaleString()}</div>
                <div>쿠폰할인: −₩{Number(currentDetail.coupon_discount ?? 0).toLocaleString()}</div>
                <div>
                  토스트: −{Number((currentDetail as any).points_used ?? currentDetail.point_used ?? 0).toLocaleString()}T
                </div>
                <div style={{ color: 'var(--gold)', marginTop: 4 }}>
                  실결제: ₩{Number(currentDetail.final_amount ?? 0).toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                결제수단: {String((currentDetail as any).payment_method ?? '').trim() || '—'}
              </div>
              <div style={{ marginTop: 12 }}>
                배송: {(currentDetail.courier || '—') + ' · ' + (currentDetail.tracking_no || '—')}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 4 }}>본사 내부 메모</div>
                <div
                  style={{
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    padding: 10,
                    fontSize: 11,
                    color: 'var(--text2)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {String((currentDetail as any).admin_order_notes ?? '').trim() || '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" className="btn btn-gy" onClick={() => setDetailId(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
