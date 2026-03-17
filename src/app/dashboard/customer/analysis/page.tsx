'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function CustomerAnalysisPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="피부분석" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 피부분석(고객) 준비 중입니다" desc="현재는 기존 분석 화면을 정리 중입니다. 곧 대시보드 내에서 바로 분석할 수 있게 업데이트됩니다." />
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

