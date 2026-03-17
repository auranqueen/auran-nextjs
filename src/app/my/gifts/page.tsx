'use client'

import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import NoticeBell from '@/components/NoticeBell'

export default function GiftsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto' }}>
      <DashboardHeader title="선물함" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 80px' }}>
        <UnderConstructionCard title="🚧 선물함 준비 중입니다" desc="생일/이벤트 선물을 여기서 확인하고 배송지를 등록할 수 있게 준비 중입니다." />
      </div>
    </div>
  )
}

