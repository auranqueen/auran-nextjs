'use client'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** 장바구니 등 하단 고정 바가 있을 때 여유 */
  paddingBottom?: number
}

/** 제품 카탈로그·홈과 동일한 그라데이션 프레임 (고객 대시보드 공통) */
export default function CustomerDashboardShell({ children, paddingBottom = 110 }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #12100e 0%, var(--bg) 38%, #0a0908 100%)',
        maxWidth: 480,
        margin: '0 auto',
        paddingBottom,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  )
}
