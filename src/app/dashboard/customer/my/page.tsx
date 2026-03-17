'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function CustomerMyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="나" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 준비 중입니다" desc="고객 전용 마이페이지(프로필/등급/설정/선물함 바로가기)를 준비 중입니다." />
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

