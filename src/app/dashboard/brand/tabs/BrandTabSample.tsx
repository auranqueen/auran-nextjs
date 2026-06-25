'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
interface Props {
  brandId: string | null
  brandName: string
}
export default function BrandTabSample({ brandId, brandName }: Props) {
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const requests = [
    { owner: '원장님 A', product: '미정', status: '대기', statusColor: 'rgba(255,193,7,0.8)' },
    { owner: '원장님 B', product: '미정', status: '발송완료', statusColor: 'rgba(76,175,80,0.8)' },
  ]
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => showToast('샘플 발송 요청 등록')}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}
        >
          + 샘플 발송
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>🎁 샘플 요청 · 승인</div>
        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>아직 샘플 요청이 없어요</div>
        ) : (
          requests.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < requests.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: TEXT }}>{r.owner}</div>
                <div style={{ fontSize: 11, color: SUB }}>{r.product}</div>
              </div>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${r.statusColor}22`, color: r.statusColor }}>{r.status}</span>
              {r.status === '대기' && (
                <button type="button" onClick={() => showToast('샘플 승인 완료')} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer' }}>승인</button>
              )}
            </div>
          ))
        )}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📦 이번달 샘플 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, textAlign: 'center' }}>
          {[{ l: '발송', v: '0건' }, { l: '승인 대기', v: '0건' }, { l: '전환율', v: '-%' }].map(k => (
            <div key={k.l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 14, color: PURPLE, marginBottom: 4 }}>{k.v}</div>
              <div style={{ fontSize: 10, color: SUB }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: SUB, padding: '8px 10px', background: 'rgba(123,94,167,0.05)', borderRadius: 7, border: '0.5px solid rgba(123,94,167,0.15)' }}>
        💡 샘플 발송 시 오렌톡 자동 알림 연동 가능
      </div>
    </div>
  )
}
