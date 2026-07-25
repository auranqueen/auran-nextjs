'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
}
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'

type ClosingRow = {
  id: string
  closing_date: string
  order_batch_ids: string[] | null
  total_count: number | null
  submitted_by: string | null
  status: string | null
  confirmed_by: string | null
  confirmed_at: string | null
}

type OverdueBatch = {
  id: string
  order_no: string
  owner_name: string | null
  approved_at: string | null
}

type BatchBrief = {
  id: string
  order_no: string
  owner_name: string | null
  approved_at: string | null
}

interface Props {
  brandId: string
  brandName: string
}

function threeDaysAgoIso(): string {
  return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
}

function closingStatusLabel(status: string | null | undefined): '제출됨' | '확인완료' {
  return status === '확인완료' ? '확인완료' : '제출됨'
}

export default function BrandLogisticsClosingReview({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [overdue, setOverdue] = useState<OverdueBatch[]>([])
  const [closings, setClosings] = useState<ClosingRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedBatches, setExpandedBatches] = useState<Record<string, BatchBrief[]>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)

    const { data: orderRows } = await supabase
      .from('brand_orders')
      .select('batch_id')
      .eq('brand_id', brandId)
      .not('batch_id', 'is', null)

    const brandBatchIds = Array.from(
      new Set(
        ((orderRows || []) as Array<{ batch_id: string | null }>)
          .map((r) => r.batch_id)
          .filter((id): id is string => !!id),
      ),
    )

    const [{ data: closingRows }, overdueResult] = await Promise.all([
      supabase
        .from('brand_logistics_daily_closings')
        .select('id, closing_date, order_batch_ids, total_count, submitted_by, status, confirmed_by, confirmed_at')
        .eq('brand_id', brandId)
        .order('closing_date', { ascending: false })
        .limit(60),
      brandBatchIds.length === 0
        ? Promise.resolve({ data: [] as OverdueBatch[] })
        : supabase
            .from('brand_order_batches')
            .select('id, order_no, owner_name, approved_at')
            .in('id', brandBatchIds)
            .eq('status', '승인완료')
            .lt('approved_at', threeDaysAgoIso())
            .order('approved_at', { ascending: true })
            .limit(100),
    ])

    const closingsList = (closingRows || []) as ClosingRow[]
    setClosings(closingsList)

    const closedIds = new Set<string>()
    for (const c of closingsList) {
      for (const id of c.order_batch_ids || []) {
        if (id) closedIds.add(id)
      }
    }

    // Also include batch ids from any closing rows not in the limited list? We used brand-scoped closings for closed set.
    // Fetch all closed batch ids for this brand (lightweight) if list was truncated — re-query ids only.
    const { data: allClosingIds } = await supabase
      .from('brand_logistics_daily_closings')
      .select('order_batch_ids')
      .eq('brand_id', brandId)
    for (const c of (allClosingIds || []) as Array<{ order_batch_ids: string[] | null }>) {
      for (const id of c.order_batch_ids || []) {
        if (id) closedIds.add(id)
      }
    }

    const overdueRaw = ((overdueResult as { data?: OverdueBatch[] | null }).data || []) as OverdueBatch[]
    setOverdue(overdueRaw.filter((b) => !closedIds.has(b.id)))
    setLoading(false)
  }, [brandId])

  useEffect(() => { void load() }, [load])

  const toggleExpand = async (row: ClosingRow) => {
    if (expandedId === row.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(row.id)
    if (expandedBatches[row.id]) return
    const ids = (row.order_batch_ids || []).filter(Boolean)
    if (ids.length === 0) {
      setExpandedBatches((prev) => ({ ...prev, [row.id]: [] }))
      return
    }
    const { data } = await supabase
      .from('brand_order_batches')
      .select('id, order_no, owner_name, approved_at')
      .in('id', ids)
      .order('order_no', { ascending: true })
    setExpandedBatches((prev) => ({
      ...prev,
      [row.id]: (data || []) as BatchBrief[],
    }))
  }

  const confirmClosing = async (row: ClosingRow) => {
    if (closingStatusLabel(row.status) === '확인완료') return
    setBusyId(row.id)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('brand_logistics_daily_closings')
      .update({
        status: '확인완료',
        confirmed_by: brandName || sessionStorage.getItem('brand_staff_name') || '브랜드사',
        confirmed_at: now,
      })
      .eq('id', row.id)
    setBusyId(null)
    if (error) {
      showToast('확인 실패: ' + error.message)
      return
    }
    showToast('확인완료 처리됨')
    void load()
  }

  return (
    <div style={CARD}>
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
          background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px',
          borderRadius: 20, zIndex: 999,
        }}>{toast}</div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, marginBottom: open ? 12 : 0,
        }}
      >
        <div style={{ fontSize: 12, color: SUB }}>📋 물류 일일마감 확인</div>
        <span style={{ fontSize: 11, color: SUB }}>{open ? '접기' : '펼치기'}</span>
      </button>

      {open && (
        <>
          {overdue.length > 0 && (
            <div style={{
              marginBottom: 12, padding: 12, borderRadius: 8,
              background: 'rgba(229,57,53,0.12)', border: '0.5px solid rgba(229,57,53,0.45)',
            }}>
              <div style={{ fontSize: 13, color: DANGER, fontWeight: 600, marginBottom: 8 }}>
                승인 후 3일 넘게 마감 안 된 발주 {overdue.length}건
              </div>
              {overdue.map((b) => (
                <div key={b.id} style={{ fontSize: 11, color: TEXT, marginBottom: 4, lineHeight: 1.4 }}>
                  <span style={{ color: GOLD }}>{b.order_no}</span>
                  {' · '}
                  {b.owner_name || '원장님'}
                  {' · 승인 '}
                  {b.approved_at ? new Date(b.approved_at).toLocaleDateString('ko-KR') : '-'}
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중…</div>
          ) : closings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>마감 내역이 없어요</div>
          ) : (
            closings.map((row) => {
              const st = closingStatusLabel(row.status)
              const expanded = expandedId === row.id
              return (
                <div
                  key={row.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void toggleExpand(row)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                      cursor: 'pointer', padding: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>
                          {row.closing_date}
                          <span style={{ color: SUB, fontSize: 11, marginLeft: 8 }}>
                            {row.total_count ?? 0}건
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: SUB }}>
                          제출 {row.submitted_by || '-'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 10,
                          background: st === '확인완료' ? 'rgba(76,175,80,0.15)' : 'rgba(123,94,167,0.18)',
                          color: st === '확인완료' ? '#81c784' : '#c4a7e7',
                          border: `0.5px solid ${st === '확인완료' ? 'rgba(76,175,80,0.35)' : 'rgba(123,94,167,0.35)'}`,
                        }}>
                          {st}
                        </span>
                        <span style={{ fontSize: 11, color: SUB }}>{expanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                      {(expandedBatches[row.id] || []).length === 0 ? (
                        <div style={{ fontSize: 11, color: SUB }}>포함된 주문번호 없음</div>
                      ) : (
                        (expandedBatches[row.id] || []).map((b) => (
                          <div key={b.id} style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>
                            <span style={{ color: GOLD }}>{b.order_no}</span>
                            {' · '}
                            {b.owner_name || '원장님'}
                          </div>
                        ))
                      )}
                      {st === '제출됨' ? (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void confirmClosing(row)}
                          style={{
                            marginTop: 10, width: '100%', padding: '8px 12px', borderRadius: 7,
                            border: 'none', background: PURPLE, color: '#fff', fontSize: 12,
                            cursor: busyId === row.id ? 'wait' : 'pointer',
                            opacity: busyId === row.id ? 0.7 : 1,
                          }}
                        >
                          {busyId === row.id ? '처리 중…' : '확인완료'}
                        </button>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 11, color: SUB }}>
                          확인 {row.confirmed_by || '-'}
                          {row.confirmed_at ? ` · ${new Date(row.confirmed_at).toLocaleString('ko-KR')}` : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}