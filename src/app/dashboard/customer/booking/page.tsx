'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'

export default function CustomerBookingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="살롱예약" right={<CustomerHeaderRight />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 살롱예약 준비 중입니다" desc="가까운 클리닉 검색/예약 기능을 준비 중입니다." />
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

