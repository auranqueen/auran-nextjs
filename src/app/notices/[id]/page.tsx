'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { NOTICES } from '../data'
import { useAdminSettings } from '@/hooks/useAdminSettings'

export default function NoticeDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { getSetting } = useAdminSettings()
  const highlightColor = getSetting('notice_ui', 'highlight_color', '#F5E642')

  const notice = useMemo(() => NOTICES.find(n => n.id === params.id), [params.id])
  if (!notice) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #1a2e1a, #0d1f0d)', color: '#fff', padding: 20 }}>
        존재하지 않는 공지입니다.
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #1a2e1a, #0d1f0d)', color: '#fff', position: 'relative', fontFamily: "'Nanum Pen Script', 'Caveat', cursive" }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.14, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 0.5px, transparent 1px)', backgroundSize: '3px 3px' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: '20px 18px 30px' }}>
        <h1 style={{ margin: 0, color: highlightColor, fontSize: 38, fontFamily: "'Caveat', 'Nanum Pen Script', cursive" }}>
          {notice.emoji} {notice.title}
        </h1>
        <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{notice.date}</div>
        <div style={{ margin: '16px 0', borderBottom: '1px dashed rgba(255,255,255,0.65)' }} />
        <div style={{ fontSize: 22, lineHeight: 1.9, whiteSpace: 'pre-line' }}>{notice.content}</div>
        <button
          onClick={() => router.push('/notices')}
          style={{ marginTop: 26, border: '1px dashed rgba(255,255,255,0.8)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}
        >
          ← 돌아가기
        </button>
      </div>
    </div>
  )
}
