'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import MonthlyOrderAccordion from './MonthlyOrderAccordion'

const CARD: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
}
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

const PALETTE = [
  '#C9A96E',
  '#7B5EA7',
  '#64B5F6',
  '#E57373',
  '#81C784',
  '#FFB74D',
  '#BA68C8',
  '#4DD0E1',
]

const HQ_PAID_STATUSES = ['결제완료', '배송완료', '구매확정']

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type BrandRow = { id: string; name: string }

interface Props {
  companyId: string
  hubBrandId: string
}

export default function GroupRevenueChart({ companyId, hubBrandId }: Props) {
  const supabase = createClient()
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [trend, setTrend] = useState<Array<Record<string, string | number>>>([])
  const [monthByBrand, setMonthByBrand] = useState<Record<string, number>>({})
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [detailBrandId, setDetailBrandId] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    const run = async () => {
      setLoading(true)
      let { data: brandRows } = await supabase
        .from('brands')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name')

      let list: BrandRow[] = (brandRows || []).map((b) => ({
        id: String(b.id),
        name: String(b.name || ''),
      }))

      // company에 행이 없으면 허브만 fallback
      if (!list.length && hubBrandId) {
        const { data: hub } = await supabase
          .from('brands')
          .select('id, name')
          .eq('id', hubBrandId)
          .maybeSingle()
        if (hub?.id) {
          list = [{ id: String(hub.id), name: String(hub.name || '허브') }]
        }
      }

      setBrands(list)
      if (!list.length) {
        setTrend([])
        setMonthByBrand({})
        setLoading(false)
        return
      }

      const brandIds = list.map((b) => b.id)
      const thisMonth = new Date()
      thisMonth.setDate(1)
      thisMonth.setHours(0, 0, 0, 0)
      const thisMonthIso = thisMonth.toISOString()

      const since = new Date()
      since.setHours(0, 0, 0, 0)
      since.setDate(since.getDate() - 29)
      const sinceIso = since.toISOString()

      const [
        { data: createdRows },
        { data: cancelledRows },
        { data: monthRows },
        { data: hqTrendRows },
        { data: hqMonthRows },
      ] = await Promise.all([
        supabase
          .from('brand_orders')
          .select('brand_id, total_amount, created_at')
          .in('brand_id', brandIds)
          .gte('created_at', sinceIso),
        supabase
          .from('brand_orders')
          .select('brand_id, total_amount, updated_at')
          .in('brand_id', brandIds)
          .eq('status', 'cancelled')
          .gte('updated_at', sinceIso),
        supabase
          .from('brand_orders')
          .select('brand_id, total_amount')
          .in('brand_id', brandIds)
          .gte('created_at', thisMonthIso)
          .neq('status', 'cancelled'),
        // 트랙B: BrandTabHome과 동일 — HQ_PAID + ordered_at
        supabase
          .from('hq_stock_orders')
          .select('brand_id, final_amount, ordered_at')
          .in('brand_id', brandIds)
          .in('status', HQ_PAID_STATUSES)
          .gte('ordered_at', sinceIso),
        supabase
          .from('hq_stock_orders')
          .select('brand_id, final_amount')
          .in('brand_id', brandIds)
          .in('status', HQ_PAID_STATUSES)
          .gte('ordered_at', thisMonthIso),
      ])

      const createdByBrandDay: Record<string, Record<string, number>> = {}
      const cancelledByBrandDay: Record<string, Record<string, number>> = {}
      const hqByBrandDay: Record<string, Record<string, number>> = {}
      for (const id of brandIds) {
        createdByBrandDay[id] = {}
        cancelledByBrandDay[id] = {}
        hqByBrandDay[id] = {}
      }

      for (const o of createdRows || []) {
        const bid = String((o as { brand_id?: string }).brand_id || '')
        const at = (o as { created_at?: string }).created_at
        if (!bid || !at || !createdByBrandDay[bid]) continue
        const k = dayKey(at)
        createdByBrandDay[bid][k] =
          (createdByBrandDay[bid][k] || 0) + Math.trunc(Number((o as { total_amount?: number }).total_amount) || 0)
      }
      for (const o of cancelledRows || []) {
        const bid = String((o as { brand_id?: string }).brand_id || '')
        const at = (o as { updated_at?: string }).updated_at
        if (!bid || !at || !cancelledByBrandDay[bid]) continue
        const k = dayKey(at)
        cancelledByBrandDay[bid][k] =
          (cancelledByBrandDay[bid][k] || 0) + Math.trunc(Number((o as { total_amount?: number }).total_amount) || 0)
      }
      for (const o of hqTrendRows || []) {
        const bid = String((o as { brand_id?: string }).brand_id || '')
        const at = (o as { ordered_at?: string }).ordered_at
        if (!bid || !at || !hqByBrandDay[bid]) continue
        const k = dayKey(at)
        hqByBrandDay[bid][k] =
          (hqByBrandDay[bid][k] || 0) + Math.trunc(Number((o as { final_amount?: number }).final_amount) || 0)
      }

      const rows: Array<Record<string, string | number>> = []
      for (let i = 0; i < 30; i++) {
        const d = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const row: Record<string, string | number> = {
          day: k,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
        }
        for (const id of brandIds) {
          const trackA = (createdByBrandDay[id][k] || 0) - (cancelledByBrandDay[id][k] || 0)
          const trackB = hqByBrandDay[id][k] || 0
          row[id] = trackA + trackB
        }
        rows.push(row)
      }
      setTrend(rows)

      const monthMap: Record<string, number> = {}
      for (const id of brandIds) monthMap[id] = 0
      for (const o of monthRows || []) {
        const bid = String((o as { brand_id?: string }).brand_id || '')
        if (!bid || monthMap[bid] === undefined) continue
        monthMap[bid] += Math.trunc(Number((o as { total_amount?: number }).total_amount) || 0)
      }
      for (const o of hqMonthRows || []) {
        const bid = String((o as { brand_id?: string }).brand_id || '')
        if (!bid || monthMap[bid] === undefined) continue
        monthMap[bid] += Math.trunc(Number((o as { final_amount?: number }).final_amount) || 0)
      }
      setMonthByBrand(monthMap)
      setLoading(false)
    }
    void run()
  }, [companyId, hubBrandId, supabase])

  const colorById = useMemo(() => {
    const map: Record<string, string> = {}
    brands.forEach((b, i) => {
      map[b.id] = PALETTE[i % PALETTE.length]
    })
    return map
  }, [brands])

  const { withSales, zeroSales } = useMemo(() => {
    const withS: BrandRow[] = []
    const zero: BrandRow[] = []
    for (const b of brands) {
      if ((monthByBrand[b.id] || 0) > 0) withS.push(b)
      else zero.push(b)
    }
    withS.sort((a, b) => (monthByBrand[b.id] || 0) - (monthByBrand[a.id] || 0))
    return { withSales: withS, zeroSales: zero }
  }, [brands, monthByBrand])

  if (!companyId) return null

  return (
    <div style={CARD}>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>그룹 최근 30일 재고발주 매출</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : brands.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>그룹 브랜드가 없어요</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(Number(v) / 10000)}만`}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1520',
                  border: '0.5px solid rgba(201,169,110,0.35)',
                  borderRadius: 8,
                  fontSize: 11,
                  color: TEXT,
                }}
                formatter={(v: number, name: string) => {
                  const brand = brands.find((b) => b.id === name)
                  return [`₩${Number(v).toLocaleString()}`, brand?.name || name]
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, color: SUB, cursor: 'pointer' }}
                onClick={(e) => {
                  const key = String((e as { dataKey?: string }).dataKey || '')
                  if (!key) return
                  setHidden((prev) => ({ ...prev, [key]: !prev[key] }))
                }}
                formatter={(value) => {
                  const brand = brands.find((b) => b.id === value)
                  const faded = hidden[value]
                  return (
                    <span style={{ color: faded ? 'rgba(255,255,255,0.25)' : TEXT }}>
                      {brand?.name || value}
                    </span>
                  )
                }}
              />
              {brands.map((b) => (
                <Line
                  key={b.id}
                  type="monotone"
                  dataKey={b.id}
                  name={b.id}
                  stroke={colorById[b.id]}
                  strokeWidth={2}
                  dot={false}
                  hide={!!hidden[b.id]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div style={{ marginTop: 14, fontSize: 11, color: SUB, marginBottom: 8 }}>이달 서브브랜드 매출</div>
          {withSales.map((b) => (
            <div key={b.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: colorById[b.id],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: TEXT, flex: 1, minWidth: 0 }}>{b.name}</span>
                <span style={{ color: colorById[b.id], flexShrink: 0 }}>
                  ₩{(monthByBrand[b.id] || 0).toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => setDetailBrandId((prev) => (prev === b.id ? null : b.id))}
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: detailBrandId === b.id ? 'rgba(123,94,167,0.2)' : 'transparent',
                    color: TEXT,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {detailBrandId === b.id ? '닫기' : '세부내역'}
                </button>
              </div>
              {detailBrandId === b.id ? (
                <div style={{ marginBottom: 8 }}>
                  <MonthlyOrderAccordion brandId={b.id} onClose={() => setDetailBrandId(null)} />
                </div>
              ) : null}
            </div>
          ))}

          {zeroSales.length > 0 ? (
            <div style={{ marginTop: 12, opacity: 0.45 }}>
              <div style={{ fontSize: 10, color: SUB, marginBottom: 6 }}>매출 없음</div>
              {zeroSales.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    fontSize: 11,
                    borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: colorById[b.id],
                      flexShrink: 0,
                      opacity: 0.5,
                    }}
                  />
                  <span style={{ color: SUB, flex: 1 }}>{b.name}</span>
                  <span style={{ color: SUB }}>₩0</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
