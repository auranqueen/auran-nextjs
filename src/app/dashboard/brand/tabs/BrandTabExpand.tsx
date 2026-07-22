'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import TabBrandSelector from '../components/TabBrandSelector'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
interface Props {
  myBrands: { id: string; name: string }[]
}
export default function BrandTabExpand({ myBrands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const brandId = selectedBrandId
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const regions = [
    { name: '서울·수도권', salons: '-', status: '활성', color: 'rgba(76,175,80,0.8)' },
    { name: '부산·경남', salons: '-', status: '확장 가능', color: GOLD },
    { name: '대구·경북', salons: '-', status: '미진출', color: SUB },
    { name: '광주·전라', salons: '-', status: '미진출', color: SUB },
  ]
  const channels = [
    { icon: '🏪', title: '살롱 직거래', desc: '연결 원장님 네트워크 확대' },
    { icon: '🛒', title: '온라인 몰', desc: 'AURAN 고객 직판 채널' },
    { icon: '🤝', title: '파트너 연계', desc: '지역 대리점·유통 제휴' },
  ]
  return (
    <div>
      <TabBrandSelector myBrands={myBrands} storageKey="expand-brand" onSelect={setSelectedBrandId} />
      {!selectedBrandId ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>브랜드 선택 중…</div>
      ) : (
      <>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>🌐 지역별 진출 현황 · {brandName}</div>
        {regions.map((r, i) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < regions.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: TEXT }}>{r.name}</div>
              <div style={{ fontSize: 11, color: SUB }}>연결 살롱 {r.salons}곳</div>
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${r.color}22`, color: r.color }}>{r.status}</span>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>📡 확장 채널</div>
        {channels.map((c, i) => (
          <div key={c.title} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < channels.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: SUB }}>{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => showToast('확장 상담 신청 접수!')}
        style={{ width: '100%', padding: '10px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 13, cursor: 'pointer' }}
      >
        + 신규 지역 확장 상담 신청
      </button>
      </>
      )}
    </div>
  )
}
