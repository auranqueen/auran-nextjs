'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
import UnderConstructionCard from '@/components/UnderConstructionCard'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import LoginRequiredModal from '@/components/LoginRequiredModal'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { createClient } from '@/lib/supabase/client'

export default function GiftsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [phase, setPhase] = useState<'load' | 'login' | 'ok'>('load')

  useEffect(() => {
    const run = async () => {
      try {
        if (typeof document !== 'undefined' && document.cookie.includes('auran_login_modal=')) {
          document.cookie = 'auran_login_modal=; path=/; max-age=0'
        }
      } catch {}
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setPhase('login')
        return
      }
      setPhase('ok')
    }
    void run()
  }, [supabase])

  if (phase === 'load') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
        <DashboardHeader title="선물함" right={<CustomerHeaderRight />} />
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>로그인 후 선물함을 확인할 수 있어요</div>
        <LoginRequiredModal open onClose={() => router.push('/')} returnPath="/my/gifts" />
        <DashboardBottomNav role="customer" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="선물함" right={<CustomerHeaderRight />} />
      <div style={{ padding: '18px 18px 80px' }}>
        <UnderConstructionCard title="🚧 선물함 준비 중입니다" desc="생일/이벤트 선물을 여기서 확인하고 배송지를 등록할 수 있게 준비 중입니다." />
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
