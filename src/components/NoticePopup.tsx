// src/components/NoticePopup.tsx
// 앱 첫 진입시 최신 고정 공지 팝업

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const LATEST_NOTICE = {
  id: 'notice-002',
  emoji: '🎂',
  title: '생일 D-7 특별 테마 + 선물 이벤트',
  summary: '생일 7일 전부터 특별 테마 적용 + 등급별 선물 증정 이벤트',
  date: '2026-03-17',
}

export default function NoticePopup() {
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const key = 'auran_notice_' + LATEST_NOTICE.id
    const dismissed = localStorage.getItem(key)
    if (!dismissed) setShow(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem('auran_notice_' + LATEST_NOTICE.id, 'dismissed')
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#141414', borderRadius: '24px', padding: '28px 24px', width: '100%', maxWidth: '360px', border: '1px solid rgba(201,168,76,0.2)' }}>

        {/* 이모지 */}
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>
          {LATEST_NOTICE.emoji}
        </div>

        {/* 제목 */}
        <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: '10px', lineHeight: 1.4 }}>
          {LATEST_NOTICE.title}
        </h3>

        {/* 요약 */}
        <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', lineHeight: 1.7, marginBottom: '24px' }}>
          {LATEST_NOTICE.summary}
        </p>

        {/* 버튼 */}
        <button
          onClick={() => { dismiss(); router.push('/notices') }}
          style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#c9a84c,#a07830)', border: 'none', borderRadius: '14px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px' }}>
          공지 자세히 보기
        </button>

        <button
          onClick={dismiss}
          style={{ width: '100%', padding: '12px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: '#555', fontSize: '13px', cursor: 'pointer' }}>
          오늘 하루 안보기
        </button>
      </div>
    </div>
  )
}

