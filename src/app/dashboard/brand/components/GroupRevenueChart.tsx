'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
  const [loading, setLoading] = useState(true)
  const [detailBrandId, setDetailBrandId] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const sync = () => setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

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

  const monthTotal = useMemo(
    () => brands.reduce((s, b) => s + (monthByBrand[b.id] || 0), 0),
    [brands, monthByBrand],
  )

  /** 도넛: 매출>0만 슬라이스. 0원은 범례에서만 흐리게 */
  const pieData = useMemo(() => {
    return withSales.map((b) => ({
      id: b.id,
      name: b.name,
      value: monthByBrand[b.id] || 0,
    }))
  }, [withSales, monthByBrand])

  if (!companyId) return null

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: SUB }}>그룹 최근 30일 재고발주 매출</div>
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(123,94,167,0.18)',
            color: '#c4a8f0',
            border: '1px solid rgba(123,94,167,0.35)',
          }}
        >
          전체 {brands.length}개 브랜드
        </span>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : brands.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>그룹 브랜드가 없어요</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? '1.6fr 1fr' : '1fr',
              gap: 12,
              alignItems: 'stretch',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                  {brands.map((b) => (
                    <Bar
                      key={b.id}
                      dataKey={b.id}
                      name={b.id}
                      stackId="group"
                      fill={colorById[b.id]}
                      maxBarSize={28}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 6, alignSelf: 'flex-start' }}>이달 매출 비중</div>
              {pieData.length === 0 ? (
                <div style={{ fontSize: 11, color: SUB, padding: 24, textAlign: 'center' }}>이달 매출이 없어요</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={1}
                      stroke="rgba(15,13,20,0.6)"
                      strokeWidth={1}
                    >
                      {pieData.map((d) => (
                        <Cell key={d.id} fill={colorById[d.id]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1a1520',
                        border: '0.5px solid rgba(201,169,110,0.35)',
                        borderRadius: 8,
                        fontSize: 11,
                        color: TEXT,
                      }}
                      formatter={(v: number, name: string) => [
                        `₩${Number(v).toLocaleString()}`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div style={{ width: '100%', marginTop: 4 }}>
                {withSales.map((b) => {
                  const amt = monthByBrand[b.id] || 0
                  const pct = monthTotal > 0 ? Math.round((amt / monthTotal) * 1000) / 10 : 0
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 0',
                        fontSize: 10,
                        color: TEXT,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 2,
                          background: colorById[b.id],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.name}
                      </span>
                      <span style={{ color: SUB, flexShrink: 0 }}>{pct}%</span>
                    </div>
                  )
                })}
                {zeroSales.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 0',
                      fontSize: 10,
                      color: SUB,
                      opacity: 0.45,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 2,
                        background: colorById[b.id],
                        flexShrink: 0,
                        opacity: 0.5,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.name}
                    </span>
                    <span style={{ flexShrink: 0 }}>0%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
