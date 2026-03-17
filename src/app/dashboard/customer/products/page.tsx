'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

export default function CustomerProductsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="제품추천" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <UnderConstructionCard title="🚧 제품추천(고객) 준비 중입니다" desc="추천 알고리즘과 제품 리스트를 연결 중입니다. 업데이트까지 잠시만 기다려주세요." />
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

