'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function BrandAnalyticsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="브랜드분석" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 브랜드분석 준비 중입니다" desc="노출/전환/매출 리포트를 준비 중입니다." />
      </div>
      <DashboardBottomNav role="brand" />
    </div>
  )
}

