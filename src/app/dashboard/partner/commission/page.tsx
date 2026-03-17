'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function PartnerCommissionPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="커미션수익" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 커미션수익 준비 중입니다" desc="정산/출금 내역과 실시간 커미션 집계를 준비 중입니다." />
      </div>
      <DashboardBottomNav role="partner" />
    </div>
  )
}

