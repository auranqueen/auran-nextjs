'use client'

import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import AnalysisHubView from '@/components/ui/AnalysisHubView'
import CustomerDashboardShell from '@/components/views/CustomerDashboardShell'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSettings } from '@/hooks/useAdminSettings'

export default function AnalysisPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any | null>(null)
  const { getSettingNum } = useAdminSettings()
  const analysisPoint = getSettingNum('points_action', 'ai_analysis_complete', 500)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer')
        return
      }
      const { data, error } = await supabase
        .from('users')
        .select('id,name,skin_type,skin_concerns')
        .eq('auth_id', user.id)
        .maybeSingle()
      setProfile(error ? null : data || null)
      setLoading(false)
    }
    run()
  }, [router])

  return (
    <CustomerDashboardShell>
      <DashboardHeader title="AI 피부분석" right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px 16px 0' }}>
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 16,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '1.5px', color: 'var(--text3)', margin: 0 }}>AI SKIN LAB</p>
          <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 400, color: 'var(--text)' }}>분석 · 추천 허브</p>
          <p style={{ margin: '6px 0 0', fontSize: 11, fontWeight: 300, lineHeight: 1.6, color: 'var(--text3)' }}>
            프로필 확인 후 피부 분석을 시작할 수 있어요.
          </p>
        </div>
        <AnalysisHubView
          loading={loading}
          profile={profile}
          analysisPoint={analysisPoint}
          onStartAnalysis={() => router.push('/skin-analysis')}
        />
      </div>
    </CustomerDashboardShell>
  )
}

