'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { createClient } from '@/lib/supabase/client'
import { resolveOwnerSalonNames } from '@/lib/brand/resolveOwnerSalonNames'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const CARD: CSSProperties = {
  background: '#100f1a',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
}
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const PINK = '#F48FB1'
const GRAY = 'rgba(255,255,255,0.22)'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

const HQ_PAID_STATUSES = ['결제완료', '배송완료', '구매확정']

type RankingRow = {
  key: string
  owner: string
  salon: string
  amount: number
}

interface Props {
  companyId: string
  hubBrandId: string
}

function barColor(idx: number) {
  if (idx === 0) return GOLD
  if (idx === 1) return PURPLE
  if (idx === 2) return PINK
  return GRAY
}

export default function ShopOrderRanking({ companyId, hubBrandId }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<RankingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    const run = async () => {
      setLoading(true)
      try {
        const { data: brandRows } = await supabase
          .from('brands')
          .select('id, name')
          .eq('company_id', companyId)

        let brandIds = (brandRows || []).map((b) => String(b.id)).filter(Boolean)
        if (!brandIds.length && hubBrandId) {
          brandIds = [hubBrandId]
        }
        if (!brandIds.length) {
          setRows([])
          setLoading(false)
          return
        }

        const thisMonth = new Date()
        thisMonth.setDate(1)
        thisMonth.setHours(0, 0, 0, 0)
        const thisMonthIso = thisMonth.toISOString()

        const amountByKey = new Map<string, { owner: string; salon: string; amount: number }>()

        const addAmount = (ownerRaw: string | null | undefined, salonRaw: string | null | undefined, amt: number) => {
          const owner = (ownerRaw && String(ownerRaw).trim()) || '원장'
          const salon = (salonRaw && String(salonRaw).trim()) || ''
          const key = `${owner}|${salon}`
          const prev = amountByKey.get(key)
          if (prev) {
            prev.amount += amt
          } else {
            amountByKey.set(key, { owner, salon, amount: amt })
          }
        }

        // 가. Track A batches
        const { data: batchLinkRows } = await supabase
          .from('brand_orders')
          .select('batch_id')
          .in('brand_id', brandIds)
          .not('batch_id', 'is', null)
          .gte('created_at', thisMonthIso)
          .limit(1000)

        const batchIds = Array.from(
          new Set(
            (batchLinkRows || [])
              .map((r) => (r.batch_id != null ? String(r.batch_id) : ''))
              .filter(Boolean),
          ),
        )

        if (batchIds.length) {
          const { data: batchRows } = await supabase
            .from('brand_order_batches')
            .select('id, owner_name, salon_name, total_amount, created_at')
            .in('id', batchIds)
            .gte('created_at', thisMonthIso)

          for (const b of batchRows || []) {
            addAmount(
              (b as { owner_name?: string }).owner_name,
              (b as { salon_name?: string }).salon_name,
              Math.trunc(Number((b as { total_amount?: number }).total_amount) || 0),
            )
          }
        }

        // 나. Track A legacy (no batch)
        const { data: legacyRows } = await supabase
          .from('brand_orders')
          .select('owner_name, salon_name, total_amount, status')
          .in('brand_id', brandIds)
          .is('batch_id', null)
          .gte('created_at', thisMonthIso)
          .limit(1000)

        for (const o of legacyRows || []) {
          const st = String((o as { status?: string }).status || '')
          if (st === 'cancelled' || st === '취소') continue
          addAmount(
            (o as { owner_name?: string }).owner_name,
            (o as { salon_name?: string }).salon_name,
            Math.trunc(Number((o as { total_amount?: number }).total_amount) || 0),
          )
        }

        // 다. Track B
        const { data: hqMonthRows } = await supabase
          .from('hq_stock_orders')
          .select('id, final_amount, status, ordered_at, created_at, profile_id')
          .in('brand_id', brandIds)
          .in('status', HQ_PAID_STATUSES)
          .gte('ordered_at', thisMonthIso)
          .limit(1000)

        const rawHqOrders = hqMonthRows || []
        const hqProfileIds = Array.from(
          new Set(rawHqOrders.map((o: { profile_id?: string }) => String(o.profile_id || '')).filter(Boolean)),
        )
        const { ownerNameByProfileId, salonNameByProfileId } = await resolveOwnerSalonNames(supabase, hqProfileIds)

        for (const o of rawHqOrders as Array<{ profile_id?: string; final_amount?: number }>) {
          const pid = String(o.profile_id || '')
          const owner = ownerNameByProfileId[pid] || '원장'
          const salon = salonNameByProfileId[pid] || ''
          addAmount(owner, salon, Math.trunc(Number(o.final_amount) || 0))
        }

        // 라. Aggregate → RankingRow[]
        const ranking: RankingRow[] = Array.from(amountByKey.entries())
          .map(([key, v]) => ({
            key,
            owner: v.owner,
            salon: v.salon,
            amount: v.amount,
          }))
          .filter((r) => r.amount > 0)
          .sort((a, b) => b.amount - a.amount)

        setRows(ranking)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [companyId, hubBrandId, supabase])

  if (!companyId) return null

  const chartRows = rows.slice(0, 10).slice().reverse()
  const chartData = {
    labels: chartRows.map((r) => r.salon || r.owner || '샵'),
    datasets: [
      {
        data: chartRows.map((r) => r.amount),
        backgroundColor: chartRows.map((_, i) => {
          // reversed for display: last item in chartRows is #1
          const rankIdx = chartRows.length - 1 - i
          return barColor(rankIdx)
        }),
        borderWidth: 0,
        borderRadius: 4,
      },
    ],
  }

  const chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(16,15,26,0.95)',
        titleColor: TEXT,
        bodyColor: TEXT,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        callbacks: {
          label: (ctx: { raw?: unknown }) => `₩${Math.trunc(Number(ctx.raw) || 0).toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
      y: {
        ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
    },
  }

  return (
    <div style={CARD}>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 12 }}>
        이달 샵별 발주 랭킹
        {!loading && rows.length > 0 ? (
          <span style={{ fontWeight: 400, color: SUB, marginLeft: 8 }}>{rows.length}곳</span>
        ) : null}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>이달 발주 데이터가 없습니다</div>
      ) : (
        <>
          <div style={{ height: Math.max(160, chartRows.length * 28), marginBottom: 12 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {rows.map((r, idx) => (
              <div
                key={r.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    width: 22,
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: barColor(idx),
                    textAlign: 'center',
                  }}
                >
                  #{idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: TEXT, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.salon || r.owner || '샵'}
                  </div>
                  {r.salon ? (
                    <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>{r.owner || '원장'}</div>
                  ) : null}
                </div>
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 600, flexShrink: 0 }}>
                  ₩{r.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}