'use client'

import type { ReactNode } from 'react'

type Props = { children: ReactNode }

/** 홈 전용 배경·프레임 (내부 콘텐츠·로직은 페이지 그대로) */
export default function HomeCustomerShell({ children }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #14110e 0%, #0D0B09 42%, #080706 100%)',
        maxWidth: '390px',
        margin: '0 auto',
        fontFamily: "'Noto Sans KR', -apple-system, sans-serif",
        fontWeight: 300,
        color: '#fff',
        paddingBottom: '96px',
        boxShadow: 'inset 0 1px 0 rgba(201,168,76,0.06), 0 0 80px rgba(201,168,76,0.04)',
      }}
    >
      {children}
    </div>
  )
}
