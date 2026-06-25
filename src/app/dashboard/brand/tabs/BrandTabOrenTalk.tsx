'use client'
import { useState } from 'react'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
interface Props {
  brandName: string
  brandId: string | null
}
export default function BrandTabOrenTalk({ brandName, brandId }: Props) {
  const [msg, setMsg] = useState('')
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const autoMessages = [
    { icon: '📦', title: '발주 접수 자동 알림', desc: '발주 접수 시 원장님에게 자동 발송', status: '활성', statusColor: 'rgba(76,175,80,0.8)' },
    { icon: '🔄', title: '30일 미주문 유도', desc: '30일 미주문 원장님 자동 알림', status: '활성', statusColor: 'rgba(76,175,80,0.8)' },
    { icon: '🎁', title: '신제품 샘플 안내', desc: '샘플 발송 시 자동 오렌톡', status: '대기', statusColor: 'rgba(255,193,7,0.8)' },
  ]
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>💜 자동 발송 설정 <span style={{ fontSize: 10, color: SUB }}>AURAN 인앱 무료</span></div>
        {autoMessages.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < autoMessages.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <span style={{ fontSize: 20 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{m.title}</div>
              <div style={{ fontSize: 11, color: SUB }}>{m.desc}</div>
            </div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${m.statusColor}22`, color: m.statusColor, flexShrink: 0 }}>{m.status}</span>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>✉️ 직접 발송</div>
        <textarea
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="원장님들에게 보낼 메시지 입력..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: TEXT, minHeight: 80, resize: 'none', outline: 'none', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => { if (msg.trim()) { showToast('전체 원장님에게 오렌톡 발송!'); setMsg('') } }}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer' }}
          >
            💜 전체 발송
          </button>
          <button
            type="button"
            onClick={() => showToast('등급별 발송 설정')}
            style={{ padding: '8px 14px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'transparent', color: '#c4a7e7', fontSize: 12, cursor: 'pointer' }}
          >
            등급별
          </button>
        </div>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>💛 카카오 알림톡</div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 10, lineHeight: 1.6 }}>
          카카오 비즈니스 채널 연동 시 앱 미설치 원장님에게도 알림 발송 가능
        </div>
        <button
          type="button"
          onClick={() => showToast('카카오 채널 연동 준비 중')}
          style={{ width: '100%', padding: '8px', borderRadius: 8, border: '0.5px solid rgba(255,193,7,0.3)', background: 'rgba(255,193,7,0.08)', color: 'rgba(255,193,7,0.8)', fontSize: 12, cursor: 'pointer' }}
        >
          카카오 채널 연동하기
        </button>
      </div>
    </div>
  )
}
