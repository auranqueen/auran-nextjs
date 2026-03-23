'use client'

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** 장바구니 등 하단 고정 바가 있을 때 여유 (미지정 시 pb-24) */
  paddingBottom?: number
}

/** 고객 대시보드 공통: 배경 #0D0B09, max 390px, 하단 네비 여유 */
export default function CustomerDashboardShell({ children, paddingBottom }: Props) {
  return (
    <div
      className={`mx-auto min-h-screen w-full max-w-[390px] bg-[#0D0B09] ${paddingBottom === undefined ? 'pb-24' : ''}`}
      style={paddingBottom !== undefined ? { paddingBottom } : undefined}
    >
      {children}
    </div>
  )
}
