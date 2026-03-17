'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function PartnerLivePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="라이브커머스" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 라이브커머스 준비 중입니다" desc="라이브 일정/상품 연결/정산 기능을 준비 중입니다." />
      </div>
      <DashboardBottomNav role="partner" />
    </div>
  )
}

