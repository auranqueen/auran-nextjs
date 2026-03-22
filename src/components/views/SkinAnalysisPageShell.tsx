'use client'

import type { ReactNode } from 'react'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'

type Props = {
  progressSlot: ReactNode | null
  errorSlot: ReactNode | null
  toastSlot: ReactNode | null
  children: ReactNode
}

export default function SkinAnalysisPageShell({ progressSlot, errorSlot, toastSlot, children }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(175deg, #12100e 0%, var(--bg) 35%, #090807 100%)',
        maxWidth: 480,
        margin: '0 auto',
        paddingBottom: 110,
        boxShadow: 'inset 0 1px 0 rgba(201,168,76,0.05)',
      }}
    >
      <DashboardHeader title="피부분석" right={<CustomerHeaderRight />} />
      <div style={{ padding: '20px 18px 0' }}>
        {progressSlot}
        {errorSlot}
        {toastSlot}
        <div
          style={{
            borderRadius: 18,
            padding: '4px 0 8px',
          }}
        >
          {children}
        </div>
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
