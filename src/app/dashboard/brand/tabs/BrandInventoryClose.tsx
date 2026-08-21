'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD: CSSProperties = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
}
interface InventoryRow {
  id: string
  product_name: string
  total_stock: number
  brand_id: string
}
interface CloseRow {
  id: string
  inventory_id: string
  year_month: string
  opening_stock: number
  total_in: number
  total_out: number
  total_return: number
  total_dispose: number
  closing_stock: number
  physical_stock: number | null
  difference: number | null
  closed_at: string | null
  closed_by: string | null
  memo: string | null
}
interface LogSummary {
  inventory_id: string
  total_in: number
  total_out: number
  total_return: number
  total_dispose: number
}
interface Props {
  brandId: string | null
}
export default function BrandInventoryClose({ brandId }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [inventories, setInventories] = useState<InventoryRow[]>([])
  const [closes, setCloses] = useState<CloseRow[]>([])
  const [physicals, setPhysicals] = useState<Record<string, number>>({})
  const [checkerName, setCheckerName] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [logSummaries, setLogSummaries] = useState<LogSummary[]>([])
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const companyBrandIds = await resolveCompanyBrandIds(supabase, brandId)
    const [ym1, ym2] = yearMonth.split('-').map(Number)
    const startDate = new Date(ym1, ym2 - 1, 1).toISOString()
    const endDate = new Date(ym1, ym2, 1).toISOString()
    const [{ data: invData }, { data: closeData }, { data: logData }] = await Promise.all([
      supabase
        .from('brand_inventory')
        .select('id, product_name, total_stock, brand_id')
        .in('brand_id', companyBrandIds)
        .order('product_name'),
      supabase
        .from('brand_monthly_close')
        .select('*')
        .in('brand_id', companyBrandIds)
        .eq('year_month', yearMonth),
      supabase
        .from('brand_stock_logs')
        .select('inventory_id, type, qty')
        .in('brand_id', companyBrandIds)
        .gte('created_at', startDate)
        .lt('created_at', endDate),
    ])
    setInventories((invData || []) as InventoryRow[])
    setCloses((closeData || []) as CloseRow[])
    const summaries: Record<string, LogSummary> = {}
    for (const log of (logData || []) as Array<{ inventory_id: string; type: string; qty: number }>) {
      if (!summaries[log.inventory_id]) {
        summaries[log.inventory_id] = {
          inventory_id: log.inventory_id,
          total_in: 0,
          total_out: 0,
          total_return: 0,
          total_dispose: 0,
        }
      }
      if (log.type === 'in' || log.type === 'lot_in') summaries[log.inventory_id].total_in += log.qty
      else if (log.type === 'out') summaries[log.inventory_id].total_out += log.qty
      else if (log.type === 'return_in') summaries[log.inventory_id].total_return += log.qty
      else if (log.type === 'dispose') summaries[log.inventory_id].total_dispose += log.qty
    }
    setLogSummaries(Object.values(summaries))
    setLoading(false)
  }, [brandId, yearMonth])
  useEffect(() => { void loadData() }, [loadData])
  const isClosed = (invId: string) =>
    closes.some(c => c.inventory_id === invId && c.closed_at)
  const doClose = async () => {
    if (!checkerName.trim()) { showToast('담당자 이름을 입력해주세요'); return }
    if (!brandId) return
    const unclosed = inventories.filter(inv => !isClosed(inv.id))
    if (unclosed.length === 0) { showToast('이미 모두 마감됐어요'); return }
    setSaving(true)
    const closedAt = new Date().toISOString()
    let hasError = false
    let diffCount = 0
    for (const inv of unclosed) {
      const summary = logSummaries.find(s => s.inventory_id === inv.id)
      const totalIn = summary?.total_in || 0
      const totalOut = summary?.total_out || 0
      const totalReturn = summary?.total_return || 0
      const totalDispose = summary?.total_dispose || 0
      const closingStock = inv.total_stock
      const physicalStock = physicals[inv.id] ?? null
      const difference = physicalStock !== null ? physicalStock - closingStock : null
      if (difference !== null && difference !== 0) diffCount++
      const existing = closes.find(c => c.inventory_id === inv.id)
      const payload = {
        brand_id: inv.brand_id || brandId,
        inventory_id: inv.id,
        year_month: yearMonth,
        total_in: totalIn,
        total_out: totalOut,
        total_return: totalReturn,
        total_dispose: totalDispose,
        closing_stock: closingStock,
        physical_stock: physicalStock,
        difference,
        closed_at: closedAt,
        closed_by: checkerName.trim(),
        memo: memo.trim() || null,
      }
      let error
      if (existing) {
        ;({ error } = await supabase
          .from('brand_monthly_close')
          .update(payload)
          .eq('id', existing.id))
      } else {
        ;({ error } = await supabase
          .from('brand_monthly_close')
          .insert({ ...payload, opening_stock: 0 }))
      }
      if (error) { hasError = true; break }
    }
    if (!hasError) {
      if (diffCount > 0) {
        await supabase.from('brand_messages').insert({
          brand_id: brandId,
          message_type: 'auto_order',
          target_type: 'all',
          title: `⚠️ ${yearMonth} 월 마감 — 재고 불일치 ${diffCount}건`,
          body: `${yearMonth} 월 마감 완료. 시스템 재고와 실물 재고 불일치 ${diffCount}건 발생. 담당자 확인이 필요합니다.`,
          send_count: 1,
        })
        showToast(`마감 완료! 불일치 ${diffCount}건 — 본사 알림 발송됨`)
      } else {
        showToast(`${yearMonth} 월 마감 완료! 재고 모두 일치 ✅`)
      }
      void loadData()
    } else {
      showToast('마감 처리 중 오류 발생')
    }
    setSaving(false)
  }
  const printReport = () => {
    const rows = inventories.map(inv => {
      const summary = logSummaries.find(s => s.inventory_id === inv.id)
      const close = closes.find(c => c.inventory_id === inv.id)
      const physical = physicals[inv.id] ?? close?.physical_stock ?? null
      const diff = physical !== null ? physical - inv.total_stock : null
      return `<tr>
        <td>${inv.product_name}</td>
        <td style="text-align:center">${summary?.total_in || 0}개</td>
        <td style="text-align:center">${summary?.total_out || 0}개</td>
        <td style="text-align:center">${summary?.total_return || 0}개</td>
        <td style="text-align:center">${summary?.total_dispose || 0}개</td>
        <td style="text-align:center;font-weight:600">${inv.total_stock}개</td>
        <td style="text-align:center">${physical !== null ? physical + '개' : '-'}</td>
        <td style="text-align:center;color:${diff === 0 ? '#1E8449' : diff !== null ? '#E53935' : '#888'}">
          ${diff !== null ? (diff > 0 ? '+' : '') + diff + '개' : '-'}
        </td>
      </tr>`
    }).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${yearMonth} 재고 마감 리포트</title>
    <style>
      @page { size: A4 landscape; margin: 15mm; }
      body { font-family: 'Malgun Gothic', sans-serif; font-size: 11px; color: #1a1a2e; }
      h1 { font-size: 16px; color: #7B5EA7; margin-bottom: 4px; }
      p { font-size: 10px; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #7B5EA7; color: #fff; padding: 7px 10px; font-size: 10px; text-align: center; }
      th:first-child { text-align: left; }
      td { padding: 7px 10px; font-size: 10px; border-bottom: 0.5px solid #ede9f7; }
      tr:nth-child(even) td { background: #f8f7fc; }
      .footer { margin-top: 20px; font-size: 10px; color: #666; display: flex; justify-content: space-between; }
    </style></head>
    <body>
      <h1>${yearMonth} 월간 재고 마감 리포트</h1>
      <p>담당자: ${checkerName || '-'} · 마감일: ${new Date().toLocaleDateString('ko-KR')} · AURAN Brand Hub</p>
      <table>
        <thead><tr>
          <th style="text-align:left;width:25%">제품명</th>
          <th>입고</th><th>출고</th><th>반품</th><th>폐기</th>
          <th>시스템 재고</th><th>실물 재고</th><th>차이</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <span>메모: ${memo || '-'}</span>
        <span>AURAN Brand Hub · 본 리포트는 마감 확정 기록입니다</span>
      </div>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300) }
  }
  if (loading) return (
    <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>
      불러오는 중...
    </div>
  )
  const allClosed = inventories.length > 0 && inventories.every(inv => isClosed(inv.id))
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: SUB }}>마감 기준 월</span>
          <input
            type="month"
            value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: TEXT, outline: 'none' }}
          />
          {allClosed && (
            <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
              마감완료
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>담당자</div>
            <input
              value={checkerName}
              onChange={e => setCheckerName(e.target.value)}
              placeholder="이름 입력"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: TEXT, outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 3 }}>메모</div>
            <input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="특이사항"
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: TEXT, outline: 'none' }}
            />
          </div>
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>
          제품별 실물 재고 입력 (실사 후 입력)
        </div>
        {inventories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>
            등록된 제품이 없어요
          </div>
        ) : inventories.map((inv, i) => {
          const summary = logSummaries.find(s => s.inventory_id === inv.id)
          const isDone = isClosed(inv.id)
          const physical = physicals[inv.id] ?? null
          const diff = physical !== null ? physical - inv.total_stock : null
          return (
            <div key={inv.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < inventories.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: TEXT }}>{inv.product_name}</span>
                {isDone && (
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
                    마감완료
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, marginBottom: 8 }}>
                {[
                  { label: '입고', val: summary?.total_in || 0, color: '#4CAF50' },
                  { label: '출고', val: summary?.total_out || 0, color: '#E53935' },
                  { label: '반품', val: summary?.total_return || 0, color: '#C9A96E' },
                  { label: '폐기', val: summary?.total_dispose || 0, color: SUB },
                ].map(k => (
                  <div key={k.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '5px 6px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: k.color }}>{k.val}</div>
                    <div style={{ fontSize: 10, color: SUB }}>{k.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '6px 10px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: PURPLE }}>{inv.total_stock}개</div>
                  <div style={{ fontSize: 10, color: SUB }}>시스템 재고</div>
                </div>
                <div style={{ fontSize: 16, color: SUB }}>vs</div>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    value={physical ?? ''}
                    onChange={e => setPhysicals(prev => ({ ...prev, [inv.id]: Number(e.target.value) }))}
                    placeholder="실물 수량 입력"
                    disabled={isDone}
                    style={{ width: '100%', background: isDone ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `0.5px solid ${diff !== null ? (diff === 0 ? 'rgba(76,175,80,0.4)' : 'rgba(229,57,53,0.4)') : 'rgba(255,255,255,0.1)'}`, borderRadius: 5, padding: '6px 8px', fontSize: 13, color: TEXT, outline: 'none', textAlign: 'center' as const }}
                  />
                  <div style={{ fontSize: 10, color: SUB, textAlign: 'center' as const, marginTop: 2 }}>실물 재고</div>
                </div>
                {diff !== null && (
                  <div style={{ width: 56, textAlign: 'center' as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: diff === 0 ? '#4CAF50' : '#E53935' }}>
                      {diff > 0 ? '+' : ''}{diff}개
                    </div>
                    <div style={{ fontSize: 10, color: diff === 0 ? '#4CAF50' : '#E53935' }}>
                      {diff === 0 ? '일치' : '차이'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => void doClose()}
          disabled={saving || allClosed}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: saving || allClosed ? 'rgba(123,94,167,0.3)' : PURPLE, color: '#fff', fontSize: 13, cursor: saving || allClosed ? 'not-allowed' : 'pointer' }}
        >
          {saving ? '마감 중...' : allClosed ? '마감 완료됨' : `${yearMonth} 월 마감 확정`}
        </button>
        <button
          type="button"
          onClick={printReport}
          style={{ padding: '10px 14px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
        >
          🖨️ PDF
        </button>
      </div>
      <div style={{ padding: '8px 10px', background: 'rgba(201,169,110,0.08)', border: '0.5px solid rgba(201,169,110,0.2)', borderRadius: 7, fontSize: 11, color: 'rgba(201,169,110,0.8)', lineHeight: 1.6 }}>
        마감 확정 후 수정 불가 · 불일치 발생 시 본사 알림 자동 발송
      </div>
    </div>
  )
}
