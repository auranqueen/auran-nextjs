'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function CustomerMyWorldPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="마이월드" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 마이월드 준비 중입니다" desc="나의 기록/선물/등급/이벤트를 한 곳에서 볼 수 있도록 준비 중입니다." />
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

