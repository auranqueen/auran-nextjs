'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="AI 피부분석" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : (
          <>
            {profile ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>내 피부 정보</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{profile.name || '사용자'}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>
                  피부 타입: <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{profile.skin_type || '미설정'}</span>
                  <br />
                  피부 고민: <span style={{ color: 'rgba(255,255,255,0.85)' }}>{Array.isArray(profile.skin_concerns) ? profile.skin_concerns.join(', ') || '미설정' : '미설정'}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>프로필 정보를 불러올 수 없습니다. 아래에서 바로 분석을 시작할 수 있습니다.</div>
            )}

            <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)', borderRadius: 14, padding: '14px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--gold)', marginBottom: 6 }}>🧬 분석 시작</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 10 }}>
                {`설문 기반 피부 타입 분석 후 맞춤 제품을 추천해 드립니다. 완료 시 ${analysisPoint}P 적립!`}
              </div>
              <button
                type="button"
                onClick={() => router.push('/skin-analysis')}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--gold)',
                  border: 'none',
                  color: '#0a0a0a',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                피부 분석 시작하기 →
              </button>
            </div>
          </>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

