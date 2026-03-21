'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'

type ProfileRow = {
  id: string
  name: string
  avatar_url?: string | null
  skin_type?: string | null
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
          .select('id,name,avatar_url,skin_type,points,charge_balance')
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="나" right={<CustomerHeaderRight />} />

      <div style={{ padding: '18px 18px 0' }}>
        {loading || !me ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : (
          <>
            {/* 상단 요약 */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0, border: '1px solid rgba(201,168,76,0.25)' }}>
                  {me.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>🙂</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.name}</div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontWeight: 900, fontSize: 12, padding: '6px 10px', borderRadius: 999 }}>
                      {skinBadgeText(me.skin_type)}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <div style={{ background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.65)', marginBottom: 6 }}>포인트</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900, color: 'var(--gold)' }}>{(me.points || 0).toLocaleString()}P</div>
                </div>
                <div style={{ background: 'rgba(76,173,126,0.10)', border: '1px solid rgba(76,173,126,0.25)', borderRadius: 14, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.65)', marginBottom: 6 }}>충전 잔액</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900, color: '#4cad7e' }}>₩{(me.charge_balance || 0).toLocaleString()}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/wallet')}
                style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
              >
                지갑으로 이동 →
              </button>
            </div>

            {/* 메뉴 리스트 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push('/gifts')}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🎁 선물함</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>생일/이벤트 선물 확인</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/my/coupons')}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🎫 쿠폰함</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>앱 전용 할인 쿠폰</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/notices')}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>🔔 공지사항</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>업데이트/이벤트 공지</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/orders')}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>📦 구매내역</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>주문 상태 확인</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/wallet')}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>💳 내 지갑</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>포인트/충전 잔액</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/account')}
                style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>👤 계정 정보</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>프로필/설정</div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>

              <button
                type="button"
                onClick={logout}
                style={{
                  width: '100%',
                  padding: 15,
                  background: 'rgba(217,79,79,0.10)',
                  border: '1px solid rgba(217,79,79,0.30)',
                  borderRadius: 14,
                  color: '#e08080',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                🚪 로그아웃
              </button>
            </div>
          </>
        )}
      </div>

      <DashboardBottomNav role="customer" />
    </div>
  )
}

