'use client'

import type { CSSProperties } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const CARD: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
}
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

type Point = { day: string; label: string; amountA: number; amountB: number }

interface Props {
  loading: boolean
  data: Point[]
}

export default function HomeSalesTrendChart({ loading, data }: Props) {
  return (
    <div style={{ ...CARD, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>최근 30일 재고발주 매출</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
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
              formatter={(v: number, name: string) => [
                `₩${Number(v).toLocaleString()}`,
                name === 'amountA' ? '트랙A' : '트랙B',
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: SUB }}
              formatter={(value) => (value === 'amountA' ? '트랙A' : '트랙B')}
            />
            <Line type="monotone" dataKey="amountA" stroke={GOLD} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="amountB" stroke={PURPLE} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}