'use client'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
const PROMOS = [
  { key: '5+1', desc: '5개 구매 +1개 증정' },
  { key: '5+5', desc: '5개 구매 +5개 증정' },
  { key: '10+3', desc: '10개 구매 +3개 증정' },
  { key: '10+4', desc: '10개 구매 +4개 증정' },
  { key: '10+5', desc: '10개 구매 +5개 증정' },
  { key: '10+10', desc: '10개 구매 +10개 증정' },
]
const GRADE_PROMOS = [
  { grade: '메디슈티컬', color: '#E53935', promos: '10+10 / 10+5', point: '구매액의 3%' },
  { grade: '프리미엄전문점', color: '#C9A96E', promos: '10+5 / 10+4', point: '구매액의 2%' },
  { grade: '전문점', color: '#9C7FD4', promos: '10+3 / 5+5', point: '구매액의 1.5%' },
  { grade: '취급점', color: '#64B5F6', promos: '10+1 / 5+1', point: '구매액의 1%' },
]
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabOrders({ brandId, brandName }: Props) {
  return (
    <div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📊 등급별 프로모션 · 적립 포인트</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                {['등급', '프로모션', '적립 포인트'].map(h => (
                  <th key={h} style={{ padding: '8px 6px', color: SUB, textAlign: 'left', fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRADE_PROMOS.map(g => (
                <tr key={g.grade} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 6px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${g.color}22`, color: g.color, border: `0.5px solid ${g.color}55` }}>{g.grade}</span>
                  </td>
                  <td style={{ padding: '8px 6px', color: g.color }}>{g.promos}</td>
                  <td style={{ padding: '8px 6px', color: GREEN }}>{g.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(123,94,167,0.05)', borderRadius: 7, border: '0.5px solid rgba(123,94,167,0.15)' }}>
          💡 포인트는 시바산 제품 구매 시 1T = ₩1 · 현금 전환 불가
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📋 프로모션 종류</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {PROMOS.map(p => (
            <div key={p.key} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: PURPLE, marginBottom: 4 }}>{p.key}</div>
              <div style={{ fontSize: 10, color: SUB }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📥 접수된 발주</div>
        <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>
          아직 접수된 발주가 없어요
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>👑 아레테클럽 포인트 현황</div>
        <div style={{ fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(201,169,110,0.04)', borderRadius: 7, border: '0.5px solid rgba(201,169,110,0.15)' }}>
          💡 아레테 포인트 + 발주 적립 포인트 → 시바산 제품 구매 시 통합 사용
        </div>
      </div>
    </div>
  )
}
