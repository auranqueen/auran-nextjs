'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MyWorldPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=customer')
        return
      }
      const { data } = await supabase
        .from('users')
        .select('id,name,points,skin_type,charge_balance')
        .eq('auth_id', user.id)
        .single()
      setProfile(data || null)
      setLoading(false)
    }
    run()
  }, [router, supabase])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="마이월드" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : !profile ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>프로필 정보를 불러올 수 없습니다.</div>
        ) : (
          <>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 6 }}>내 요약</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{profile.name || '사용자'}</div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: '12px 12px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.65)', marginBottom: 6 }}>포인트</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>{(profile.points || 0).toLocaleString()}P</div>
                </div>
                <div style={{ background: 'rgba(76,173,126,0.10)', border: '1px solid rgba(76,173,126,0.25)', borderRadius: 14, padding: '12px 12px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.65)', marginBottom: 6 }}>충전 잔액</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900, color: '#4cad7e' }}>₩{(profile.charge_balance || 0).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                피부 타입: <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{profile.skin_type || '미설정'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push('/my/gifts')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  padding: '14px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🎁 선물함</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>생일/이벤트 선물을 확인하세요</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/notices')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  padding: '14px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🔔 공지사항</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>업데이트/이벤트 공지를 확인하세요</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/my')}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  padding: '14px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>👤 계정</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>로그아웃/계정 정보</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>
            </div>
          </>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

