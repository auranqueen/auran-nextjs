'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
const BORDER = 'rgba(255,255,255,0.05)'

type StatusTab = '승인대기' | '승인완료' | '전체'

type OrderItem = {
  product_id?: string
  name: string
  qty: number
  unit_price?: number
  line_amount?: number
  bonus?: number
  promo?: string
}

type OrderRow = {
  id: string
  batch_id: string
  brand_id: string
  brand_name: string
  items: OrderItem[]
  promo_applied: string | null
  total_amount: number
  status: string
}

type BatchRow = {
  id: string
  order_no: string
  profile_id: string
  owner_name: string | null
  salon_name: string | null
  total_amount: number
  status: string
  created_at: string
  approved_at: string | null
  orders: OrderRow[]
}

interface Props {
  brandId: string
  brandName?: string
}

const BRAND_PALETTE = ['#7B5EA7', '#2188ff', '#3db864', '#E8A0BF', '#C9A96E', '#EF9F27', '#e85555']

function brandColor(brandId: string): string {
  let h = 0
  for (let i = 0; i < brandId.length; i++) h = (h + brandId.charCodeAt(i) * (i + 1)) % BRAND_PALETTE.length
  return BRAND_PALETTE[h]
}

function startOfDayIso(dateStr: string): string | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function endExclusiveIso(dateStr: string): string | null {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

export default function BrandOrderBatchApproval({ brandId, brandName = '' }: Props) {
  const supabase = createClient()
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StatusTab>('승인대기')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)

    let orderQ = supabase
      .from('brand_orders')
      .select('id, batch_id, brand_id, items, promo_applied, total_amount, status, brands(name)')
      .eq('brand_id', brandId)
      .not('batch_id', 'is', null)

    const fromIso = startOfDayIso(dateFrom)
    const toIso = endExclusiveIso(dateTo)
    if (fromIso) orderQ = orderQ.gte('created_at', fromIso)
    if (toIso) orderQ = orderQ.lt('created_at', toIso)

    const { data: orderRows } = await orderQ.limit(300)
    const ordersRaw = (orderRows || []) as Array<{
      id: string
      batch_id: string
      brand_id: string
      items: OrderItem[] | null
      promo_applied: string | null
      total_amount: number | null
      status: string
      brands?: { name?: string | null } | { name?: string | null }[] | null
    }>

    const batchIds = Array.from(new Set(ordersRaw.map((o) => o.batch_id).filter(Boolean)))
    if (batchIds.length === 0) {
      setBatches([])
      setLoading(false)
      return
    }

    let batchQ = supabase
      .from('brand_order_batches')
      .select('id, order_no, profile_id, owner_name, salon_name, total_amount, status, created_at, approved_at')
      .in('id', batchIds)
      .order('created_at', { ascending: false })

    if (statusTab !== '전체') {
      batchQ = batchQ.eq('status', statusTab)
    }

    const { data: batchRows } = await batchQ
    const batchList = (batchRows || []) as Array<{
      id: string
      order_no: string
      profile_id: string
      owner_name: string | null
      salon_name: string | null
      total_amount: number
      status: string
      created_at: string
      approved_at: string | null
    }>

    // 배치에 속한 전 브랜드 주문(같은 배치 내 타 브랜드 라인 포함 표시)
    const { data: allInBatches } = await supabase
      .from('brand_orders')
      .select('id, batch_id, brand_id, items, promo_applied, total_amount, status, brands(name)')
      .in('batch_id', batchList.map((b) => b.id))

    const allOrders = (allInBatches || []) as typeof ordersRaw
    const byBatch = new Map<string, OrderRow[]>()
    for (const o of allOrders) {
      const brandRel = Array.isArray(o.brands) ? o.brands[0] : o.brands
      const row: OrderRow = {
        id: o.id,
        batch_id: o.batch_id,
        brand_id: o.brand_id,
        brand_name: brandRel?.name || brandName || '브랜드',
        items: Array.isArray(o.items) ? o.items : [],
        promo_applied: o.promo_applied,
        total_amount: Math.trunc(Number(o.total_amount) || 0),
        status: o.status,
      }
      if (!byBatch.has(o.batch_id)) byBatch.set(o.batch_id, [])
      byBatch.get(o.batch_id)!.push(row)
    }

    setBatches(
      batchList.map((b) => ({
        ...b,
        orders: byBatch.get(b.id) || [],
      })),
    )
    setLoading(false)
  }, [brandId, brandName, dateFrom, dateTo, statusTab])

  useEffect(() => {
    void load()
  }, [load])

  const pendingCount = useMemo(
    () => batches.filter((b) => b.status === '승인대기').length,
    [batches],
  )

  const approveBatch = async (batch: BatchRow) => {
    if (batch.status !== '승인대기') return
    setBusyId(batch.id)
    const now = new Date().toISOString()
    const noteText = (notes[batch.id] || '').trim()
    const lines = noteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const { error: batchErr } = await supabase
      .from('brand_order_batches')
      .update({ status: '승인완료', approved_at: now })
      .eq('id', batch.id)

    if (batchErr) {
      showToast('승인 실패: ' + batchErr.message)
      setBusyId(null)
      return
    }

    if (lines.length > 0) {
      const { error: checkErr } = await supabase.from('brand_order_batch_checklist_items').insert(
        lines.map((label) => ({
          batch_id: batch.id,
          label,
          checked: false,
        })),
      )
      if (checkErr) {
        showToast('체크리스트 저장 실패: ' + checkErr.message)
        setBusyId(null)
        void load()
        return
      }
    }

    const { error: ordersErr } = await supabase
      .from('brand_orders')
      .update({ status: 'approved', updated_at: now })
      .eq('batch_id', batch.id)

    if (ordersErr) {
      showToast('주문 상태 갱신 실패: ' + ordersErr.message)
    } else {
      showToast('물류로 전달 완료!')
      setNotes((prev) => {
        const next = { ...prev }
        delete next[batch.id]
        return next
      })
    }
    setBusyId(null)
    void load()
  }

  return (
    <div style={CARD}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: SUB }}>
          📥 배치 발주 승인
          {pendingCount > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'rgba(255,193,7,0.15)', color: 'rgba(255,193,7,0.9)' }}>
              대기 {pendingCount}건
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['승인대기', '승인완료', '전체'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStatusTab(t)}
              style={{
                fontSize: 11,
                padding: '2px 10px',
                borderRadius: 20,
                border: `0.5px solid ${statusTab === t ? PURPLE : 'rgba(255,255,255,0.1)'}`,
                background: statusTab === t ? 'rgba(123,94,167,0.2)' : 'transparent',
                color: statusTab === t ? '#c4a7e7' : SUB,
                cursor: 'pointer',
              }}
            >
              {t === '승인완료' ? '승인완료(물류전달됨)' : t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: SUB }}>기간</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT }}
        />
        <span style={{ fontSize: 11, color: SUB }}>~</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT }}
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo('') }}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: SUB, cursor: 'pointer' }}
          >
            초기
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>불러오는 중...</div>
      ) : batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>
          {statusTab === '승인대기' ? '승인 대기 배치가 없어요' : '해당 조건의 배치 발주가 없어요'}
        </div>
      ) : (
        batches.map((batch) => {
          const waiting = batch.status === '승인대기'
          const done = batch.status === '승인완료'
          const badgeColor = waiting ? 'rgba(255,193,7,0.8)' : done ? GREEN : SUB
          return (
            <div key={batch.id} style={{ padding: '14px 0', borderBottom: `0.5px solid ${BORDER}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, color: TEXT, fontWeight: 500, marginBottom: 4 }}>{batch.order_no}</div>
                  <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>
                    {batch.owner_name || '원장님'} · {batch.salon_name || '-'}
                  </div>
                  <div style={{ fontSize: 11, color: SUB }}>
                    접수 {new Date(batch.created_at).toLocaleString('ko-KR')}
                    {batch.approved_at ? ` · 승인 ${new Date(batch.approved_at).toLocaleString('ko-KR')}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: `${badgeColor}22`, color: badgeColor, border: `0.5px solid ${badgeColor}55`, flexShrink: 0 }}>
                  {done ? '승인완료(물류전달됨)' : batch.status}
                </span>
              </div>

              {batch.orders.map((ord) => {
                const color = brandColor(ord.brand_id)
                return (
                  <div key={ord.id} style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: `${color}22`, color, border: `0.5px solid ${color}55` }}>
                        {ord.brand_name}
                      </span>
                    </div>
                    {ord.items.map((it, idx) => {
                      const bonus = Math.trunc(Number(it.bonus) || 0)
                      const promo = (it.promo || '').trim()
                      return (
                        <div key={`${ord.id}-${idx}`} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: TEXT }}>
                            <span>{it.name} × {it.qty}</span>
                            <span style={{ color: SUB, flexShrink: 0 }}>
                              ₩{Math.trunc(Number(it.line_amount) || (Number(it.unit_price) || 0) * it.qty).toLocaleString()}
                            </span>
                          </div>
                          {(promo || bonus > 0) && (
                            <div style={{ marginTop: 3 }}>
                              {promo && (
                                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: 'rgba(201,169,110,0.12)', color: GOLD, border: '0.5px solid rgba(201,169,110,0.3)', marginRight: 6 }}>
                                  {promo} 적용
                                </span>
                              )}
                              {bonus > 0 && (
                                <span style={{ fontSize: 11, color: SUB }}>증정: {it.name} × {bonus}개</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {ord.promo_applied && !ord.items.some((it) => it.promo) && (
                      <div style={{ fontSize: 11, color: GOLD, marginTop: 4 }}>{ord.promo_applied} 적용</div>
                    )}
                  </div>
                )
              })}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 10 }}>
                <span>합계</span>
                <span style={{ color: PURPLE }}>₩{Math.trunc(Number(batch.total_amount) || 0).toLocaleString()}</span>
              </div>

              {waiting && (
                <>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>물류 전달사항 (줄바꿈 = 체크리스트 항목)</div>
                  <textarea
                    value={notes[batch.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [batch.id]: e.target.value }))}
                    placeholder={'예)\n냉장 보관 필수\n파손주의 스티커 부착'}
                    rows={3}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      marginBottom: 10,
                      padding: 10,
                      borderRadius: 8,
                      border: '0.5px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: TEXT,
                      fontSize: 12,
                      resize: 'vertical',
                    }}
                  />
                  <button
                    type="button"
                    disabled={busyId === batch.id}
                    onClick={() => void approveBatch(batch)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: busyId === batch.id ? 'rgba(123,94,167,0.4)' : PURPLE,
                      color: '#fff',
                      fontSize: 13,
                      cursor: busyId === batch.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {busyId === batch.id ? '처리 중...' : '발주 승인 → 물류로 전달'}
                  </button>
                </>
              )}

              {done && (
                <button
                  type="button"
                  onClick={() => {
                    // TODO: A4 출력 연결 (다음 단계)
                  }}
                  style={{
                    fontSize: 12,
                    padding: '7px 14px',
                    borderRadius: 7,
                    border: `0.5px solid ${PURPLE}`,
                    background: 'rgba(123,94,167,0.15)',
                    color: '#c4a7e7',
                    cursor: 'pointer',
                  }}
                >
                  인쇄
                </button>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
