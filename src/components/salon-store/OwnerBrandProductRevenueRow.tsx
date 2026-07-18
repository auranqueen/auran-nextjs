import type { RevenueSlice } from '@/app/dashboard/owner/OwnerHomeV3'
export default function OwnerBrandProductRevenueRow({ revenue }: { revenue: RevenueSlice }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>브랜드 제품 정산액</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--gold)', fontWeight: 700 }}>
          {revenue.current.toLocaleString()}원
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
        전월대비 {revenue.changePercent > 0 ? '+' : ''}{revenue.changePercent}% · 트랙A 전용
      </div>
    </div>
  )
}
