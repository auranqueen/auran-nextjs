'use client'

import UnderConstructionCard from '@/components/UnderConstructionCard'

export default function AdminBirthdayGiftsPage() {
  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 10 }}>생일 선물 관리</div>
      <UnderConstructionCard title="🚧 준비 중입니다" desc="`birthday_gifts` 테이블 연동 및 자동 지급 규칙을 준비 중입니다." />
    </div>
  )
}

