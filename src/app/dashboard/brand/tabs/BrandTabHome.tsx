'use client'
import type { CSSProperties } from 'react'
const BG = '#0f0d14'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
interface Props {
  brandName: string
  activeBrandId: string | null
  onTabChange: (tab: string) => void
}
export default function BrandTabHome({ brandName, activeBrandId, onTabChange }: Props) {
  const kpis = [
    { label: '연결 원장님', value: 'N명', color: PURPLE },
    { label: '이번달 발주', value: '₩0', color: GOLD },
    { label: '재주문율', value: '-%', color: '#a07fd4' },
  ]
  const alerts = [
    { text: '제품을 등록하고 원장님과 연결을 시작해보세요', action: '제품 등록', tab: 'products' },
    { text: '원장님 네트워크를 설정하세요', action: '원장님 관리', tab: 'owners' },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...CARD, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 20, color: k.color, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>🔔 지금 챙겨야 할 것들</div>
        {alerts.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < alerts.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <span style={{ fontSize: 12, color: TEXT }}>{a.text}</span>
            <button
              type="button"
              onClick={() => onTabChange(a.tab)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
            >
              {a.action}
            </button>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📦 이번달 TOP 제품</div>
        <div style={{ fontSize: 12, color: SUB, textAlign: 'center', padding: 16 }}>제품을 등록하면 판매 데이터가 표시됩니다</div>
      </div>
    </div>
  )
}
