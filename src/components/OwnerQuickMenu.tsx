'use client'

import { useRouter } from 'next/navigation'

export default function OwnerQuickMenu() {
  const router = useRouter()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
      {[
        { icon: '📅', label: '예약 관리', color: 'rgba(191,95,144,0.1)', border: 'rgba(191,95,144,0.3)', tc: '#bf5f90', href: '/dashboard/owner/bookings' },
        { icon: '👥', label: '고객 관리', color: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)', tc: '#4a8dc0', href: '/dashboard/owner/customers' },
        { icon: '🏪', label: '스토어', color: 'rgba(149,104,212,0.1)', border: 'rgba(149,104,212,0.3)', tc: '#9568d4', href: '/dashboard/owner/store' },
        { icon: '🖊️', label: '샵 편집', color: 'rgba(76,173,126,0.08)', border: 'rgba(76,173,126,0.25)', tc: '#4cad7e', href: '/dashboard/owner/edit' },
        { icon: '📊', label: '매출 리포트', color: 'rgba(240,160,80,0.08)', border: 'rgba(240,160,80,0.25)', tc: '#f0a050', href: '/dashboard/owner/revenue' },
        { icon: '💳', label: '구독 관리', color: 'rgba(191,95,144,0.08)', border: 'rgba(191,95,144,0.2)', tc: '#bf5f90', href: '/dashboard/owner/subscription' },
        { icon: '📋', label: '시술차트', color: 'rgba(123,94,167,0.1)', border: 'rgba(123,94,167,0.3)', tc: '#7B5EA7', href: '/dashboard/owner/charts-v2' },
        { icon: '🧬', label: 'AI 학습', color: 'rgba(123,94,167,0.1)', border: 'rgba(123,94,167,0.3)', tc: '#7B5EA7', href: '/admin/hormone-phases' },
      ].map(m => (
        <button
          key={m.label}
          type="button"
          onClick={() => router.push(m.href)}
          style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '13px 12px', textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: m.tc }}>{m.label}</div>
        </button>
      ))}
    </div>
  )
}
