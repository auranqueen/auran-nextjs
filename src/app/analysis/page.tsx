'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
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
  }, [router, supabase])

  return (
    <CustomerDashboardShell>
      <DashboardHeader title="AI 피부분석" right={<CustomerHeaderRight />} />
      <div style={{ padding: '18px 18px 0' }}>
        <AnalysisHubView
          loading={loading}
          profile={profile}
          analysisPoint={analysisPoint}
          onStartAnalysis={() => router.push('/skin-analysis')}
        />
      </div>
      <DashboardBottomNav role="customer" />
    </CustomerDashboardShell>
  )
}

