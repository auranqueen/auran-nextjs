'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabLive({ brandId, brandName }: Props) {
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const sessions = [
    { title: '신제품 사용법 라이브', date: '예정', viewers: '-', status: '준비중', statusColor: 'rgba(255,193,7,0.8)' },
    { title: '피부 타입별 추천 루틴', date: '-', viewers: '-', status: '대기', statusColor: SUB },
  ]
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => showToast('라이브 일정 등록 준비 중')}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}
        >
          + 라이브 예약
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>🎓 교육 라이브 · {brandName}</div>
        {sessions.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < sessions.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(123,94,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📹</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: SUB }}>{s.date} · 시청 {s.viewers}명</div>
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${s.statusColor}22`, color: s.statusColor, flexShrink: 0 }}>{s.status}</span>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>💡 라이브 활용 팁</div>
        <div style={{ fontSize: 11, color: SUB, lineHeight: 1.7 }}>
          원장님 교육 라이브 후 발주 전환율이 평균 2.3배 높아요.<br />
          신제품 출시 시 라이브 + 샘플 연계를 추천합니다.
        </div>
      </div>
      <div style={{ ...CARD, marginBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
          {[{ l: '누적 라이브', v: '0회', c: PURPLE }, { l: '평균 시청', v: '-명', c: GOLD }, { l: '발주 전환', v: '-%', c: GREEN }].map(k => (
            <div key={k.l}>
              <div style={{ fontSize: 16, color: k.c, marginBottom: 4 }}>{k.v}</div>
              <div style={{ fontSize: 10, color: SUB }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
