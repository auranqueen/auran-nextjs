'use client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabData({ brandId, brandName }: Props) {
  const kpis = [
    { label: '이번달 매출', value: '₩0', change: '-', color: PURPLE },
    { label: '발주 건수', value: '0건', change: '-', color: GOLD },
    { label: '재주문율', value: '-%', change: '-', color: GREEN },
    { label: '연결 살롱', value: '0곳', change: '-', color: '#a07fd4' },
  ]
  const topProducts = [
    { name: '데이터 수집 중', qty: '-', amount: '₩0' },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 18, color: k.color, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 10, color: SUB }}>전월 대비 {k.change}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📊 {brandName} · 이번달 TOP 제품</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
              {['제품', '수량', '매출'].map(h => (
                <th key={h} style={{ padding: '8px 6px', color: SUB, textAlign: 'left', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topProducts.map(p => (
              <tr key={p.name} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '8px 6px', color: SUB }}>{p.name}</td>
                <td style={{ padding: '8px 6px', color: SUB }}>{p.qty}</td>
                <td style={{ padding: '8px 6px', color: GREEN }}>{p.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>제품 판매 데이터가 쌓이면 차트가 표시됩니다</div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📈 월별 추이</div>
        <div style={{ height: 80, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: SUB }}>
          차트 준비 중
        </div>
      </div>
    </div>
  )
}
