'use client'

import { C, SERIF } from './types'

export function TomorrowPopup({ names, onClose }: { names: string[]; onClose: () => void }) {
  if (!names.length) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 56, padding: 16 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, color: C.plum, fontFamily: SERIF, marginBottom: 8 }}>내일 발송 예정 리추얼 ({names.length}건)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {names.map((name, i) => (
            <div key={`${name}-${i}`} style={{ fontSize: 13, color: C.ink, padding: '8px 10px', background: C.goldSoft, borderRadius: 8 }}>{name}</div>
          ))}
        </div>
        <button type="button" onClick={onClose} style={{ width: '100%', padding: 10, background: C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>확인</button>
      </div>
    </div>
  )
}
