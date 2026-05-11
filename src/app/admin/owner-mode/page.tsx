'use client'
import { useRouter } from 'next/navigation'

const FUNCS = [
  { icon: '💬', title: '고객 상담 채팅', desc: '고객과 1:1 상담', href: '/dashboard/owner/chat/redirect' },
  { icon: '📊', title: '고객 피부 차트', desc: '피부 분석 & 시술 기록', href: '/dashboard/owner/charts' },
  { icon: '📅', title: '예약 현황', desc: '오늘 & 이번주 예약', href: '/dashboard/owner' },
  { icon: '🏪', title: '스토어 관리', desc: '제품 & 재고 관리', href: '/dashboard/owner/store' },
  { icon: '💳', title: '구독 관리', desc: 'AURAN 구독 현황', href: '/dashboard/owner/subscription' },
]

export default function AdminOwnerModePage() {
  const router = useRouter()
  return (
    <div style={{ padding: 24, background: '#0d0b12', minHeight: '100vh' }}>
      <div style={{ fontSize: 9, color: '#C9A96E', letterSpacing: 3, fontFamily: 'monospace', marginBottom: 16 }}>내 원장 기능 바로가기</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {FUNCS.map(f => (
          <div key={f.href} onClick={() => router.push(f.href)}
            style={{ padding: 20, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 13, color: '#fff', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
