'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import MyAccountHubView from '@/components/ui/MyAccountHubView'
import CustomerDashboardShell from '@/components/views/CustomerDashboardShell'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import { getStoredTheme, setStoredTheme } from '@/lib/theme'
import { getCustomerGradeLabel } from '@/lib/customerGrade'

type ProfileRow = {
  id: string
  name: string
  avatar_url?: string | null
  skin_type?: string | null
  customer_grade?: string | null
  points: number
  charge_balance: number
}

function skinBadgeText(skinType: string | null | undefined) {
  if (!skinType) return '미설정 ✨'
  return `${skinType} ✨`
}

export default function MyPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<ProfileRow | null>(null)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    setThemeMode(getStoredTheme())
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.replace('/login?role=customer')
          return
        }

        const { data: profile } = await supabase
          .from('users')
          .select('id,name,avatar_url,skin_type,customer_grade,points,charge_balance')
          .eq('auth_id', data.user.id)
          .single()

        if (!profile?.id) {
          router.replace('/login?role=customer')
          return
        }

        setMe(profile as ProfileRow)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [router, supabase])

  const logout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const toggleThemeMode = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark'
    setStoredTheme(next)
    setThemeMode(next)
  }

  return (
    <CustomerDashboardShell>
      <DashboardHeader title="나" right={<CustomerHeaderRight />} />

      <div style={{ padding: '8px 18px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={toggleThemeMode}
          style={{
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--text2)',
            fontWeight: 700,
          }}
        >
          {themeMode === 'dark' ? '라이트 모드' : '다크 모드'}
        </button>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        {loading || !me ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : (
          <MyAccountHubView
            me={me}
            skinBadgeLabel={skinBadgeText(me.skin_type)}
            gradeLabel={getCustomerGradeLabel(me.customer_grade)}
            navigate={path => router.push(path)}
            onLogout={logout}
          />
        )}
      </div>

      <DashboardBottomNav role="customer" />
    </CustomerDashboardShell>
  )
}

